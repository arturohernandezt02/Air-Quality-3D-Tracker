# AGENTS.md

Guía para agentes que trabajen en **Air Quality 3D Tracker**.

## Descripción general

Monorepo con dos paquetes independientes (no hay workspace raíz ni `package.json` en la raíz):

- `server/`: API REST con Fastify 5, Kysely y PostgreSQL/TimescaleDB. Ingiere datos horarios de la API Air Quality de Open-Meteo.
- `client/`: SPA con React 19, Vite, Tailwind CSS 4, MapLibre GL y Deck.gl (HexagonLayer 3D y HeatmapLayer).
- `docker-compose.yml`: stack completo con TimescaleDB, migración, API y cliente nginx. Los Dockerfiles viven en `server/` y `client/`.

Los datos son **estimaciones modeladas** de Open-Meteo para un catálogo global de 71 ciudades por defecto, no mediciones de estaciones físicas. La cobertura es dispersa y no se interpola entre ubicaciones. `AIR_QUALITY_LOCATIONS` permite reemplazar el catálogo.

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
| `npm run db:migrate` | Aplicar todas las migraciones SQL en orden (requiere la base de datos activa) |
| `npm run ingest` | Ejecución manual de ingesta; el servidor también la programa automáticamente |

### Client (`client/`)

| Comando | Uso |
| --- | --- |
| `npm install` | Instalar dependencias |
| `npm run dev` | Vite en `http://localhost:5173` con proxy a la API |
| `npm run build` | `tsc -b && vite build` |
| `npm test` | Tests de helpers puros con Vitest |
| `npm run lint` | `oxlint` |
| `npm run preview` | Servir el build de producción |

### Docker (raíz)

| Comando | Uso |
| --- | --- |
| `docker compose up --build` | Stack completo en `http://localhost:8080` (interfaz) y `http://localhost:3000` (API) |
| `docker compose build` | Construir las imágenes de API y cliente sin arrancarlas |
| `docker compose down` | Detener el stack (`-v` borra también el volumen de datos) |
| `docker compose config` | Validar el archivo Compose |

### Validación antes de terminar un cambio

```powershell
Push-Location server
npm run build
npm test
Pop-Location

Push-Location client
npm run build
npm test
npm run lint
Pop-Location
```

La CI de GitHub Actions (`.github/workflows/ci.yml`) ejecuta la validación de ambos paquetes en cada push a `main` y en cada pull request, además de construir las imágenes Docker y validar el compose. No hay tests end-to-end.

## Entorno local

Requisitos: Node.js 20 o posterior y Docker Desktop iniciado.

```powershell
Copy-Item server\.env.example server\.env
docker compose --env-file server\.env up -d timescaledb

Push-Location server
npm install
npm run db:migrate
npm run dev
Pop-Location

Copy-Item client\.env.example client\.env
Push-Location client
npm install
npm run dev
Pop-Location
```

Como alternativa, `docker compose up --build` levanta TimescaleDB, aplica las migraciones y arranca la API y el cliente sin instalar Node localmente.

Variables relevantes:

- `server/.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `FRONTEND_ORIGIN` (lista separada por comas), `AIR_QUALITY_LOCATIONS` (JSON opcional; reemplaza el catálogo global de 71 ciudades), `INGEST_INTERVAL_MINUTES` (por defecto 60; `0` desactiva la ingesta periódica), `INGEST_ON_STARTUP` (por defecto `true`), `INGEST_STALE_AFTER_MINUTES` (umbral de frescura; por defecto `max(180, 2 × intervalo)`), `PORT`, `HOST` y opcionalmente `DATABASE_URL` para sobrescribir la conexión.
- `client/.env`: `VITE_API_BASE_URL` (por defecto `/api/v1`) y `VITE_PROXY_TARGET` (por defecto `http://localhost:3000`).
- Los archivos `.env` están en `.gitignore`; nunca los commitees ni expongas secretos.

## Arquitectura

### Server

