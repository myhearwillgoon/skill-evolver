---
name: tech-trend-monitor
description: "Monitors GitHub trends for AI Agent Memory & Orchestrator via adversarial 5-role hyperplan analysis, producing weekly reports with first-principles insights and intent routing."
version: 1.1.0
type: loop
level: L2
pattern: tech-trend-monitor
---

# Tech Trend Monitor — Loop Skill

Monitor GitHub trends for AI Agent Memory & Orchestrator technologies using adversarial 5-role analysis.

---

## Overview

**Level**: L2 (assisted, with human gate G5)  
**Pattern**: `tech-trend-monitor`  
**Trigger**: `/loop-tech-trend` or automated (cron)  
**Output**: Markdown report + Spec draft to OneDrive/Shared folder  

---

## Goal

Produce a weekly technical trend analysis report that survives adversarial review:
1. Search GitHub for trending AI Agent projects
2. Extract key Memory and Orchestrator technologies
3. Run 5-role hyperplan analysis (Skeptic/Validator/Researcher/Architect/Creative)
4. Verify with loop-verifier
5. Generate report with first-principles insights and executable Spec drafts

---

## Building Blocks

| Primitive | Implementation |
|-----------|----------------|
| **State** | `STATE.md` in target output directory |
| **Automation** | Cron trigger or manual `/loop-tech-trend` |
| **Worktrees** | Workflow execution in isolated worktrees |
| **Skills** | `deep-research` (primary), `tavily-web-search` (fallback) |
| **Sub-agents** | Hyperplan 5-role analysis via Workflow tool |
| **Verifier** | `loop-verifier` + G5 human gate |
| **Memory** | Last 7 runs tracked in `STATE.md::history` |

---

## Phase Execution

### P0: Intent Routing (User Intent Classification)

**Task**: Interpret the user's trigger and decide what the skill should actually do.

**Reference Prompt**: `P0_INTENT_ROUTING.md`

**Inputs**:
- User prompt / command args
- `STATE.md` history (last 7 runs, pending G5 reports, previous topics)
- `STATE.md::config` defaults

**Intent Classes**:
```yaml
intents:
  - new_topic:        # User wants a fresh analysis on a specific topic
  - continue_topic:   # User wants to extend or re-run a previous topic
  - review_pending:   # User wants to review/publish a report awaiting G5
  - explain_skill:    # User wants explanation of the skill or loop architecture
  - unknown:          # Intent cannot be inferred; ask clarifying question
```

**Decision Logic**:
```yaml
if user_prompt explicitly specifies a topic:
  intent = new_topic
  derive 3-6 search_queries from the topic
elif user_prompt implies continuation (e.g., "继续", "update", "再来一次"):
  intent = continue_topic
  reuse/extend previous run's queries from STATE.md history[0]
elif user_prompt asks about pending report / G5 / "整理今天的趋势":
  intent = review_pending
  load the most recent COMPLETED_PENDING_G5 run
elif user_prompt asks about skill itself ("怎么用", "配置架构", "解读"):
  intent = explain_skill
  skip P1-P5; produce educational response
else:
  intent = unknown
  ask a clarifying question with 2-4 options
```

**Outputs**:
- `phases.P0_INTENT_ROUTING.classified_intent`
- `phases.P0_INTENT_ROUTING.search_queries` (for new_topic / continue_topic)
- `phases.P0_INTENT_ROUTING.confidence_score` (0.0-1.0)
- `phases.P0_INTENT_ROUTING.target_run_id` (for review_pending)
- `phases.P0_INTENT_ROUTING.clarifying_question` (for unknown)

**Gate G0: Intent Clarity**
- Intent must not be `unknown`
- At least 1 valid search query OR a valid target run ID OR intent is `explain_skill`
- Confidence score >= 0.70
- If G0 fails: ask clarifying question, update STATE.md, and stop (do not proceed to P1)

---

### P1: Web Search (Data Collection)

**Tool**: `deep-research` (primary), `tavily-web-search` (fallback)

**Queries**:
```yaml
queries:
  # Default fallback queries (only used when P0 produces no queries)
  - "GitHub trending AI agent orchestrator 2025"
  - "AI agent memory systems GitHub trending 2025"
```

**Inputs**:
- `phases.P0_INTENT_ROUTING.search_queries` (preferred)
- `STATE.md::config.search_queries` (fallback)

**Outputs**:
- Raw search results
- Source URLs with relevance scores
- Extracted project metadata (name, stars, description, URL)

