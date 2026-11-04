import type { FastifyPluginAsync } from "fastify";
import type {
  AirQualityRepository,
  MetricsQuery,
} from "../db/repository.js";

interface MetricsQuerystring {
  from?: string;
  to?: string;
  stationId?: string;
}

export interface ApiV1Options {
  staleAfterMinutes?: number;
}

const DEFAULT_STALE_AFTER_MINUTES = 180;

const metricsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: { type: "string", minLength: 1 },
    to: { type: "string", minLength: 1 },
    stationId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const RFC3339_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

function parseTimestamp(value: string): Date | undefined {
  const parts = RFC3339_TIMESTAMP.exec(value);
  if (parts === null) {
    return undefined;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , , offsetHourText, offsetMinuteText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysPerMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offsetHourText !== undefined && Number(offsetHourText) > 23) ||
    (offsetMinuteText !== undefined && Number(offsetMinuteText) > 59)
  ) {
    return undefined;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

function parseMetricsQuery(
  query: MetricsQuerystring,
  now: Date,
): MetricsQuery | string {
  if ((query.from === undefined) !== (query.to === undefined)) {
    return "Provide both 'from' and 'to' timestamps.";
  }

  const from = query.from === undefined
    ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
    : parseTimestamp(query.from);
  const to = query.to === undefined ? now : parseTimestamp(query.to);

  if (from === undefined || to === undefined) {
    return "Timestamps must be valid RFC 3339 values with a timezone.";
  }

  if (from >= to) {
    return "'from' must be earlier than 'to'.";
  }

  return {
    from,
    to,
    ...(query.stationId === undefined ? {} : { stationId: query.stationId }),
  };
}

export function createApiV1Routes(
  repository: AirQualityRepository,
  now: () => Date = () => new Date(),
  options: ApiV1Options = {},
): FastifyPluginAsync {
  const staleAfterMinutes =
    options.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES;

  return async (app) => {
    app.get("/stations", async () => ({
      data: await repository.listStations(),
    }));

    app.get("/freshness", async () => {
      const freshness = await repository.getFreshness();
      const currentTime = now();
      const ageMinutes =
        freshness.lastIngestedAt === null
          ? null
          : Math.max(
              0,
              Math.floor(
                (currentTime.getTime() - freshness.lastIngestedAt.getTime()) /
                  60_000,
              ),
            );

      return {
        data: {
          latestObservation:
            freshness.latestObservation?.toISOString() ?? null,
          lastIngestedAt: freshness.lastIngestedAt?.toISOString() ?? null,
          lastAttemptAt: freshness.lastAttemptAt?.toISOString() ?? null,
          ageMinutes,
          staleAfterMinutes,
          isStale: ageMinutes === null || ageMinutes > staleAfterMinutes,
        },
      };
    });

    app.get<{ Querystring: MetricsQuerystring }>(
      "/metrics",
      { schema: { querystring: metricsQuerySchema } },
      async (request, reply) => {
        const query = parseMetricsQuery(request.query, now());
        if (typeof query === "string") {
          return reply.code(400).send({
            error: {
              code: "INVALID_QUERY",
              message: query,
            },
          });
        }

        const readings = await repository.listMetrics(query);
        return {
          data: readings.map((reading) => ({
            stationId: reading.id,
            name: reading.name,
            country: reading.country,
            latitude: reading.latitude,
            longitude: reading.longitude,
            observedAt: reading.observedAt,
            metrics: {
              pm2_5: reading.pm2_5,
              pm10: reading.pm10,
              nitrogen_dioxide: reading.nitrogen_dioxide,
              ozone: reading.ozone,
            },
          })),
          meta: {
            from: query.from.toISOString(),
            to: query.to.toISOString(),
            interval: "[from, to)",
            count: readings.length,
          },
        };
      },
    );
  };
}
