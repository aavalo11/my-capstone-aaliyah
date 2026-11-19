// POST { link, build_id } → { build_id, report, publishable } (ADR 0029, R1 steps 2–7).
import { serve } from "../create-link/server.ts";
import { matchPlaylist } from "../create-link/build.ts";
serve((body, deps) => matchPlaylist(body, deps));