**Gate G1: Data Quality**
- Min sources: 10
- Min unique domains: 3
- Min avg relevance: 0.70
- Max error rate: 20%

---

### P2: Aggregation (Data Normalization)

**Task**: Parse and categorize search results

**Categories**:
- Orchestrator projects (frameworks, tools)
- Memory projects (storage, indexing, retrieval)
- Emerging trends (protocols, integrations)

**Outputs**:
- Normalized project list
- Trend identification
- Data quality metrics

**Metrics**:
- Project counts per category
- Confidence scores per trend

---

### P3: Analysis (Hyperplan 5-Role)

**Tool**: Workflow with 5 adversarial agents

**Roles**:
1. **Skeptic**: Attack concept packaging vs true innovation
2. **Validator**: Identify boundary cases and integration risks
3. **Researcher**: Demand evidence for all claims
4. **Architect**: Expose coupling and architectural debt
5. **Creative**: Generate non-traditional alternatives

**Process**:
- Round 1: Independent analysis (5 findings each)
- Round 2: Cross-attack
- Round 3: Defense and refinement
- Synthesis: Surviving insights

**Outputs**:
- 25 initial findings
- ~14 surviving findings (expected)
- Survival rate metrics

**Gate G2: Analysis Depth**
- Min total findings: 20
- Min survival rate: 50%
- Max duration: 180 minutes

---

### P4: Verification (Loop-Verifier)

**Tool**: `loop-verifier` or internal verification

**Checks**:
1. Scope check: Focus on core concepts?
2. Intent check: Answered first-principles questions?
3. Evidence check: Based on actual project data?
4. No cheating: Avoided over-abstraction?
5. Risk assessment: Identified unverified assumptions?

**Verdict**:
- PASS: All checks passed
- CONDITIONAL_APPROVE: Minor conditions (proceed with caution)
- FAIL: Major issues found (escalate)

**Gate G3: Verifier Approval**
- Verdict must be PASS or CONDITIONAL_APPROVE
- Min check score: 0.70

---

### P5: Report Generation

**Task**: Generate final report with structured sections

**Required Sections**:
1. Original trend data (projects, stars, descriptions)
2. 5-role adversarial analysis (all findings)
3. Surviving insights (hard constraints)
4. First-principles core insights (3-5)
5. Executable Spec drafts (YAML format)
6. Explicit gate verification checklist

**Output Format**: `github_trends_analysis_YYYY-MM-DD.md`

**Gate G4: Output Quality**
- Report must exist and be >10KB
- All required sections present
- Valid YAML specs included

---

### G5: Human Final Approval (Manual Gate)

**Type**: MANUAL — requires human reviewer

**Trigger**: After P4 verification, if G0-G4 all passed

**Reviewer Actions**:
- Review final report
- Approve, reject, or request changes
- Provide review notes

**Decision**:
- APPROVED: Publish to OneDrive/Shared folder
- REJECTED: Abort, do not publish
- REQUEST_CHANGES: Return to P3 for revision

**Gate G5: Human Approval**
- Human reviewer must explicitly approve
- Review notes must be provided
- Approval timestamp recorded

---

## State Management

### Read at Start

```yaml
# From user invocation
- User prompt / command args
- Current date and context

# From STATE.md
- Previous run history (last 7)
- Common failure patterns
- Decision log
- Tool preferences (deep-research vs tavily)
```

### Update After Each Phase

```yaml
# After P0: Update phases.P0_INTENT_ROUTING with classified_intent, search_queries, confidence_score
# After P1: Update phases.P1_SEARCH.status
# After P2: Update phases.P2_AGGREGATION
# After P3: Update phases.P3_ANALYSIS with all hyperplan details
# After P4: Update gates.G3_VERIFIER_APPROVAL
# After G5: Update gates.G5_HUMAN_APPROVAL and phases.P5_REPORT
```

### Append at Completion

```yaml
# Add to history[]
# Add to decisions[] if any
# Update metrics aggregates
```

---

## Gate Matrix

| Gate | Phase | Type | Auto/Manual | Criteria |
|------|-------|------|-------------|----------|
| G0 | P0 | Intent Clarity | Auto | Intent != unknown, valid queries/run ID, confidence >= 0.70 |
| G1 | P1 | Data Quality | Auto | Min 10 sources, 3 domains, 0.70 relevance |
| G2 | P3 | Analysis Depth | Auto | Min 20 findings, 50% survival, <180min |
| G3 | P4 | Verifier | Auto | Verdict PASS or CONDITIONAL_APPROVE |
| G4 | P5 | Output Quality | Auto | Report exists, >10KB, all sections |
| G5 | P5 | Human Approval | Manual | Human reviewer explicit approval |

