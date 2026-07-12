# AGENTS.md — Skill-Evolver

## What is this project?

Skill-Evolver is a discovery sub-loop for Claude Code. It scans transcripts for implicit signals of missing or under-performing skills, clusters them into gap candidates, and drafts candidate `SKILL.md` files. It hands off to `skills-verifier` for L1/L2/L3 validation and requires a human gate before publishing.

## Quick commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Dry-run signal scan
node bin/skill-signal.cjs --mode=scan --dry-run

# Record signals and promote gaps
node bin/skill-signal.cjs --mode=scan
node bin/skill-gap.cjs --promote

# Harvest a specific gap
node bin/skill-harvester.cjs --gap-id=gap_...

# Human gate
node bin/skill-evolver.cjs publish --harvest-id=harvest_...
node bin/skill-evolver.cjs reject  --harvest-id=harvest_... --reason="..."

# Loop compliance check
npx @cobusgreyling/loop-audit .
```

## Test expectations

- All signal detectors must have unit tests in `tests/`.
- `npm test` must pass before any PR is merged.
- A smoke test runs the signal scan on a synthetic transcript.

## Release process

1. Update `version` in `package.json` and `SKILL.md` frontmatter.
2. Run `npm test` and `npx @cobusgreyling/loop-audit .`.
3. Commit changes.
4. Tag release: `git tag v<version>`.
5. Push to `origin`.

## Review norms

- All changes go through a PR.
- Use `loop-verifier` agent as checker for L2+ changes.
- Do not merge if `loop-audit` score drops below 70.
- Never allow the loop to publish skills without human approval.

## Allowed tools / MCP scope

- File read: transcripts, `STATE.md`, `AGENTS.md`, existing `SKILL.md` files.
- File write: `.claude/skills/draft/`, `STATE.md`, `loop-run-log.md`.
- Subprocess: `node`, `claude-verify` (skills-verifier).
- No external network calls required for L1/L2.
