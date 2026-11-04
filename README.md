# Air Quality 3D Tracker

Proyecto de portafolio para explorar estimaciones horarias de calidad del aire con una API en Fastify, TimescaleDB y un mapa WebGL con React, MapLibre y Deck.gl.

Open-Meteo entrega estimaciones basadas en modelos, no mediciones directas de estaciones. La aplicación comienza con tres ubicaciones de ejemplo —Ciudad de México, Madrid y Buenos Aires— y muestra PM2.5, PM10, NO₂ y O₃.

## Arquitectura actual

- `server/`: API REST Fastify, acceso PostgreSQL con Kysely, ingesta bajo demanda desde Open-Meteo y esquema TimescaleDB.
- `client/`: aplicación React + Vite con estilos Tailwind, mapa base MapLibre y capas Hexagon/Heatmap de Deck.gl.
- `docker-compose.yml`: instancia local de TimescaleDB.

La capa Hexagon agrega las lecturas temporales de cada estación. Con las tres ubicaciones iniciales no hay cobertura espacial densa y las visualizaciones no interpolan valores entre estaciones.

La ingesta descarga 72 horas de datos (dos días anteriores y el día actual) para que el filtro de 48 horas esté cubierto desde la primera ejecución.

## Ejecutar localmente

Requisitos: Node.js 20 o posterior y Docker Desktop en ejecución.

1. Copia las variables de entorno de ejemplo y levanta TimescaleDB:

   ```powershell
   Copy-Item server\.env.example server\.env
   docker compose --env-file server\.env up -d timescaledb
   ```

2. Inicializa el esquema, descarga datos y arranca la API:

   ```powershell
   Push-Location server
   npm install
   npm run db:migrate
   npm run ingest
   npm run dev
   ```

3. En otra terminal, configura y arranca el cliente:

   ```powershell
   Copy-Item client\.env.example client\.env
   Push-Location client
   npm install
   npm run dev
   ```

Abre la URL que muestra Vite (por defecto `http://localhost:5173`). El proxy de desarrollo envía `/api` al servidor en `http://localhost:3000`. Si cambias el origen de la interfaz, ajusta `FRONTEND_ORIGIN` en `server/.env`. Para actualizar las lecturas guardadas, ejecuta `npm run ingest` desde `server/`.

## Interfaz

- Elige PM2.5, PM10, NO₂ u O₃.
- Filtra todas las estaciones o una ubicación y selecciona una ventana de 6, 24 o 48 horas.
- Alterna entre HexagonLayer 3D y HeatmapLayer.
- El mapa encuadra las estaciones con datos y ofrece un botón para recentrar; las métricas y la leyenda se actualizan con los filtros. Si el mapa base no carga, muestra un aviso con reintento.

Los mapas base usan el estilo Positron de OpenFreeMap y los datos de Open-Meteo. Para ejecución local se requiere acceso a internet para cargar ambos.

## Validar

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
