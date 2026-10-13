import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Snapshot } from "../dados/tipos";

let cache: Snapshot | null = null;
export function lerSnapshot(): Snapshot {
  if (!cache) {
    const p = resolve(__dirname, "../../public/data/snapshot.json");
    cache = JSON.parse(readFileSync(p, "utf-8")) as Snapshot;
  }
  return cache;
}
