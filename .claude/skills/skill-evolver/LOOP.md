# Skill-Evolver Loop Configuration

A discovery sub-loop that detects missing or inadequate Claude Code skills from transcripts, clusters them into gap candidates, and drafts candidate `SKILL.md` files for human approval.

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Signal scan | 1d | L1 report-only | `/loop 1d /skill-evolver signal --mode=scan --dry-run` |
| Gap promotion | 1d | L1 report-only | `/loop 1d /skill-evolver signal --mode=promote` |
| Manual harvest | On-demand | L2 with human gate | `/skill-evolver harvester --gap-id=...` |
| Auto-harvest | Weekly (gated) | L3 after L2 proven | `/loop 7d /skill-evolver harvester --auto --max-harvests=1` |

## Human Gates

1. **Publish**: Only a human can move a draft skill to `~/.claude/skills/`.
2. **Reject**: A human must review and provide a reason for rejected harvests.
3. **Auto-harvest enable**: Do not enable until 4 weeks of report-only data shows precision ≥60%.
4. **Threshold changes**: Any change to `skill-evolver.config.yaml` defaults requires human review.

## Worktrees

- L1 signal/gap operations are read-only on transcripts and `STATE.md`; no worktree required.
- L2+ harvester that writes to a project should use `isolation: worktree` if it mutates project files beyond `.claude/skills/draft/`.

## Connectors (MCP)

- **L1/L2**: No MCP required. skill-evolver reads local Claude Code transcripts and `STATE.md`.
- **Optional L3**: GitHub MCP may be used to correlate gaps with open issues/PRs; scope limited to read-only.

## Budget

See `loop-budget.md`.

- Max signals recorded per run: 50
- Max open gap candidates: 10
- Max harvests per run: 1
- Verifier timeout per harvest: 10 minutes
- Daily token guardrails: enforced by skills-verifier's own budget

## Safety & Auto-Merge Policy

- **Never auto-publish** a skill.
- **Never overwrite** an existing active skill.
- **Never read** outside configured `transcript_dirs` or project `STATE.md`.
- **No auto-merge**; all loop-generated changes go through human review.
- Kill switches: `skill_evolver.disabled`, `skill_harvester.disabled`, `skill_signal.disabled`.
- Circuit breaker: 3 consecutive rejected harvests pauses auto-harvest and escalates to human.

## Escalation Path

If the loop is stuck, produces repeated failures, or hits budget/circuit breaker:

1. Set `skill_evolver.disabled: true` in `STATE.md`.
2. Review `loop-run-log.md` and latest `STATE.md`.
3. Open a human task to tune thresholds or harvester prompt.

## Links

- Safety: `docs/safety.md`
- Budget: `loop-budget.md`
- Constraints: `loop-constraints.md`
- Run log: `loop-run-log.md`
