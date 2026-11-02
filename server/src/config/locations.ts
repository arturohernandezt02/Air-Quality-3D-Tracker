export interface AirQualityLocation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

const DEFAULT_LOCATIONS: AirQualityLocation[] = [
  {
    id: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    latitude: 19.4326,
    longitude: -99.1332,
  },
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    latitude: 40.4168,
    longitude: -3.7038,
  },
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    country: "Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadLocations(
  locationsJson = process.env.AIR_QUALITY_LOCATIONS,
): AirQualityLocation[] {
  if (locationsJson === undefined) {
    return DEFAULT_LOCATIONS.map((location) => ({ ...location }));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(locationsJson);
  } catch (error) {
    throw new Error("AIR_QUALITY_LOCATIONS must contain valid JSON.", {
      cause: error,
    });
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AIR_QUALITY_LOCATIONS must be a non-empty JSON array.");
  }

  const locations = parsed.map((value, index): AirQualityLocation => {
    if (!isRecord(value)) {
      throw new Error(`Location at index ${index} must be a JSON object.`);
    }

    const { id, name, country, latitude, longitude } = value;
    if (
      typeof id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof country !== "string" ||
      country.trim().length === 0 ||
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error(
        `Location at index ${index} has invalid fields. Provide a slug id, non-empty name and country, and valid latitude/longitude.`,
      );
    }

    return { id, name: name.trim(), country: country.trim(), latitude, longitude };
  });

  const ids = new Set<string>();
  for (const location of locations) {
    if (ids.has(location.id)) {
      throw new Error(`Duplicate location id: ${location.id}`);
    }
    ids.add(location.id);
  }

  return locations;
}