---

## Error Handling

### Phase Failures

| Phase | Failure Mode | Retry Strategy | Escalation |
|-------|--------------|----------------|------------|
| P0 | Intent unclear | Ask clarifying question (1x) | If still unclear, stop and wait for user |
| P1 | Search API error | Retry 2x with fallback tool | Escalate to human |
| P2 | Parse error | Skip invalid results, log | Continue with partial data |
| P3 | Workflow timeout | Retry 1x, extend timeout | Escalate to human |
| P4 | Verifier FAIL | Return to P3 with feedback | If 2x fail, escalate |
| G5 | Human REJECT | Return to P3 for revision | Log decision |

### Recovery

- Partial failures logged in `STATE.md::errors`
- Retry count tracked per phase
- Escalation to human if retry exhausted

---

## Tool Configuration

### Primary: Deep Research

```yaml
tool: deep-research
fallback: tavily-web-search  # (when API key provided)

config:
  max_results: 10
  min_relevance: 0.60
  timeout_seconds: 60
```

### Fallback: Tavily Web Search

```yaml
tool: tavily-web-search
requires:
  - TAVILY_API_KEY environment variable

config:
  max_results: 10
  search_depth: comprehensive
```

### Hyperplan Workflow

```yaml
tool: Workflow
config:
  agent_count: 5
  rounds: 3
  max_tokens: 500000
  timeout_minutes: 180
```

---

## Output Location

```
D:\OneDrive - Imperial College London\OpenClaw-Shared\Loop Eng\Github Tech Loop\
├── YYYY-MM-DD\
│   ├── github_trends_analysis_YYYY-MM-DD.md
│   ├── findings_YYYY-MM-DD.json
│   └── raw_data_YYYY-MM-DD.json
└── STATE.md
```

---

## History Retention

- Keep last **7 runs** in `STATE.md::history`
- Older runs archived to `history_archive.jsonl`
- Metrics aggregated across all retained runs

---

## Safety & Gates

### Pre-flight Checks

1. Verify write access to output directory
2. Check `STATE.md` exists (create if missing)
3. Validate previous run completed or was properly cleaned up

### Runtime Guards

1. Token budget: ~500k per run (hyperplan is expensive)
2. Duration limit: 3 hours max
3. Worktree isolation: Each attempt in fresh worktree

### Post-run Verification

1. Verify report written successfully
2. Verify STATE.md updated
3. If G5 pending, notify human reviewer

---

## Customization

### Config Overrides (in STATE.md)

```yaml
config:
  search_queries:
    - "custom query 1"
    - "custom query 2"
  max_results: 15
  output_dir: "custom/path"
  history_retention: 10
```

### Tool Preferences

```yaml
config:
  search_tool: "tavily-web-search"  # override default deep-research
  hyperplan_enabled: true
  verifier_enabled: true
```

---

## Metrics

### Per Run

- Total tokens consumed
- Total agents spawned
- Duration per phase
- Survival rate
- Gate scores

### Aggregated (Last 7 Runs)

- Average survival rate
- Average duration
- Average token consumption
- Success rate (runs completing all gates)

---

## Dependencies

- `deep-research` skill OR `tavily-web-search` skill (with API key)
- `loop-verifier` skill
- Workflow tool (for hyperplan)
- Write access to OneDrive/Shared folder

---

## Example Usage

### Manual Trigger

```bash
/loop-tech-trend
# or
Run the tech-trend-monitor skill. Read STATE.md first.
```

### Automated Trigger

```yaml
# In cron config (to be set separately)
cron: "0 21 * * *"  # Daily at 21:00 (configure as needed)
prompt: "Run tech-trend-monitor skill"
```

### With Custom Config

```yaml
# Update STATE.md::config before running
config:
  search_queries:
    - "GitHub trending AI agent frameworks 2025"
  output_dir: "custom/path"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-01 | Initial release with G5 human gate |
| 1.1.0 | 2026-07-11 | Added P0 intent routing phase and G0 intent clarity gate for vague/user-triggered invocations |

---

## References

- Loop Engineering: https://github.com/cobusgreyling/loop-engineering
- Pattern: `patterns/tech-trend-monitor/`
- Starter: `starters/tech-trend-monitor/`
- State Schema: `STATE_SCHEMA.md`
