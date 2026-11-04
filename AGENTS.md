# AGENTS.md

Guía para agentes que trabajen en **Air Quality 3D Tracker**.

## Descripción general

Monorepo con dos paquetes independientes (no hay workspace raíz ni `package.json` en la raíz):

- `server/`: API REST con Fastify 5, Kysely y PostgreSQL/TimescaleDB. Ingiere datos horarios de la API Air Quality de Open-Meteo.
- `client/`: SPA con React 19, Vite, Tailwind CSS 4, MapLibre GL y Deck.gl (HexagonLayer 3D y HeatmapLayer).
- `docker-compose.yml`: TimescaleDB local (`timescale/timescaledb:2.17.2-pg16`).

Los datos son **estimaciones modeladas** de Open-Meteo para tres ubicaciones por defecto (Ciudad de México, Madrid y Buenos Aires), no mediciones de estaciones físicas. La cobertura es dispersa y no se interpola entre estaciones.

## Comandos

Ejecuta `npm` dentro de cada paquete; no hay instalación en la raíz.

### Server (`server/`)

| Comando | Uso |
| --- | --- |
| `npm install` | Instalar dependencias |
| `npm run dev` | API con recarga (`tsx watch`), puerto 3000 |
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm start` | Ejecutar `dist/index.js` (requiere build) |
| `npm test` | Tests con `node:test` vía `tsx` |
| `npm run db:migrate` | Aplicar el esquema (requiere la base de datos activa) |
| `npm run ingest` | Descargar datos de Open-Meteo y hacer upsert (requiere base de datos e internet) |

### Client (`client/`)

| Comando | Uso |
| --- | --- |
| `npm install` | Instalar dependencias |
| `npm run dev` | Vite en `http://localhost:5173` con proxy a la API |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | `oxlint` |
| `npm run preview` | Servir el build de producción |

### Validación antes de terminar un cambio

```powershell
Push-Location server
npm run build
npm test
Pop-Location

Push-Location client
npm run build
npm run lint
Pop-Location
```

No hay CI ni tests end-to-end configurados.

## Entorno local

Requisitos: Node.js 20 o posterior y Docker Desktop iniciado.

```powershell
Copy-Item server\.env.example server\.env
docker compose --env-file server\.env up -d timescaledb

Push-Location server
npm install
npm run db:migrate
npm run ingest
npm run dev
Pop-Location

Copy-Item client\.env.example client\.env
Push-Location client
npm install
npm run dev
Pop-Location
```

Variables relevantes:

- `server/.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `FRONTEND_ORIGIN` (lista separada por comas), `AIR_QUALITY_LOCATIONS` (JSON), `PORT`, `HOST` y opcionalmente `DATABASE_URL` para sobrescribir la conexión.
- `client/.env`: `VITE_API_BASE_URL` (por defecto `/api/v1`) y `VITE_PROXY_TARGET` (por defecto `http://localhost:3000`).
- Los archivos `.env` están en `.gitignore`; nunca los commitees ni expongas secretos.

## Arquitectura

### Server

Flujo de arranque: `src/index.ts` carga `.env`, crea la instancia de Kysely (`db/database.ts`), la envuelve en `KyselyAirQualityRepository` y llama a `createApp()` (`app.ts`) pasando `checkDatabaseConnection` como comprobación de readiness. El cierre de Fastify destruye el pool de la base de datos, y `SIGINT`/`SIGTERM` disparan un apagado ordenado (una sola vez) que cierra la app y sale con código 0 o 1.

- `src/app.ts`: `createApp(repository, now, checkReadiness)` recibe el repositorio, el reloj y la comprobación de readiness por inyección de dependencias para facilitar los tests. Configura CORS con `FRONTEND_ORIGIN`, `GET /health` (liveness), `GET /ready` (readiness con `SELECT 1`; `503 NOT_READY` si la base de datos falla), el prefijo `/api/v1` y un manejador de errores que convierte fallos de validación en `400 INVALID_QUERY` y el resto en un `500` genérico sin filtrar detalles internos.
- `src/routes/api-v1.ts`: define `GET /stations` y `GET /metrics`. `from`/`to` deben ser RFC 3339 con zona horaria y enviarse juntos; por defecto se consultan las últimas 24 h. El intervalo es `[from, to)`. La respuesta es `{ data, meta }`, y los errores `{ error: { code, message } }`.
- `src/db/repository.ts`: interfaz `AirQualityRepository` (`listStations`, `listMetrics`) e implementación con Kysely. Mantén las rutas dependiendo de la interfaz, no de Kysely directamente.
- `src/db/database.ts`: crea el pool de `pg` con `connectionTimeoutMillis: 5_000` y exporta `checkDatabaseConnection`, que ejecuta `SELECT 1` para el endpoint `/ready`.
- `src/db/types.ts`: tipos de las tablas para Kysely.
- `src/db/migrate.ts` + `src/db/migrations/001_create_air_quality_schema.sql`: migración idempotente en SQL crudo; crea `stations`, `air_quality_readings` como hypertable de TimescaleDB e índice por estación/tiempo. Para cambios de esquema, añade una migración nueva en lugar de reescribir la existente.
- `src/services/open-meteo.ts`: construye la petición a Open-Meteo (UTC, unixtime, 72 h: dos días anteriores y el día actual) mediante `buildAirQualityUrl`, valida estrictamente el JSON y lo convierte a `HourlyObservation[]`. Las 72 h garantizan que la ventana de 48 h del cliente esté cubierta desde la primera ingesta.
- `src/services/ingest.ts`: por cada ubicación, upserta la estación y sus lecturas en una transacción. Reejecutar la ingesta no duplica filas (clave `station_id, observed_at`).
- `src/config/locations.ts`: ubicaciones por defecto o `AIR_QUALITY_LOCATIONS`; valida ids tipo slug, unicidad y rangos de latitud/longitud.

