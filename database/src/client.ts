import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find the database package root by walking up until we find package.json
let packageRoot = __dirname;
while (packageRoot !== '/' && !fs.existsSync(path.join(packageRoot, "package.json"))) {
  packageRoot = path.resolve(packageRoot, "..");
}

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const databasePath = isTest
  ? ":memory:"
  : (process.env.DATABASE_URL ?? path.resolve(packageRoot, "data/ai-workflow.sqlite"));

export const sqlite = new Database(databasePath);
export const db = drizzle(sqlite);
export { databasePath };

export interface DatabaseStatus {
  connected: boolean;
  database_path: string;
  size_bytes: number;
  timestamp: string;
}

export function getDatabaseFileStatus(): DatabaseStatus {
  try {
    const stats = fs.statSync(databasePath);
    return {
      connected: true,
      database_path: databasePath,
      size_bytes: stats.size,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      database_path: databasePath,
      size_bytes: 0,
      timestamp: new Date().toISOString()
    };
  }
}
