export interface IngestionConfig {
  intervalMinutes: number;
  ingestOnStartup: boolean;
  staleAfterMinutes: number;
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}.`,
    );
  }

  return parsed;
}

function parseBoolean(
  name: string,
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  throw new Error(`${name} must be a boolean (true/false).`);
}

export function loadIngestionConfig(
  env: NodeJS.ProcessEnv = process.env,
): IngestionConfig {
  const intervalMinutes = parseInteger(
    "INGEST_INTERVAL_MINUTES",
    env.INGEST_INTERVAL_MINUTES,
    60,
    0,
  );
  const defaultStaleAfterMinutes =
    intervalMinutes === 0 ? 180 : Math.max(180, intervalMinutes * 2);

  return {
    intervalMinutes,
    ingestOnStartup: parseBoolean(
      "INGEST_ON_STARTUP",
      env.INGEST_ON_STARTUP,
      true,
    ),
    staleAfterMinutes: parseInteger(
      "INGEST_STALE_AFTER_MINUTES",
      env.INGEST_STALE_AFTER_MINUTES,
      defaultStaleAfterMinutes,
      1,
    ),
  };
}
