// POST { q } → { songs: [...] }, up to 10 Spotify tracks for the edit screen (ADR 0029).
import { serve } from "../create-link/server.ts";
import { searchSongs } from "../create-link/build.ts";
serve((body, deps) => searchSongs(body, deps));