Flujo de arranque: `src/index.ts` carga `.env`, crea la instancia de Kysely (`db/database.ts`), la envuelve en `KyselyAirQualityRepository`, llama a `createApp()` (`app.ts`) con `checkDatabaseConnection` como readiness y arranca el planificador de ingesta (`services/ingestion-scheduler.ts`). El cierre de Fastify detiene el planificador, espera la ingesta activa y destruye el pool de la base de datos; `SIGINT`/`SIGTERM` disparan un apagado ordenado (una sola vez) que sale con código 0 o 1.

- `src/app.ts`: `createApp(repository, now, options)` recibe el repositorio, el reloj y las opciones (`checkReadiness`, `staleAfterMinutes`) por inyección de dependencias para facilitar los tests. Configura CORS con `FRONTEND_ORIGIN`, `GET /health` (liveness), `GET /ready` (readiness con `SELECT 1`; `503 NOT_READY` si la base de datos falla), el prefijo `/api/v1` y un manejador de errores que convierte fallos de validación en `400 INVALID_QUERY` y el resto en un `500` genérico sin filtrar detalles internos.
- `src/routes/api-v1.ts`: define `GET /stations`, `GET /metrics` y `GET /freshness`. `from`/`to` deben ser RFC 3339 con zona horaria y enviarse juntos; por defecto se consultan las últimas 24 h. El intervalo es `[from, to)`. La respuesta es `{ data, meta }` (o `{ data }` en stations/freshness) y los errores `{ error: { code, message } }`. Cada lectura de `/metrics` incluye `aqi` con el índice europeo consolidado y los subíndices por contaminante. Freshness calcula `ageMinutes` desde `lastIngestedAt` y marca `isStale` cuando falta una ingesta exitosa o supera `staleAfterMinutes`.
- `src/db/repository.ts`: interfaz `AirQualityRepository` (`listStations`, `listMetrics`, `getFreshness`) e implementación con Kysely. Mantén las rutas dependiendo de la interfaz, no de Kysely directamente.
- `src/db/database.ts`: crea el pool de `pg` con `connectionTimeoutMillis: 5_000` y exporta `checkDatabaseConnection`, que ejecuta `SELECT 1` para el endpoint `/ready`.
- `src/db/types.ts`: tipos de las tablas para Kysely.
- `src/db/migrate.ts` + `src/db/migrations/*.sql`: `migrate` aplica todos los `.sql` en orden alfabético; son idempotentes. `001` crea `stations`, `air_quality_readings` como hypertable de TimescaleDB e índice por estación/tiempo. `002` crea `ingestion_status` (singleton con último intento, último éxito, error y conteos). Para cambios de esquema, añade una migración nueva en lugar de reescribir una existente. `npm run build` copia los `.sql` a `dist/db/migrations` mediante el script `postbuild`, de modo que `node dist/db/migrate.js` funciona sin `tsx`.
- `src/services/open-meteo.ts`: construye peticiones a Open-Meteo (UTC, unixtime, 72 h: dos días anteriores y el día actual), valida estrictamente el JSON y lo convierte a `HourlyObservation[]`. `buildAirQualityUrlBatch` envía varias coordenadas en una sola petición y `parseBatchObservations` mapea la respuesta por el orden solicitado. Las 72 h garantizan que la ventana de 48 h del cliente esté cubierta desde la primera ingesta.
- `src/services/aqi.ts`: cálculo del índice europeo de calidad del aire (EAQI) con los umbrales horarios revisados por la EEA en 2024. Interpola cada contaminante, redondea los subíndices y usa el mayor como valor consolidado; los valores superiores a 100 quedan en `extremely_poor`. No requiere base de datos y se prueba con `aqi.test.ts`.
- `src/services/ingestion.ts`: lógica reutilizable de ingesta. Divide las ubicaciones en lotes de 25 coordenadas, descarga todos los lotes y luego upsertea estaciones y lecturas en una única transacción; actualiza `ingestion_status` al final. Si falla, registra el intento fallido sin borrar el último éxito y no deja datos parciales. Reejecutar la ingesta no duplica filas (clave `station_id, observed_at`).
- `src/services/ingest.ts`: entrada CLI de `npm run ingest`; crea la base y llama a `ingestAirQualityData`.
- `src/services/ingestion-scheduler.ts`: bucle `setTimeout` sin dependencias externas. Evita solapamientos, registra resultados con el logger de Fastify y expone `stop()` para el apagado ordenado. No se ejecuta en los tests de `createApp`.
- `src/config/ingestion.ts`: valida `INGEST_INTERVAL_MINUTES`, `INGEST_ON_STARTUP` y `INGEST_STALE_AFTER_MINUTES`.
- `src/config/locations.ts` + `src/config/locations-data.ts`: catálogo global por defecto o `AIR_QUALITY_LOCATIONS`; valida ids tipo slug, unicidad y rangos de latitud/longitud. `index.ts` registra cuántas ubicaciones se cargaron.

