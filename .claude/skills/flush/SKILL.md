---
name: flush
description: File the durable material from this session into the repo before context is lost. Use at the end of a working session, when the user says "flush", or before a long-running session wraps up. Writes notes; never commits.
---

# Flush

Read back over this session and file what a future session would need. Then stop.

You are not summarising the conversation. You are answering one question about
each candidate fact: **would a future session make a worse decision, or repeat
work already done, without this?** If no, drop it. Volume is failure.

## Keep

- **Decisions and their reasoning** — including decisions *not* to do something,
  and decisions deferred with the reason they were deferred.
- **Negative knowledge** — approaches tried that failed, and why. This is the
  highest-value category and the easiest to lose.
- **Operational gotchas** — rate limits, blocked endpoints, workarounds, exact
  flags or paths that took effort to find.
- **Open questions** the session surfaced but did not resolve.

## Drop

- Anything derivable from the files, `git log`, or `CLAUDE.md`.
- Narration of what happened ("committed X", "the test passed").
- Restatements of things already written down this session.

## Routing

| Material | Destination |
|---|---|
| An architectural decision with alternatives and consequences | Propose a new `docs/adr/NNNN-*.md` — do not write it; say what it would contain |
| Product/user research finding, with a source URL | `research/` |
| A settled constraint that changes how the project gets built | Propose a `CLAUDE.md` edit — do not apply it |
| Everything else worth keeping | The unfiled note (below) |

When routing is not obvious, **do not guess and do not discard**. Put it in the
unfiled note with a one-line reason it was kept. Wrong location is recoverable;
silent loss is not.

## The unfiled note

Write to `docs/notes/session-<YYYY-MM-DD>.md`. If a file for today exists,
**append** to it under a new `## <HH:MM>` heading.

Create `docs/notes/` if it does not exist. Create nothing else. If material
belongs somewhere that does not exist yet (`CONTEXT.md`, `docs/agents/`,
`.scratch/`), write it to the unfiled note and state which folder it *would*
have used. **Never scaffold a directory the project has not chosen** — this
project has twice declined folders that looked obviously useful.

## Refuse

- **Secrets.** Never write a credential, key, token, or connection string, even
  one that appeared in this session. Reference it by name only.
- **Unverified claims as settled facts.** If the session concluded something it
  did not verify, file it under `## Open questions`, never as a finding.
  Hardening a guess into a fact is the worst failure mode here.
- **Overwriting human-written content.** Append or propose. Never rewrite or
  restructure a file a person authored.
- **Contradicting an ADR silently.** If material conflicts with a decision in
  `docs/adr/`, say so explicitly and cite the ADR number.

## Never commit

Write the note, then stop. Do not `git add`, `git commit`, `git push`, or amend.
This repo is public; the human decides what becomes public and when.

## Finish

Report in three lines or fewer: what you filed, what you deliberately dropped,
and anything you could not route. Then stop — do not offer to commit it.
