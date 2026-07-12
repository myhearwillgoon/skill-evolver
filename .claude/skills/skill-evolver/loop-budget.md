# Skill-Evolver Loop Budget

## Daily caps

| Resource | Cap | Action at 80% | Action at 100% |
|----------|-----|---------------|----------------|
| Signals recorded per run | 50 | warn | hard stop |
| Open gap candidates | 10 | warn | pause promotion |
| Harvests per run | 1 | n/a | n/a |
| Verifier calls per run | 5 | warn | hard stop |
| Verifier timeout | 10 min | kill | kill |
| Consecutive rejected harvests | 3 | warn | circuit breaker OPEN |

## Kill switches

Set any of these to `true` in `STATE.md` to stop the corresponding component:

```yaml
skill_evolver:
  disabled: true
skill_signal:
  disabled: true
skill_harvester:
  disabled: true
```

## Cost guardrails

- Signal scanning only reads local JSONL transcripts; no API cost.
- Harvester runs `claude-verify` locally; verifier cost is local compute only.
- Embedding is local n-gram/minhash; no external embedding API.
- If an external MCP is added later, it must declare its own per-call budget here.

## Recovery

When a cap is hit:

1. Log the event in `loop-run-log.md`.
2. Update `STATE.md` with the reason.
3. Require human review before resetting counters or re-enabling the loop.
