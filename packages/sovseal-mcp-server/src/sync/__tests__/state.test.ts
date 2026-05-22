/**
 * state.test.ts — Phase 4 of NOMOREDELAY. Exercises the atomic
 * ~/.sovseal/state.json cursor: defaults on first read, round-trip,
 * tmp+rename atomicity invariant (no .tmp left behind on success).
 */

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  EMPTY_MERKLE_ROOT,
  initialState,
  loadState,
  resolveApiEndpoint,
  saveState,
} from "../state.js";

let dir = "";
let statePath = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sovseal-state-"));
  statePath = join(dir, "state.json");
});

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("sync/state", () => {
  test("loadState returns initialState on first read (no file)", async () => {
    const loaded = await loadState(statePath);
    const expected = initialState();
    expect(loaded.next_sequence_number).toBe(0);
    expect(loaded.local_merkle_root).toBe(EMPTY_MERKLE_ROOT);
    expect(loaded.last_synced_at).toBe(0);
    expect(loaded.api_endpoint).toBe(expected.api_endpoint);
  });

  test("saveState then loadState round-trips faithfully", async () => {
    const original = {
      next_sequence_number: 17,
      local_merkle_root: "a".repeat(64),
      last_synced_at: 1_700_000_000_000,
      api_endpoint: "http://example.test/v2",
    };
    await saveState(original, statePath);
    const loaded = await loadState(statePath);
    expect(loaded).toEqual(original);
  });

  test("saveState leaves no .tmp turd on success", async () => {
    await saveState(
      {
        next_sequence_number: 1,
        local_merkle_root: "b".repeat(64),
        last_synced_at: 1,
        api_endpoint: resolveApiEndpoint(),
      },
      statePath,
    );
    const entries = await readdir(dir);
    expect(entries).toContain("state.json");
    expect(entries.some((e) => e.endsWith(".tmp"))).toBe(false);
  });

  test("loadState tolerates partial JSON by backfilling defaults", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(statePath, JSON.stringify({ next_sequence_number: 42 }));
    const loaded = await loadState(statePath);
    expect(loaded.next_sequence_number).toBe(42);
    expect(loaded.local_merkle_root).toBe(EMPTY_MERKLE_ROOT);
    expect(loaded.last_synced_at).toBe(0);
  });
});
