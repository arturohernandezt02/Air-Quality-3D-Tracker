import "dotenv/config";
import { createApp } from "./app.js";
import { createDatabase } from "./db/database.js";
import { KyselyAirQualityRepository } from "./db/repository.js";

const database = createDatabase();
const app = createApp(new KyselyAirQualityRepository(database));
app.addHook("onClose", async () => {
  await database.destroy();
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

try {
  await app.listen({ port, host });
} catch (error) {
  await app.close();
  throw error;
}