### Client

- `src/App.tsx`: estado de filtros (contaminante o índice AQI, estación, ventana de 6/24/48 h y capa), línea de tiempo horaria con reproducción (play/pausa, arrastre, velocidad y vuelta a «Ahora»), panel de resumen con subíndices AQI por contaminante y contaminante dominante, indicador de frescura, búsqueda de ciudad, panel de detalle de estación y tarjeta para compartir. El mapa se carga con `React.lazy`.
- `src/hooks/useAirQualityData.ts`: consulta `stations`, `metrics` y `freshness` en paralelo con `AbortController`, valida las respuestas en el límite de la API (incluido el objeto `aqi`), se refresca automáticamente cada 5 minutos y expone `{ stations, readings, freshness, isLoading, error, updatedAt, refresh }`. No usa datos de respaldo.
- `src/lib/timeline.ts`, `sparkline.ts`, `readings.ts` y `filter-stations.ts`: helpers puros para agrupar lecturas por hora, dibujar la serie del panel de detalle, calcular resúmenes y filtrar ciudades por nombre o país (sin acentos). Tienen tests con Vitest.
- `src/lib/aqi.ts`: etiquetas, colores y estilos de las categorías EAQI, además de la paleta y la escala de la leyenda. La categoría se deriva del valor numérico; no duplica el cálculo del servidor.
- `src/types/air-quality.ts`: contrato de tipos, `AirQualityFreshness`, `AirQualityAqi`, `MetricKey`, `METRIC_KEYS`, `DisplayMetric`, `METRIC_OPTIONS`, `DISPLAY_METRIC_OPTIONS` y unidades (µg/m³; el AQI usa la escala EAQI).
- `src/components/AirQualityMap.tsx`: mapa MapLibre + Deck.gl. Ajusta la cámara a las estaciones solo cuando cambia el conjunto de ubicaciones (no en cada refresco de datos), incluye un botón «Centrar» y muestra un aviso con reintento si el estilo base no carga. Dibuja marcadores seleccionables y alterna HexagonLayer/HeatmapLayer con transiciones al cambiar de hora. Con AQI usa su propia paleta y un dominio fijo de 0-100 para que los colores coincidan con la leyenda. La importación `maplibre-gl/dist/maplibre-gl-worker.mjs?url` junto con `setWorkerUrl` es necesaria para el worker; no la elimines.
- `src/components/TimelineControls.tsx`, `StationCombobox.tsx`, `StationDetail.tsx` y `ShareButton.tsx`: barra de reproducción, selector accesible de ciudad, panel lateral con sparkline y tarjeta PNG generada con `html-to-image` (Web Share o descarga).
- `vite.config.ts`: proxy de `/api` y `/health` hacia Fastify; `optimizeDeps.exclude` para `maplibre-gl` es intencional. `vitest.config.ts` ejecuta solo los tests de `src/lib`.

### Flujo de datos

`Open-Meteo (lotes de 25) → scheduler/ingest manual (upsert transaccional) → TimescaleDB (readings + ingestion_status) → API Fastify /api/v1 → hook del cliente (polling 5 min) → línea de tiempo → App/Deck.gl`

### Docker y CI

