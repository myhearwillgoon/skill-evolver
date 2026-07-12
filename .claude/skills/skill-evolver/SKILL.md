---
name: skill-evolver
description: Discovery sub-loop that detects missing skills from Claude Code transcripts, clusters them into gaps, and drafts candidate SKILL.md files for human approval.
type: workflow
author: skill-evolver
version: 1.0.0
allowed_tools:
  - Read
  - Write
  - Bash
  - Edit
allowed_mcp: []
---

# skill-evolver

Discovery sub-loop designed to sit next to `skills-verifier` (validation sub-loop).
It scans transcripts for implicit signals of missing or under-performing skills,
clusters signals into gap candidates, and drafts new `SKILL.md` files.
Nothing is published without a human approval gate.

## When to invoke

Run inside a project git repository that has a `.claude/STATE.md` file.

```bash
# Scan recent transcripts for implicit signals (dry-run)
/skill-evolver signal --mode=scan --dry-run

# Record detected signals to STATE.md
/skill-evolver signal --mode=scan

# Cluster signals and promote qualified gaps
/skill-evolver signal --mode=promote
/skill-evolver gap --promote

# Harvest a specific promoted gap into a draft SKILL.md
/skill-evolver harvester --gap-id=gap_20260712_001

# Auto-harvest top ready gap (circuit breaker enabled)
/skill-evolver harvester --auto --max-harvests=1

# After human review, publish or reject
/skill-evolver publish --harvest-id=harvest_20260712_001
/skill-evolver reject --harvest-id=harvest_20260712_001 --reason="too narrow"
```

## Sub-loops

| Sub-loop | Responsibility | Output |
|----------|---------------|--------|
| `skill-signal` | Detect implicit signals from transcripts | `skill_evolver.signals` |
| `skill-gap` | Cluster signals into gap candidates | `skill_evolver.gap_candidates` |
| `skill-harvester` | Turn promoted gaps into draft skills | `.claude/skills/draft/<name>/SKILL.md` |
| `skill-evolver` | Human gate: publish / reject | Active skill or rejection record |

## Implicit Signals

- `rephrased_intent` — user repeats a question with high similarity
- `empty_tool_result` — Read/file operations return empty or "not found"
- `high_intervention` — user interventions / assistant turns > 0.4
- `long_turn_chain` — >10 assistant turns with no write/commit
- `tool_failure_pattern` — same operation type fails >=3 times

## Multi-Signal Fusion

A gap candidate is created only when at least two signals from different
categories co-occur:

- Understanding failure: `rephrased_intent` + `empty_tool_result`
- Cognitive load: `high_intervention` + `long_turn_chain`
- Exploration failure: `long_turn_chain` + `empty_tool_result`
- Execution failure: `tool_failure_pattern` + `high_intervention`

## Configuration

Create `skill-evolver.config.yaml` in project root or `~/.claude/skill-evolver.config.yaml`:

```yaml
skill_evolver:
  min_signal_confidence: 0.7
  min_signals_per_gap: 2
  distinct_tasks_min: 3
  gap_ttl_hours: 168
  signal_ttl_hours: 720
  existing_skill_threshold: 0.82
  high_intervention_ratio: 0.4
  long_turn_chain_threshold: 10
  tool_failure_repeat_threshold: 3
  max_harvests_per_run: 1
  max_transcripts_per_gap: 5
  harvest_reject_threshold: 3
  min_verifier_l1_score: 60
  min_verifier_l2_score: 60
  min_verifier_l3_score: 60
  draft_dir: .claude/skills/draft
  transcript_dirs:
    - ~/.claude/transcripts
    - ~/.local/share/claude/transcripts
  disabled: false
```

## State Schema

`skill-evolver` reads and writes `.claude/STATE.md` YAML frontmatter:

```yaml
skill_evolver:
  disabled: false
  config: { ... }
  signals: [ ... ]
  gap_candidates: [ ... ]
  harvests: [ ... ]
  counters:
    consecutive_harvest_rejects: 0

skills_verifier:
  runs: [ ... ]

handoffs:
  - at: 2026-07-12T10:00:00Z
    from: skill-gap
    to: skill-harvester
    gap_id: gap_...
```

## Allowed Tools / MCP Scope

- **File read**: transcripts, `STATE.md`, `AGENTS.md`, existing `SKILL.md` files.
- **File write**: `.claude/skills/draft/`, `STATE.md`, `loop-run-log.md`.
- **Subprocess**: `node`, `claude-verify` (skills-verifier).
- **MCP**: none required for L1/L2; optional read-only GitHub MCP for L3 correlation.

## Safety

- Never overwrites an existing active skill.
- Never auto-publishes; only `publish` CLI after human approval.
- Respects `skill_evolver.disabled` and `skill_harvester.disabled` kill switches.
- Circuit breaker: refuses auto-harvest after 3 consecutive rejects.
- All scores use local n-gram/minhash similarity; no external API.

## Requirements

- Node.js >= 20
- `js-yaml` (installed by `npm install` in this directory)
- Must run inside a project git repo with `.claude/STATE.md`
