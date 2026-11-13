import type { AirQualityLocation } from "./locations.js";

/**
 * Default coverage for the dashboard: a global set of major metropolitan
 * areas. Open-Meteo serves modelled air quality for any coordinate, so this
 * list can be overridden with the AIR_QUALITY_LOCATIONS environment variable.
 */
export const DEFAULT_LOCATIONS: readonly AirQualityLocation[] = [
  // Europe
  { id: "madrid", name: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { id: "barcelona", name: "Barcelona", country: "Spain", latitude: 41.3874, longitude: 2.1686 },
  { id: "london", name: "London", country: "United Kingdom", latitude: 51.5072, longitude: -0.1276 },
  { id: "paris", name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { id: "berlin", name: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
  { id: "rome", name: "Rome", country: "Italy", latitude: 41.9028, longitude: 12.4964 },
  { id: "milan", name: "Milan", country: "Italy", latitude: 45.4642, longitude: 9.19 },
  { id: "lisbon", name: "Lisbon", country: "Portugal", latitude: 38.7223, longitude: -9.1393 },
  { id: "amsterdam", name: "Amsterdam", country: "Netherlands", latitude: 52.3676, longitude: 4.9041 },
  { id: "brussels", name: "Brussels", country: "Belgium", latitude: 50.8503, longitude: 4.3517 },
  { id: "vienna", name: "Vienna", country: "Austria", latitude: 48.2082, longitude: 16.3738 },
  { id: "prague", name: "Prague", country: "Czechia", latitude: 50.0755, longitude: 14.4378 },
  { id: "warsaw", name: "Warsaw", country: "Poland", latitude: 52.2297, longitude: 21.0122 },
  { id: "budapest", name: "Budapest", country: "Hungary", latitude: 47.4979, longitude: 19.0402 },
  { id: "athens", name: "Athens", country: "Greece", latitude: 37.9838, longitude: 23.7275 },
  { id: "istanbul", name: "Istanbul", country: "Türkiye", latitude: 41.0082, longitude: 28.9784 },
  { id: "stockholm", name: "Stockholm", country: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { id: "oslo", name: "Oslo", country: "Norway", latitude: 59.9139, longitude: 10.7522 },
  { id: "copenhagen", name: "Copenhagen", country: "Denmark", latitude: 55.6761, longitude: 12.5683 },
  { id: "helsinki", name: "Helsinki", country: "Finland", latitude: 60.1699, longitude: 24.9384 },
  { id: "dublin", name: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603 },
  { id: "zurich", name: "Zurich", country: "Switzerland", latitude: 47.3769, longitude: 8.5417 },
  { id: "kyiv", name: "Kyiv", country: "Ukraine", latitude: 50.4501, longitude: 30.5234 },
  { id: "bucharest", name: "Bucharest", country: "Romania", latitude: 44.4268, longitude: 26.1025 },

  // Americas
  { id: "new-york", name: "New York", country: "United States", latitude: 40.7128, longitude: -74.006 },
  { id: "los-angeles", name: "Los Angeles", country: "United States", latitude: 34.0522, longitude: -118.2437 },
  { id: "chicago", name: "Chicago", country: "United States", latitude: 41.8781, longitude: -87.6298 },
  { id: "miami", name: "Miami", country: "United States", latitude: 25.7617, longitude: -80.1918 },
  { id: "toronto", name: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832 },
  { id: "vancouver", name: "Vancouver", country: "Canada", latitude: 49.2827, longitude: -123.1207 },
  { id: "mexico-city", name: "Mexico City", country: "Mexico", latitude: 19.4326, longitude: -99.1332 },
  { id: "bogota", name: "Bogotá", country: "Colombia", latitude: 4.711, longitude: -74.0721 },
  { id: "lima", name: "Lima", country: "Peru", latitude: -12.0464, longitude: -77.0428 },
  { id: "santiago", name: "Santiago", country: "Chile", latitude: -33.4489, longitude: -70.6693 },
  { id: "buenos-aires", name: "Buenos Aires", country: "Argentina", latitude: -34.6037, longitude: -58.3816 },
  { id: "sao-paulo", name: "São Paulo", country: "Brazil", latitude: -23.5505, longitude: -46.6333 },
  { id: "rio-de-janeiro", name: "Rio de Janeiro", country: "Brazil", latitude: -22.9068, longitude: -43.1729 },
  { id: "montevideo", name: "Montevideo", country: "Uruguay", latitude: -34.9011, longitude: -56.1645 },
  { id: "quito", name: "Quito", country: "Ecuador", latitude: -0.1807, longitude: -78.4678 },
  { id: "havana", name: "Havana", country: "Cuba", latitude: 23.1136, longitude: -82.3666 },

  // Asia
  { id: "tokyo", name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
  { id: "seoul", name: "Seoul", country: "South Korea", latitude: 37.5665, longitude: 126.978 },
  { id: "beijing", name: "Beijing", country: "China", latitude: 39.9042, longitude: 116.4074 },
  { id: "shanghai", name: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737 },
  { id: "guangzhou", name: "Guangzhou", country: "China", latitude: 23.1291, longitude: 113.2644 },
  { id: "hong-kong", name: "Hong Kong", country: "Hong Kong", latitude: 22.3193, longitude: 114.1694 },
  { id: "taipei", name: "Taipei", country: "Taiwan", latitude: 25.033, longitude: 121.5654 },
  { id: "singapore", name: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { id: "bangkok", name: "Bangkok", country: "Thailand", latitude: 13.7563, longitude: 100.5018 },
  { id: "jakarta", name: "Jakarta", country: "Indonesia", latitude: -6.2088, longitude: 106.8456 },
  { id: "manila", name: "Manila", country: "Philippines", latitude: 14.5995, longitude: 120.9842 },
  { id: "hanoi", name: "Hanoi", country: "Vietnam", latitude: 21.0278, longitude: 105.8342 },
  { id: "delhi", name: "Delhi", country: "India", latitude: 28.7041, longitude: 77.1025 },
  { id: "mumbai", name: "Mumbai", country: "India", latitude: 19.076, longitude: 72.8777 },
  { id: "bengaluru", name: "Bengaluru", country: "India", latitude: 12.9716, longitude: 77.5946 },
  { id: "karachi", name: "Karachi", country: "Pakistan", latitude: 24.8607, longitude: 67.0011 },
  { id: "dhaka", name: "Dhaka", country: "Bangladesh", latitude: 23.8103, longitude: 90.4125 },
  { id: "dubai", name: "Dubai", country: "United Arab Emirates", latitude: 25.2048, longitude: 55.2708 },
  { id: "riyadh", name: "Riyadh", country: "Saudi Arabia", latitude: 24.7136, longitude: 46.6753 },
  { id: "tel-aviv", name: "Tel Aviv", country: "Israel", latitude: 32.0853, longitude: 34.7818 },

  // Africa
  { id: "cairo", name: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357 },
  { id: "lagos", name: "Lagos", country: "Nigeria", latitude: 6.5244, longitude: 3.3792 },
  { id: "nairobi", name: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219 },
  { id: "johannesburg", name: "Johannesburg", country: "South Africa", latitude: -26.2041, longitude: 28.0473 },
  { id: "cape-town", name: "Cape Town", country: "South Africa", latitude: -33.9249, longitude: 18.4241 },
  { id: "casablanca", name: "Casablanca", country: "Morocco", latitude: 33.5731, longitude: -7.5898 },
  { id: "addis-ababa", name: "Addis Ababa", country: "Ethiopia", latitude: 9.03, longitude: 38.74 },

  // Oceania
  { id: "sydney", name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 },
  { id: "melbourne", name: "Melbourne", country: "Australia", latitude: -37.8136, longitude: 144.9631 },
  { id: "perth", name: "Perth", country: "Australia", latitude: -31.9505, longitude: 115.8605 },
  { id: "auckland", name: "Auckland", country: "New Zealand", latitude: -36.8485, longitude: 174.7633 },
];
