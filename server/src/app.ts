import Fastify from "fastify";
import type { AirQualityRepository } from "./db/repository.js";
import { createApiV1Routes } from "./routes/api-v1.js";

export function createApp(
  repository: AirQualityRepository,
  now: () => Date = () => new Date(),
) {
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } },
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(createApiV1Routes(repository, now), { prefix: "/api/v1" });

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