### Client

- `src/App.tsx`: estado de filtros (contaminante, estación, ventana de 6/24/48 h y capa), panel de resumen y carga diferida del mapa con `React.lazy`.
- `src/hooks/useAirQualityData.ts`: consulta `stations` y `metrics` en paralelo con `AbortController`, valida las respuestas en el límite de la API y expone `{ stations, readings, isLoading, error, updatedAt, refresh }`. No usa datos de respaldo.
- `src/types/air-quality.ts`: contrato de tipos, `MetricKey`, `METRIC_OPTIONS` y unidades (µg/m³).
- `src/components/AirQualityMap.tsx`: mapa MapLibre + Deck.gl. Ajusta la cámara a las estaciones solo cuando cambia el conjunto de ubicaciones (no en cada refresco de datos), incluye un botón «Centrar» y muestra un aviso con reintento si el estilo base no carga. Dibuja marcadores seleccionables y alterna HexagonLayer/HeatmapLayer. La importación `maplibre-gl/dist/maplibre-gl-worker.mjs?url` junto con `setWorkerUrl` es necesaria para el worker; no la elimines.
- `vite.config.ts`: proxy de `/api` y `/health` hacia Fastify; `optimizeDeps.exclude` para `maplibre-gl` es intencional.

### Flujo de datos

`Open-Meteo → ingest (upsert) → TimescaleDB → API Fastify /api/v1 → hook del cliente → App/Deck.gl`

## Convenciones de código

- TypeScript estricto en ambos paquetes. El servidor usa ESM con `module: NodeNext`: los imports relativos deben terminar en `.js` (aunque el archivo fuente sea `.ts`). El cliente usa resolución `bundler` y no lleva extensión en los imports.
- El servidor usa `type` imports, top-level await y nombres de identificadores en inglés. Los mensajes de la API están en inglés; la interfaz y los textos visibles del cliente están en español.
- Mantén la separación de capas: rutas → interfaz de repositorio → Kysely → SQL. No metas consultas SQL en las rutas.
- Añade tests del servidor como `src/**/*.test.ts` con `node:test` y `app.inject`, usando repositorios falsos. No requieren base de datos. Los tests actuales cubren rutas, validación, CORS y parsing de Open-Meteo.
- Valida datos externos en el borde (Open-Meteo y respuestas HTTP del cliente) antes de confiar en su forma.
- Sin `any` implícito; respeta `noUnusedLocals`/`noUnusedParameters` del cliente (el build falla con variables sin usar).
- Estilos con clases utilitarias de Tailwind inline; los estilos globales viven en `src/App.css` e `src/index.css`.
- Formato de respuesta de API: éxito `{ data, meta? }`; error `{ error: { code, message } }`. Fechas en ISO 8601 UTC.
- Commits con Conventional Commits, p. ej. `feat(server): ...`, `fix(client): ...`.

## Notas y trampas

- `db:migrate` e `ingest` fallan si TimescaleDB no está levantado. La ingesta necesita internet y puede tardar hasta 30 s por ubicación.
- Cambiar `AIR_QUALITY_LOCATIONS` no elimina estaciones antiguas de la base de datos; solo reingiere las nuevas. Actualiza el esquema o limpia manualmente si hace falta.
- En `.env`, `AIR_QUALITY_LOCATIONS` debe ir entre comillas simples por ser JSON.
- El mapa base (OpenFreeMap Positron) requiere internet. Si el estilo no carga, el mapa muestra un aviso con opción de reintentar mientras la capa de datos sigue visible.
- No hay autenticación, programación de ingesta ni datos simulados de respaldo. Si no hay lecturas, la UI muestra el estado vacío a propósito.
- El servidor no expone secretos: el manejador global devuelve un `500` genérico. No registres el contenido de `.env` ni cadenas de conexión.
