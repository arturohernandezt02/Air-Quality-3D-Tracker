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

El tablero incluye filtros de contaminante, una búsqueda de ciudad con autocompletado, el rango de 6, 24 o 48 horas y un selector entre las capas Hexagon y Heatmap. Una línea de tiempo permite reproducir la ventana hora a hora; al hacer clic en una estación se abre un panel con su serie temporal y métricas, y el botón de compartir genera una tarjeta PNG. Requiere que Fastify esté activo y que haya observaciones guardadas; no usa datos falsos como fallback.

## Tests

```powershell
npm test
```

Vitest ejecuta las pruebas de los helpers puros en `src/lib/` (línea de tiempo, sparkline, filtros y cálculos de resumen). No requieren navegador ni una API activa.

El mapa base carga el estilo Positron de OpenFreeMap; se necesita conexión a internet para ver los tiles.

## Docker

El `Dockerfile` compila la SPA y la sirve con nginx. Dentro del stack completo (`docker compose up --build` desde la raíz), nginx proxya `/api`, `/health` y `/ready` hacia el servicio `server` y la interfaz queda en `http://localhost:8080`. `VITE_API_BASE_URL` se pasa como argumento de build y por defecto es `/api/v1`.

Consulta el [README del proyecto](../README.md) para levantar TimescaleDB, aplicar la migración y ejecutar la ingesta.
