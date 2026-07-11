# Tech Trend Monitor — State Schema

## Schema Version

`1.0.0` — Fine-grained tracking for 6-phase loop (P0 intent routing + P1-P5) with G5 human gate

---

## State File Structure

```yaml
state:
  # Core metadata
  version: "1.0.0"
  schema_url: "https://github.com/cobusgreyling/loop-engineering/starters/tech-trend-monitor/STATE_SCHEMA.md"
  session_id: "tech_trend_YYYYMMDD_HHMMSS"
  created_at: "2026-07-01T00:00:00Z"
  updated_at: "2026-07-01T02:30:00Z"
  
  # Execution control
  status: "IN_PROGRESS"  # PENDING, IN_PROGRESS, COMPLETED, FAILED, CONDITIONAL
  current_phase: "P3_ANALYSIS"
  current_gate: null
  
  # Execution config (copied from trigger)
  config:
    search_queries:
      - "GitHub trending AI agent orchestrator 2025"
      - "AI agent memory systems GitHub trending 2025"
    output_dir: "D:/OneDrive - Imperial College London/OpenClaw-Shared/Loop Eng/Github Tech Loop"
    max_results_per_query: 10
    hyperplan_enabled: true
    verifier_enabled: true
    human_gate_g5: true
    history_retention: 7

---

## Phase Definitions

phases:
  P0_INTENT_ROUTING:
    status: "COMPLETED"  # PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED
    started_at: "2026-07-01T00:00:00Z"
    completed_at: "2026-07-01T00:01:00Z"
    duration_seconds: 60

    # Intent classification result
    intent:
      classified_intent: "new_topic"  # new_topic, continue_topic, review_pending, explain_skill, unknown
      confidence_score: 0.92
      rationale: "User explicitly asked for analysis of MCP-enabled coding agents"

    # Derived or selected search queries (populated for new_topic / continue_topic)
    search_queries:
      - "GitHub trending MCP coding agents 2025"
      - "MCP server AI coding agent orchestrator"

    # Reference to previous run (populated for continue_topic / review_pending)
    target_run_id: null  # e.g., "run_2026-07-09_001"

    # Clarifying question (populated for unknown intent)
    clarifying_question: null

    # Fallback decision
    fallback_used: false
    fallback_reason: null

  P1_SEARCH:
    status: "COMPLETED"  # PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED
    started_at: "2026-07-01T00:01:00Z"
    completed_at: "2026-07-01T00:06:00Z"
    duration_seconds: 300
    
    # Search results (fine-grained)
    results:
      query_1:
        query: "GitHub trending AI agent orchestrator 2025"
        tool: "deep-research"  # or "tavily-web-search"
        status: "SUCCESS"
        results_count: 10
        sources:
          - url: "https://github.blog/..."
            title: "..."
            relevance_score: 0.95
            fetched_at: "2026-07-01T00:01:00Z"
          # ... more sources
        errors: []
        
      query_2:
        query: "AI agent memory systems GitHub trending 2025"
        tool: "deep-research"
        status: "SUCCESS"
        results_count: 10
        sources: []
        errors: []
    
    # Aggregated metrics
    metrics:
      total_sources: 20
      unique_domains: 8
      avg_relevance: 0.87
      
  P2_AGGREGATION:
    status: "COMPLETED"
    started_at: "2026-07-01T00:05:00Z"
    completed_at: "2026-07-01T00:10:00Z"
    duration_seconds: 300
    
    # Extracted projects
    extracted:
      orchestrator_projects:
        - name: "project-name"
          url: "https://github.com/..."
          stars: 15000
          description: "..."
          source_query: "query_1"
          extracted_at: "2026-07-01T00:06:00Z"
        # ... more projects
          
      memory_projects:
        - name: "..."
          # ... same structure
          
      trends_identified:
        - name: "MCP ecosystem expansion"
          projects: [...]
          confidence: 0.85
    
    metrics:
      orchestrator_count: 5
      memory_count: 3
      trends_count: 3

  P3_ANALYSIS:
    status: "IN_PROGRESS"
    started_at: "2026-07-01T00:10:00Z"
    completed_at: null
    duration_seconds: null
    
    # Hyperplan execution (fine-grained)
    hyperplan:
      workflow_id: "wf_xxxxxxxx"
      status: "RUNNING"
      
      # Round 1: Independent analysis
      round_1:
        status: "COMPLETED"
        agents:
          skeptic:
            status: "COMPLETED"
            findings_count: 5
            findings:
              - id: "S1"
                text: "..."
                timestamp: "..."
          validator:
            status: "COMPLETED"
            findings_count: 5
          researcher:
            status: "COMPLETED"
            findings_count: 5
          architect:
            status: "COMPLETED"
            findings_count: 5
          creative:
            status: "COMPLETED"
            findings_count: 5
        
      # Round 2: Cross-attack
      round_2:
        status: "IN_PROGRESS"
        attacks:
          - attacker: "skeptic"
            target: "validator"
            status: "COMPLETED"
            attacks_count: 5
            stands: 3
            attacked: 2
          # ... more attacks
          
      # Round 3: Defense and refinement
      round_3:
        status: "PENDING"
        refinements: []
      
      # Final metrics
      metrics:
        total_findings: 25
        survived_findings: 14
        survival_rate: "56%"
        tokens_consumed: 375396
        agents_spawned: 11
        duration_minutes: 120
        
      # Detailed findings (populated after completion)
      findings:
        - id: "F001"
          role: "skeptic"
          finding: "RAG+Agent引擎是重贴标签的营销话术"
          survival_status: "SURVIVED"
          attacks_received: 2
          defense_status: "DEFENDED"
          final_form: "..."

  P4_VERIFICATION:
    status: "PENDING"
    started_at: null
    completed_at: null
    duration_seconds: null
    
    verifier:
      tool: "loop-verifier"  # or internal verification
      status: "PENDING"
      
      checks:
        scope_check: {status: "PENDING", score: null}
        intent_check: {status: "PENDING", score: null}
        evidence_check: {status: "PENDING", score: null}
        no_cheating_check: {status: "PENDING", score: null}
        risk_assessment: {status: "PENDING", risk_level: null, mitigation: null}
      
      verdict: "PENDING"  # PASS, CONDITIONAL_APPROVE, FAIL
      conditions: []

  P5_REPORT:
    status: "PENDING"
    started_at: null
    completed_at: null
    duration_seconds: null
    
    output:
      report_path: null
      report_filename: null
      report_size_bytes: null
      findings_json_path: null
      
    # Handoff to human (G5)
    handoff:
      status: "PENDING"  # PENDING, WAITING_HUMAN, APPROVED, REJECTED
      human_reviewer: null
      review_started_at: null
      review_completed_at: null
      review_decision: null
      review_notes: null

---

## Gate Definitions

gates:
  G0_INTENT_CLARITY:
    name: "Intent Clarity Gate"
    description: "Verify user intent is clear and actionable"
    status: "PASSED"  # PENDING, IN_PROGRESS, PASSED, FAILED, CONDITIONAL

    criteria:
      - intent_not_unknown: true
      - min_confidence_score: 0.70
      - has_valid_queries_or_run_id_or_explain: true

    metrics:
      classified_intent: "new_topic"
      confidence_score: 0.92
      query_count: 2
      target_run_id: null
      fallback_to_defaults: false

    result: "PASSED"
    conditions: []
    checked_at: "2026-07-01T00:01:00Z"

  G1_DATA_QUALITY:
    name: "Data Quality Gate"
    description: "Verify web search results are valid and relevant"
    status: "PENDING"  # PENDING, IN_PROGRESS, PASSED, FAILED, CONDITIONAL
    
    criteria:
      - min_sources: 10
      - min_unique_domains: 3
      - min_avg_relevance: 0.70
      - max_error_rate: 0.20
    
    metrics:
      total_sources: 20
      valid_sources: 20
      unique_domains: 8
      avg_relevance: 0.87
      error_rate: 0.00
    
    result: "PASSED"
    conditions: []
    checked_at: "2026-07-01T00:06:00Z"

  G2_ANALYSIS_DEPTH:
    name: "Analysis Depth Gate"
    description: "Verify hyperplan analysis quality and survival rate"
    status: "PENDING"
    
    criteria:
      - min_total_findings: 20
      - min_survival_rate: 0.50
      - min_agents_completed: 5
      - max_duration_minutes: 180
    
    metrics:
      total_findings: 25
      survived_findings: 14
      survival_rate: 0.56
      agents_completed: 5
      duration_minutes: 120
    
    result: "PENDING"
    conditions: []

  G3_VERIFIER_APPROVAL:
    name: "Verifier Approval Gate"
    description: "Loop-verifier assessment of analysis quality"
    status: "PENDING"
    
    criteria:
      - verdict_in: ["PASS", "CONDITIONAL_APPROVE"]
      - min_check_score: 0.70
    
    metrics:
      checks_passed: 0
      checks_total: 5
      avg_score: null
    
    result: "PENDING"
    verdict: null
    conditions: []

  G4_OUTPUT_QUALITY:
    name: "Output Quality Gate"
    description: "Verify report completeness and format"
    status: "PENDING"
    
    criteria:
      - report_exists: true
      - min_report_size_kb: 10
      - required_sections:
        - "原始趋势数据"
        - "5角色对抗性分析"
        - "第一性原理核心洞察"
        - "可执行Spec草案"
    
    metrics:
      report_exists: false
      report_size_kb: 0
      sections_present: []
      sections_missing: []
    
    result: "PENDING"
    conditions: []

  G5_HUMAN_APPROVAL:
    name: "Human Final Approval Gate"
    description: "Human reviewer final approval before publish"
    status: "PENDING"
    type: "MANUAL"  # This is a manual gate
    
    criteria:
      - human_reviewer_approved: true
      - review_notes_provided: true
    
    reviewer: null
    decision: null  # APPROVED, REJECTED, REQUEST_CHANGES
    notes: null
    approved_at: null

---

## Metrics Aggregations

metrics:
  session:
    total_duration_seconds: null
    total_tokens_consumed: null
    total_agents_spawned: null
    
  quality:
    data_quality_score: null  # 0-1
    analysis_depth_score: null  # 0-1
    survival_rate: null  # percentage
    
  efficiency:
    tokens_per_finding: null
    minutes_per_phase: {}

---

## History (Last 7 Runs)

history:
  - session_id: "tech_trend_20260628_210000"
    date: "2026-06-28"
    status: "COMPLETED"
    phases_completed: 5
    gates_passed: 5
    survival_rate: "56%"
    report_path: "..."
    
  - session_id: "tech_trend_20260627_210000"
    date: "2026-06-27"
    status: "FAILED"
    failed_at_phase: "P3_ANALYSIS"
    error: "Workflow timeout"
    
  # ... up to 7 entries

---

## Error Tracking

errors:
  - phase: "P1_SEARCH"
    timestamp: "..."
    error_type: "API_ERROR"
    message: "..."
    retry_count: 0
    resolution: "RETRY_SUCCESS"
    
  - phase: "P3_ANALYSIS"
    timestamp: "..."
    error_type: "WORKFLOW_TIMEOUT"
    message: "..."
    resolution: "ESCALATED_TO_HUMAN"

---

## Notes & Decisions

notes:
  - "Switched from tavily to deep-research for P1"
  - "Added extra retry for hyperplan workflow"
  - "Manual approval required for G5 (company policy)"

decisions:
  - id: "D001"
    date: "2026-07-01"
    decision: "Use deep-research as primary search tool"
    rationale: "Better quality results, fallback to tavily if needed"
    approved_by: "human"

---

## Schema Validation

# This section is auto-generated - do not edit
schema_hash: "sha256:..."
validated_at: null
validation_errors: []
