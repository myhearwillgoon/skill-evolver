# Safety Policy — Skill-Evolver

## Denylist: actions the loop must never take

1. **Never auto-publish a skill.** Only the human-gated `publish` command may move a draft to `~/.claude/skills/`.
2. **Never overwrite an existing active skill.** If a skill name collides, abort and escalate.
3. **Never modify files outside the project root** except reading configured transcript directories.
4. **Never execute destructive shell commands** (`rm -rf`, `mkfs`, `dd`, etc.). The loop only reads transcripts and writes to `.claude/skills/draft/` and `STATE.md`.
5. **Never exfiltrate data.** All similarity computation is local; no external embedding API is used.
6. **Never disable or bypass verifier.** Every harvested skill must pass through `skills-verifier` L1/L2/L3 before human review.

## MCP / connector scope

- **L1/L2 (default):** No MCP required. skill-evolver reads local files only.
- **Optional L3:** GitHub MCP may be used to read issues/PRs; write scope is denied.
- Each MCP tool must be declared in `AGENTS.md` and reviewed before activation.

## Human gates

| Action | Required gate |
|--------|---------------|
| Record signals | Automatic (report-only by default) |
| Promote gap | Automatic, gated by thresholds |
| Harvest skill | Manual by default; auto only after 4-week evidence review |
| Publish skill | Human approval required |
| Reject skill | Human review required |
| Change thresholds | Human review required |

## Escalation path

If the loop:

- Hits 3 consecutive rejected harvests,
- Exceeds budget caps,
- Encounters repeated verifier failures,
- Detects a denylist violation,

Then:

1. Set `skill_evolver.disabled: true`.
2. Record the event in `loop-run-log.md`.
3. Escalate to a human with the latest `STATE.md` and `loop-run-log.md`.

## Auto-merge policy

There is no auto-merge. All loop outputs remain in `STATE.md`, `.claude/skills/draft/`, or logs until a human approves publish.
