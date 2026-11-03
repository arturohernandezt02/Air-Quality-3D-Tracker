# Air Quality Tracker client

Interfaz en React + TypeScript con Vite y Tailwind CSS. MapLibre proporciona el mapa base; Deck.gl renderiza HexagonLayer 3D y HeatmapLayer sobre las lecturas servidas por la API.

## Desarrollo local

Desde la raíz del proyecto:

```powershell
Copy-Item client\.env.example client\.env
Push-Location client
npm install
npm run dev
```

El proxy de Vite envía `/api` y `/health` a `http://localhost:3000`. Cambia `VITE_PROXY_TARGET` en `client/.env` si Fastify escucha en otro origen. Puedes establecer `VITE_API_BASE_URL` para apuntar a la base `/api/v1` de un servidor remoto.

El tablero incluye filtros de contaminante, estación y rango de 6, 24 o 48 horas, y un selector entre las capas Hexagon y Heatmap. Requiere que Fastify esté activo y que haya observaciones guardadas; no usa datos falsos como fallback.

El mapa base carga el estilo Positron de OpenFreeMap; se necesita conexión a internet para ver los tiles.

Consulta el [README del proyecto](../README.md) para levantar TimescaleDB, aplicar la migración y ejecutar la ingesta.
