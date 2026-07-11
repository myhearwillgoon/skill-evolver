# Tech Trend Monitor — Loop Starter

Clone this into your target directory to run a **fine-grained GitHub tech trend monitoring loop** with adversarial analysis.

---

## Quick Start

1. **Copy starter files**:
   ```bash
   cp -r ~/.claude/skills/loop-engineering/starters/tech-trend-monitor ~/target-directory/
   cd ~/target-directory/
   ```

2. **Create initial STATE.md**:
   ```bash
   cp STATE.md.example STATE.md
   # Edit STATE.md to set output_dir
   ```

3. **Run first iteration** (manual trigger for testing):
   ```bash
   # In Claude Code:
   Run the tech-trend-monitor skill. Read STATE.md first. Do not auto-publish in week one.
   ```

4. **Review output**:
   - Check `STATE.md` for phase/gate status
   - Review report in `output_dir/YYYY-MM-DD/`
   - Approve G5 human gate when prompted

5. **Configure automation** (after successful manual runs):
   - Set up cron trigger (time TBD)
   - Tune skill prompts based on observed behavior

---

## What's Included

| File | Purpose |
|------|---------|
| `SKILL.md` | Core loop skill for Claude Code |
| `STATE.md.example` | State spine template (fine-grained) |
| `STATE_SCHEMA.md` | Complete state schema reference |
| `GATE_MATRIX.yaml` | Gate definitions and criteria |
| `examples/` | Sample outputs and configurations |
| `README.md` | This file |

---

## Requirements

### Tools

- **Claude Code** (primary)
- `deep-research` skill (primary search)
- `tavily-web-search` skill (fallback, requires API key)
- `loop-verifier` skill
- Workflow tool (for hyperplan analysis)

### Environment

- Write access to output directory
- OneDrive/Shared folder access (for `D:\...` path)
- ~500k tokens per run budget
- ~3 hours max duration

### Configuration

Create `STATE.md` with at minimum:

```yaml
state:
  version: "1.0.0"
  config:
    output_dir: "D:/OneDrive - Imperial College London/OpenClaw-Shared/Loop Eng/Github Tech Loop"
    search_queries:
      - "GitHub trending AI agent orchestrator 2025"
      - "AI agent memory systems GitHub trending 2025"
```

---

## Loop Structure

```
┌─────────────────────────────────────────────────────────┐
│  P1: Web Search ──→ G1: Data Quality                      │
│  (deep-research)      Auto                              │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  P2: Aggregation ──→ (no gate)                         │
│  (parse & categorize)                                   │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  P3: Analysis ──→ G2: Analysis Depth                    │
│  (hyperplan 5-role)   Auto                              │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  P4: Verification ──→ G3: Verifier Approval             │
│  (loop-verifier)      Auto                              │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  P5: Report ──→ G4: Output Quality ──→ G5: Human       │
│  (generate)       Auto                  Manual          │
└─────────────────────────────────────────────────────────┘
```

---

## Phases Explained

### P1: Web Search
- **Tool**: `deep-research` (primary), `tavily-web-search` (fallback)
- **Output**: Raw search results with sources
- **Gate G1**: Data quality checks (min 10 sources, 3 domains, 0.70 relevance)

### P2: Aggregation
- **Task**: Parse and categorize results
- **Output**: Normalized project list, trend identification
- **Gate**: None (proceeds to P3)

### P3: Analysis
- **Tool**: Workflow with 5 adversarial agents
- **Output**: 25 findings → ~14 surviving (expected)
- **Gate G2**: Analysis depth (min 20 findings, 50% survival)

### P4: Verification
- **Tool**: `loop-verifier`
- **Output**: Verdict (PASS / CONDITIONAL_APPROVE / FAIL)
- **Gate G3**: Verifier approval

### P5: Report Generation + G5
- **Task**: Generate structured report
- **Output**: `github_trends_analysis_YYYY-MM-DD.md`
- **Gate G4**: Output quality (auto)
- **Gate G5**: Human final approval (manual)

---

## Gates Explained

| Gate | Type | Criteria | Fail Action |
|------|------|----------|-------------|
| G1 | Auto | Data quality metrics | Retry with fallback tool |
| G2 | Auto | Analysis survival rate | Retry hyperplan once |
| G3 | Auto | Verifier verdict | Return to P3 or escalate |
| G4 | Auto | Report completeness | Regenerate report |
| G5 | **Manual** | Human approval | Publish or abort |

---

## State Management

### Initial State

Copy `STATE.md.example` and customize:

```yaml
config:
  output_dir: "your/output/path"
  search_queries: ["your queries"]
```

### During Execution

Skill automatically:
- Updates phase statuses
- Records findings and metrics
- Tracks gate results
- Appends to history (last 7 runs)

### After Completion

Review `STATE.md`:
- Check all gates passed
- Review metrics and findings
- Approve G5 if pending

---

## Output Format

Generated report includes:

1. **原始趋势数据** - Projects, stars, descriptions
2. **5角色对抗性分析** - All 25 findings from hyperplan
3. **幸存者洞察** - ~14 findings that survived cross-attack
4. **第一性原理核心洞察** - 3-5 key insights
5. **可执行Spec草案** - YAML format specs
6. **显式门控验证** - Checklist with scores

Example:
```
D:\OneDrive - Imperial College London\OpenClaw-Shared\Loop Eng\Github Tech Loop\
├── 2026-07-01\
│   ├── github_trends_analysis_2026-07-01.md
│   ├── findings_2026-07-01.json
│   └── raw_data_2026-07-01.json
└── STATE.md
```

---

## Customization

### Custom Search Queries

Edit `STATE.md::config.search_queries`:

```yaml
config:
  search_queries:
    - "GitHub trending AI agent frameworks 2025"
    - "AI agent memory systems GitHub trending 2025"
    - "Multi-agent orchestration GitHub 2025"
```

### Custom Output Location

```yaml
config:
  output_dir: "custom/path"
```

### Tool Preferences

```yaml
config:
  search_tool: "tavily-web-search"  # override default deep-research
  hyperplan_enabled: true
  verifier_enabled: true
  human_gate_g5: true
```

---

## Automation Setup

### Manual Trigger

```bash
# In Claude Code session
Run the tech-trend-monitor skill. Read STATE.md first.
```

### Cron Trigger (to be configured separately)

```yaml
# Cron configuration (time TBD)
cron: "0 21 * * *"  # Example: daily at 21:00
prompt: "Run tech-trend-monitor skill"
state_file: "D:/.../STATE.md"
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Search API fails | Check API keys, enable fallback tool |
| Hyperplan timeout | Extend timeout in config |
| G5 not triggering | Ensure G0-G4 all passed |
| Report not generating | Check write permissions to output dir |

### Debug Mode

Add to `STATE.md::config`:

```yaml
config:
  debug: true
  verbose_logging: true
```

---

## Safety

### No Auto-Publish (Week 1)

First week: Manual review required before G5 approval

### Token Budget

- Estimated: 500k tokens per run
- Monitor in `STATE.md::metrics.tokens_consumed`

### Worktree Isolation

Each attempt runs in isolated worktree — main repo never touched until G5 approval

---

## Next Steps

- [Loop Design Checklist](../../docs/loop-design-checklist.md)
- [Daily Triage pattern](../../patterns/daily-triage.md)
- Run `npx @cobusgreyling/loop-audit .` for readiness score

---

## References

- Skill definition: `SKILL.md`
- State schema: `STATE_SCHEMA.md`
- Gate matrix: `GATE_MATRIX.yaml`
- Loop Engineering: https://github.com/cobusgreyling/loop-engineering
