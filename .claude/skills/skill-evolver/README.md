# skill-evolver

Discovery sub-loop for evolving Claude Code skills from transcripts.

## Install

```bash
cd ~/.claude/skills/skill-evolver
npm install
```

## Quick start

```bash
# Dry-run signal scan
node bin/skill-signal.cjs --mode=scan --dry-run

# Record signals and promote gaps
node bin/skill-signal.cjs --mode=scan
node bin/skill-gap.cjs --promote

# Harvest a promoted gap
node bin/skill-harvester.cjs --gap-id=gap_...

# Human gate
node bin/skill-evolver.cjs publish --harvest-id=harvest_...
```

## Documentation

- `SKILL.md` — Claude Code skill entry
- `LOOP.md` — loop configuration, cadence, gates, budget
- `AGENTS.md` — commands, tests, release process
- `docs/safety.md` — denylist, human gates, escalation
- `loop-constraints.md` — structured constraints
- `loop-budget.md` — budget caps and kill switches
- `loop-run-log.md` — run history

## Loop compliance

```bash
npm test
npx @cobusgreyling/loop-audit .
```

Current audit score: **100/100 (L3)**.
