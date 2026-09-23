import fs from "node:fs";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ReferenceDocument,
  type StoreShape,
  type VerificationRecord,
} from "./types";
import { STORE_PATH, ensureDataDirs } from "./paths";

function emptyStore(): StoreShape {
  return {
    references: [],
    verifications: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    seq: { verification: 10000, reference: 0 },
  };
}

function readStore(): StoreShape {
  ensureDataDirs();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = emptyStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as StoreShape;
  parsed.references ||= [];
  parsed.verifications ||= [];
  parsed.settings ||= structuredClone(DEFAULT_SETTINGS);
  parsed.settings.weights = { ...DEFAULT_SETTINGS.weights, ...parsed.settings.weights };
  parsed.settings.rules = { ...DEFAULT_SETTINGS.rules, ...parsed.settings.rules };
  parsed.seq ||= { verification: 10000, reference: 0 };
  return parsed;
}

function writeStore(store: StoreShape) {
  ensureDataDirs();
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

export function withStore<T>(fn: (store: StoreShape) => T): T {
  const store = readStore();
  const result = fn(store);
  writeStore(store);
  return result;
}

export function getStore(): StoreShape {
  return readStore();
}

export function nextVerificationId(store: StoreShape): string {
  store.seq.verification += 1;
  return `VER-${store.seq.verification}`;
}

export function nextReferenceVersion(store: StoreShape): number {
  store.seq.reference += 1;
  return store.seq.reference;
}

export function getActiveReference(store: StoreShape): ReferenceDocument | undefined {
  return store.references.find((r) => r.active) ?? store.references.at(-1);
}

export function getSettings(): AppSettings {
  return getStore().settings;
}

export function saveVerification(record: VerificationRecord) {
  withStore((store) => {
    const idx = store.verifications.findIndex((v) => v.id === record.id);
    if (idx >= 0) store.verifications[idx] = record;
    else store.verifications.unshift(record);
  });
}

export function getVerification(id: string): VerificationRecord | undefined {
  return getStore().verifications.find((v) => v.id === id);
}
