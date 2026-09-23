import path from "node:path";
import fs from "node:fs";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const STORE_PATH = path.join(DATA_DIR, "store.json");

export function ensureDataDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function filePath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}
