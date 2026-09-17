# 0004 · Withdraw S3's evidence rather than delete the story

**Date.** 2026-09-17
**Status.** Decided

**Context.** S3 ("export my set list as a CSV my venue software reads") was built on one
fragment of W01's notes: `Easy to sync with projects`. That was read as meaning DJ
software, and the story was written with acceptance criteria naming Rekordbox and Serato.
The participant never said any of that. On checking, the real DJ-adjacent need was about
transitions between songs, and the meaning of "projects" was never recovered. The bad
story was already committed and pushed.

**Decision.** Keep S3 in the backlog, mark its evidence `WITHDRAWN 2026-09-17` with the
reason, and demote it from SHOULD to COULD. Add S11 for the actual claim. Fix it in a new
commit rather than rewriting the pushed one.

**Why not the alternative.** Deleting S3 would leave a cleaner file and a worse record.
The history of what got rejected is the thing being graded, and this is a textbook case of
inventing a requirement from an ambiguous note — worth being able to point at in December.
Rewriting the original commit would have needed a force-push and would have erased the
correction entirely.

**What would change my mind.** If the follow-up shows "projects" meant nothing
DJ-related, S3 has no path back to evidence and should be cut outright at that point.
