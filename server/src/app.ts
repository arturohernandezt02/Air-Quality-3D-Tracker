import Fastify from "fastify";
import cors from "@fastify/cors";
import type { AirQualityRepository } from "./db/repository.js";
import { createApiV1Routes } from "./routes/api-v1.js";

export type ReadinessCheck = () => Promise<void>;

export interface AppOptions {
  checkReadiness?: ReadinessCheck;
  staleAfterMinutes?: number;
}

const defaultReadinessCheck: ReadinessCheck = async () => {};

export function createApp(
  repository: AirQualityRepository,
  now: () => Date = () => new Date(),
  options: AppOptions = {},
) {
  const checkReadiness = options.checkReadiness ?? defaultReadinessCheck;
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } },
  });
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.register(cors, { origin: allowedOrigins });
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (request, reply) => {
    try {
      await checkReadiness();
      return { status: "ready" };
    } catch (error) {
      request.log.error({ err: error }, "Readiness check failed.");
      return reply.code(503).send({
        error: {
          code: "NOT_READY",
          message: "Database is not available.",
        },
      });
    }
  });
  app.register(createApiV1Routes(repository, now, {
    staleAfterMinutes: options.staleAfterMinutes,
  }), { prefix: "/api/v1" });

  app.setErrorHandler((error, request, reply) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "validation" in error &&
      Array.isArray(error.validation)
    ) {
      return reply.code(400).send({
        error: {
          code: "INVALID_QUERY",
          message: "Invalid request parameters.",
        },
      });
    }

    request.log.error({ err: error });
    return reply.code(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });

  return app;
}
