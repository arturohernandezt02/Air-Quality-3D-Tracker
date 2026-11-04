import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(serverRoot, "src", "db", "migrations");
const target = join(serverRoot, "dist", "db", "migrations");

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
console.info(`Copied SQL migrations to ${target}.`);
