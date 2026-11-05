// A FAKE database for tests and scripts/create-link-dry-run.ts. TODO(W10): real data.
// In-memory stand-ins for the builds, links and link_tracks tables (architecture §4).

import type { Db, SavedLink } from "../../supabase/functions/create-link/build.ts";

type Build = { id: string; created_at: number; done: number; total: number; status: "running" | "ok" | "failed" };

export class FakeDb implements Db {
  builds = new Map<string, Build>();
  links: SavedLink[] = [];
  progress: { done?: number; total?: number; status?: string }[] = [];
  fail: { buildTimesSince?: boolean; insertBuild?: boolean; saveLink?: boolean } = {};
  onProgress?: (b: Build) => void;

  constructor(seedBuildTimes: number[] = []) {
    seedBuildTimes.forEach((t, i) => this.builds.set("seed-" + i, { id: "seed-" + i, created_at: t, done: 0, total: 0, status: "ok" }));
  }

  async buildTimesSince(sinceMs: number) {
    if (this.fail.buildTimesSince) throw new Error("fake db down");
    return [...this.builds.values()].filter((b) => b.created_at > sinceMs).map((b) => b.created_at);
  }

  async insertBuild(id: string, createdAtMs: number, total: number) {
    if (this.fail.insertBuild) throw new Error("fake db down");
    if (this.builds.has(id)) throw new Error("duplicate build id");
    this.builds.set(id, { id, created_at: createdAtMs, done: 0, total, status: "running" });
  }

  async updateBuild(id: string, fields: Partial<Pick<Build, "done" | "total" | "status">>) {
    const b = this.builds.get(id);
    if (!b) throw new Error("no such build");
    Object.assign(b, fields);
    this.progress.push({ ...fields });
    this.onProgress?.(b);
  }

  async saveLink(link: SavedLink) {
    if (this.fail.saveLink) throw new Error("fake db down");
    if (this.links.some((l) => l.code === link.code)) throw new Error("duplicate code");
    this.links.push(structuredClone(link));
  }
}
