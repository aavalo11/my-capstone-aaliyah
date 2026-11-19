// A FAKE database for tests and scripts/create-link-dry-run.ts. TODO(W10): real data.
// In-memory stand-ins for the builds, links and link_tracks tables (architecture §4,
// supabase/migrations/20261119_links_builds.sql).

import type { BuildStatus, Db, Draft, SavedLink } from "../../supabase/functions/create-link/build.ts";

type Build = { id: string; owner_id: string | null; created_at: number; done: number; total: number; status: BuildStatus; draft: Draft | null };

export class FakeDb implements Db {
  builds = new Map<string, Build>();
  links: (SavedLink & { created_at: number })[] = [];
  progress: { done?: number; total?: number; status?: string }[] = [];
  fail: { buildTimesSince?: boolean; insertBuild?: boolean; saveLink?: boolean; saveDraft?: boolean; getBuild?: boolean } = {};
  onProgress?: (b: Build) => void;
  now: () => number = () => Date.now();

  // Seeded builds and links belong to `seedOwner` (the tests' signed-in sender by default).
  constructor(seedBuildTimes: number[] = [], seedOwner = "test-user") {
    seedBuildTimes.forEach((t, i) => this.builds.set("seed-" + i,
      { id: "seed-" + i, owner_id: seedOwner, created_at: t, done: 0, total: 0, status: "ok", draft: null }));
  }

  async buildTimesSince(ownerId: string, sinceMs: number) {
    if (this.fail.buildTimesSince) throw new Error("fake db down");
    return [...this.builds.values()].filter((b) => b.owner_id === ownerId && b.created_at > sinceMs).map((b) => b.created_at);
  }

  async insertBuild(id: string, ownerId: string, createdAtMs: number, total: number) {
    if (this.fail.insertBuild) throw new Error("fake db down");
    if (this.builds.has(id)) throw new Error("duplicate build id");
    this.builds.set(id, { id, owner_id: ownerId, created_at: createdAtMs, done: 0, total, status: "running", draft: null });
  }

  async updateBuild(id: string, fields: Partial<Pick<Build, "done" | "total" | "status">>) {
    const b = this.builds.get(id);
    if (!b) throw new Error("no such build");
    Object.assign(b, fields);
    this.progress.push({ ...fields });
    this.onProgress?.(b);
  }

  async saveDraft(id: string, draft: Draft) {
    if (this.fail.saveDraft) throw new Error("fake db down");
    const b = this.builds.get(id);
    if (!b) throw new Error("no such build");
    b.draft = structuredClone(draft);
    b.status = "matched";
    this.progress.push({ status: "matched" });
    this.onProgress?.(b);
  }

  async getBuild(id: string) {
    if (this.fail.getBuild) throw new Error("fake db down");
    const b = this.builds.get(id);
    return b ? { owner_id: b.owner_id, created_at: b.created_at, status: b.status, draft: b.draft ? structuredClone(b.draft) : null } : null;
  }

  async linksSince(ownerId: string, sinceMs: number) {
    return this.links.filter((l) => l.owner_id === ownerId && l.created_at > sinceMs).length;
  }

  async saveLink(link: SavedLink) {
    if (this.fail.saveLink) throw new Error("fake db down");
    if (this.links.some((l) => l.code === link.code)) throw new Error("duplicate code");
    this.links.push({ ...structuredClone(link), created_at: this.now() });
  }
}
