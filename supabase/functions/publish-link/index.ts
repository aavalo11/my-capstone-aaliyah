// POST { build_id, title, remove, add } → { code, report } (ADR 0029, R1 steps 8–9).
import { serve } from "../create-link/server.ts";
import { publishLink } from "../create-link/build.ts";
serve((body, deps) => publishLink(body, deps));
