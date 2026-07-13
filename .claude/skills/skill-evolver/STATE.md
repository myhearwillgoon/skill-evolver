---
project: skill-evolver
loop_type: discovery-sub-loop
last_run: '2026-07-12T05:30:00.000Z'
status: L1_report_only
skill_evolver:
  gap_candidates: []
  # 🆕 Auto-Decision State (新增)
  escalation_counters: {}
  effect_metrics: {}
  decision_log: []
  auto_tune_suggestions: []
  # 🆕 Auto-Decision Configuration (新增)
  auto_decision:
    enabled: false  # Set to true to enable full automation
    mode: report_only  # Options: report_only, shadow, full_auto
    version: "1.0.0"
    
skills_verifier:
  runs: []
  
handoffs: []
---

# Skill-Evolver Loop State

## High Priority (loop is acting or waiting on human)

- None

## Watch List

- Monitor signal precision during first week of report-only runs.
- Watch `consecutive_harvest_rejects` counter; pause auto-harvest if it reaches 3.
- 🆕 Monitor auto-decision escalation rate; tune if > 20%.

## Recent Noise (ignored this run)

- None

## Loop Metrics

| Metric | Value |
|--------|-------|
| signals_24h | 0 |
| promoted_gaps_7d | 0 |
| harvested_skills_pending_review | 0 |
| consecutive_harvest_rejects | 0 |
| 🆕 auto_decisions_made | 0 |
| 🆕 auto_decision_escalations | 0 |
| 🆕 auto_publications | 0 |
| 🆕 effect_measurements_active | 0 |

## Auto-Decision Status 🆕

| Component | Status | Details |
|-----------|--------|---------|
| Auto-Decision Engine | `disabled` | Set `auto_decision.enabled: true` to enable |
| Escalation Counter | `ready` | 3-strike mechanism ready |
| Effect Measurement | `ready` | Shadow mode ready |
| Auto-Tune | `ready` | Weight adjustment ready |

## Active Escalations 🆕

_No active escalations._

## Active Effect Measurements 🆕

_No active shadow mode measurements._

## Recent Decisions 🆕

_No recent auto-decisions._

## Run Log

See `loop-run-log.md` for detailed history.

---

## 🆕 State Schema v2.0 Documentation

### New State Sections

#### `escalation_counters`
Tracks escalation attempts per gap/skill.
```yaml
escalation_counters:
  gap_xxx:
    count: 2              # Current escalation count
    max_retries: 3          # Max before human escalation
    first_escalation: "..." # ISO timestamp
    last_escalation: "..." # ISO timestamp
    history: []            # Decision history
```

#### `effect_metrics`
Tracks A/B test results for published skills.
```yaml
effect_metrics:
  skill_xxx:
    status: shadow_mode     # not_started | shadow_mode | evaluated
    start_date: "..."
    end_date: "..."
    samples:
      control: []         # Baseline samples
      treatment: []       # New skill samples
    aggregates:
      primary:
        rate: 0.35        # Signal reduction rate
        confidence: 0.85
      secondary: {}
    recommendation:
      action: promote     # promote | deprecate | iterate
      confidence: 0.88
```

#### `decision_log`
Immutable audit trail of all auto-decisions.
```yaml
decision_log:
  - timestamp: "..."
    harvest_id: "..."
    scores: { l1: 85, l2: 72, l3: 65 }
    weights: { l1: 0.3, l2: 0.4, l3: 0.3 }
    final_score: 74.2
    decision: APPROVE
    confidence: 0.742
    rationale: "..."
```

#### `auto_tune_suggestions`
Pending weight adjustment suggestions.
```yaml
auto_tune_suggestions:
  - timestamp: "..."
    sample_count: 15
    current_weights: { l1: 0.3, l2: 0.4, l3: 0.3 }
    suggested_weights: { l1: 0.35, l2: 0.35, l3: 0.3 }
    adjustments: { l1: 0.05, l2: -0.05, l3: 0 }
    reasons: ["L1 strongly correlates with success"]
    correlations: { l1: 0.75, l2: 0.55, l3: 0.60 }
    requires_approval: true
    applied: false
```

### Configuration Options

```yaml
skill_evolver:
  auto_decision:
    enabled: false        # Master switch
    mode: report_only     # report_only | shadow | full_auto
    
    stages:
      l1_static:
        weight: 0.3
        threshold: 60
      l2_semantic:
        weight: 0.4
        threshold: 60
      l3_runtime:
        weight: 0.3
        threshold: 60
    
    decision_matrix:
      approve:
        condition: "l1 >= 80 AND l2 >= 70 AND l3 >= 60"
      conditional_approve:
        condition: "l1 >= 60 AND l2 >= 60 AND l3 >= 60"
      reject:
        condition: "l1 < 60 OR l2 < 60 OR l3 < 60"
      escalate:
        condition: "conflict_detected OR confidence < 0.70"
    
    escalation:
      max_retries: 3
      backoff: exponential
      backoff_factor: 2.0
      max_delay: "4h"
      
      weight_adjustment:
        on_l1_failure: { l1: +0.05, l2: -0.025, l3: -0.025 }
        on_l2_failure: { l1: -0.025, l2: +0.05, l3: -0.025 }
        on_l3_failure: { l1: -0.025, l2: -0.025, l3: +0.05 }
    
    human_escalation_triggers:
      - "consecutive_escalations >= 3"
      - "any_stage_score < 40"
      - "conflict_between_stages"
      - "high_risk_category_detected"
  
  effect_measurement:
    enabled: true
    shadow_mode:
      duration: "7d"
      primary_skill_percentage: 10
    
    metrics:
      primary:
        signal_reduction_rate:
          target: 0.30
          minimum: 0.10
        resolution_quality_score:
          target: 0.80
          minimum: 0.60
    
    promotion_criteria:
      promote_to_primary:
        condition: "signal_reduction >= 30% AND escalation_rate < 20%"
      deprecate:
        condition: "signal_reduction < 10%"
      iterate:
        condition: "signal_reduction >= 10% AND < 30%"
    
    auto_tune:
      enabled: true
      scope: weights_only    # threshold changes require human approval
      max_adjustment: 0.1
      min_samples: 10
```

### Migration Guide

To enable full automation:

1. Set `auto_decision.enabled: true`
2. Set `auto_decision.mode: shadow` (for testing)
3. Monitor for 1 week
4. If metrics good, set `auto_decision.mode: full_auto`

To manually approve tuning suggestions:

```bash
# View pending suggestions
node bin/skill-evolver.cjs auto-tune --status

# Apply latest suggestion
node bin/skill-evolver.cjs auto-tune --apply

# Apply specific suggestion
node bin/skill-evolver.cjs auto-tune --apply --index=0
```
