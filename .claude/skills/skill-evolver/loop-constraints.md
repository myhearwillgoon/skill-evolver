# Loop Constraints — Skill-Evolver

## Denylist paths

The loop must not read or write:

- `~/.ssh/`
- `/etc/`
- Any file outside configured `transcript_dirs` and the current project root
- Existing active skill directories in `~/.claude/skills/` except via the human-gated `publish` command

## Allowed write paths

- `.claude/STATE.md`
- `.claude/skills/draft/<skill-name>/SKILL.md`
- `loop-run-log.md`
- Validation artifacts under `.claude/skills/draft/<skill-name>/.validation/`

## Push / merge rules

- No auto-push to GitHub.
- No auto-merge.
- All releases require a human-approved tag.

## Human gates

- Publish a skill: human approval.
- Reject a skill: human review with reason.
- Enable auto-harvest: human approval after 4-week evidence.
- Modify default thresholds: human approval.
- Disable kill switch after trip: human approval.

## No-progress / stall detection

- If a gap candidate is not promoted within `gap_ttl_hours` (default 168h), it expires automatically.
- If `consecutive_harvest_rejects` reaches 3, the circuit breaker opens.
- If the same signal appears repeatedly without new distinct tasks, it is deduplicated and not promoted.