- `server/Dockerfile`: build multi-stage con Node 22 Alpine. Compila TypeScript, elimina las devDependencies y ejecuta `dist/index.js` como usuario `node`.
- `server/scripts/copy-migrations.mjs`: se ejecuta en `postbuild` y copia los `.sql` a `dist/db/migrations`.
- `client/Dockerfile` + `client/nginx.conf`: compila la SPA y la sirve con nginx. En Compose, nginx proxya `/api`, `/health` y `/ready` hacia `server:3000`.
- `docker-compose.yml`: `migrate` es un servicio de un solo uso que arranca tras el healthcheck de TimescaleDB; `server` espera a que termine y `client` espera a que `server` esté healthy. Los valores por defecto permiten `docker compose up --build` sin `.env`; `server/.env` se carga con un `env_file` opcional.
- `.github/workflows/ci.yml`: tres jobs (servidor, cliente y Docker) con Node 22; el job del cliente ejecuta build, tests y lint, y el de Docker construye ambas imágenes con caché de GitHub Actions y valida el compose.

## Convenciones de código

- TypeScript estricto en ambos paquetes. El servidor usa ESM con `module: NodeNext`: los imports relativos deben terminar en `.js` (aunque el archivo fuente sea `.ts`). El cliente usa resolución `bundler` y no lleva extensión en los imports.
- El servidor usa `type` imports, top-level await y nombres de identificadores en inglés. Los mensajes de la API están en inglés; la interfaz y los textos visibles del cliente están en español.
- Mantén la separación de capas: rutas → interfaz de repositorio → Kysely → SQL. No metas consultas SQL en las rutas.
- Añade tests del servidor como `src/**/*.test.ts` con `node:test` y `app.inject`, usando repositorios falsos. No requieren base de datos. Los tests actuales cubren rutas, validación, CORS, parsing de Open-Meteo (incluidos lotes), cálculo del EAQI, configuración de ubicaciones e ingesta, y el planificador con una función de ingesta inyectada. Los helpers puros del cliente se prueban con Vitest en `src/lib/*.test.ts`.
- Valida datos externos en el borde (Open-Meteo y respuestas HTTP del cliente) antes de confiar en su forma.
- Sin `any` implícito; respeta `noUnusedLocals`/`noUnusedParameters` del cliente (el build falla con variables sin usar).
- Estilos con clases utilitarias de Tailwind inline; los estilos globales viven en `src/App.css` e `src/index.css`.
- Formato de respuesta de API: éxito `{ data, meta? }`; error `{ error: { code, message } }`. Fechas en ISO 8601 UTC.
- Commits con Conventional Commits, p. ej. `feat(server): ...`, `fix(client): ...`.

## Notas y trampas

- `db:migrate`, `ingest` y el planificador fallan si TimescaleDB no está levantado. La ingesta necesita internet y ahora descarga las 71 ubicaciones en tres lotes; un lote lento o un fallo HTTP aborta la ejecución completa. Si falla una ingesta programada, el servidor sigue sirviendo lecturas y registra el error en logs y en `ingestion_status`.
- El servicio `migrate` de Compose se ejecuta en cada `docker compose up`; las migraciones son idempotentes. El contenedor de la API no migra automáticamente al arrancar.
- El planificador corre dentro del proceso de la API: solo ingiere mientras el servidor está encendido y no coordina múltiples instancias. Ejecuta una sola instancia con ingesta activa o usa `INGEST_INTERVAL_MINUTES=0` e `INGEST_ON_STARTUP=false` en las demás.
- Cambiar `AIR_QUALITY_LOCATIONS` no elimina estaciones antiguas de la base de datos; solo reingiere las nuevas. Actualiza el esquema o limpia manualmente si hace falta.
- En `.env`, `AIR_QUALITY_LOCATIONS` debe ir entre comillas simples por ser JSON.
- El mapa base (OpenFreeMap Positron) requiere internet. Si el estilo no carga, el mapa muestra un aviso con opción de reintentar mientras la capa de datos sigue visible.
- No hay autenticación ni datos simulados de respaldo. Si no hay lecturas, la UI muestra el estado vacío a propósito; si no hay ingesta registrada, la frescura aparece como desactualizada.
- El servidor no expone secretos: el manejador global devuelve un `500` genérico. No registres el contenido de `.env` ni cadenas de conexión.
