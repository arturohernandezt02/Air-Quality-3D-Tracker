import type { Kysely } from "kysely";
import type { IngestionConfig } from "../config/ingestion.js";
import type { AirQualityLocation } from "../config/locations.js";
import type { AirQualityDatabase } from "../db/types.js";
import { ingestAirQualityData, type IngestionResult } from "./ingestion.js";

export interface IngestionLogger {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export type IngestFunction = (
  database: Kysely<AirQualityDatabase>,
  locations: AirQualityLocation[],
  now?: () => Date,
) => Promise<IngestionResult>;

export interface IngestionSchedulerOptions {
  database: Kysely<AirQualityDatabase>;
  locations: AirQualityLocation[];
  config: IngestionConfig;
  logger: IngestionLogger;
  ingest?: IngestFunction;
  now?: () => Date;
}

export interface IngestionScheduler {
  runNow(): Promise<void>;
  stop(): Promise<void>;
}

type IngestionReason = "startup" | "scheduled" | "manual";

export function startIngestionScheduler(
  options: IngestionSchedulerOptions,
): IngestionScheduler {
  const {
    database,
    locations,
    config,
    logger,
    ingest = ingestAirQualityData,
    now = () => new Date(),
  } = options;
  let timer: NodeJS.Timeout | undefined;
  let activeRun: Promise<void> | null = null;
  let stopped = false;

  function scheduleNext(): void {
    if (stopped || config.intervalMinutes <= 0) {
      return;
    }

    timer = setTimeout(() => {
      timer = undefined;
      void execute("scheduled");
    }, config.intervalMinutes * 60_000);
    timer.unref();
  }

  async function execute(reason: IngestionReason): Promise<void> {
    if (stopped) {
      return;
    }

    if (activeRun !== null) {
      logger.warn(
        { reason },
        "Skipping air-quality ingestion because a previous run is still active.",
      );
      return activeRun;
    }

    const startedAt = Date.now();
    const run = (async () => {
      try {
        const result = await ingest(database, locations, now);
        logger.info(
          {
            reason,
            durationMs: Date.now() - startedAt,
            locations: result.locations.length,
            readings: result.readingCount,
          },
          "Air-quality ingestion completed.",
        );
      } catch (error) {
        logger.error(
          { err: error, reason, durationMs: Date.now() - startedAt },
          "Air-quality ingestion failed.",
        );
      }
    })();

    activeRun = run;
    void run.finally(() => {
      if (activeRun === run) {
        activeRun = null;
        scheduleNext();
      }
    });

    return run;
  }

  logger.info(
    {
      intervalMinutes: config.intervalMinutes,
      ingestOnStartup: config.ingestOnStartup,
    },
    "Air-quality ingestion scheduler started.",
  );

  if (config.ingestOnStartup) {
    void execute("startup");
  } else {
    scheduleNext();
  }

  return {
    runNow: () => execute("manual"),
    async stop() {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      await activeRun;
    },
  };
}
