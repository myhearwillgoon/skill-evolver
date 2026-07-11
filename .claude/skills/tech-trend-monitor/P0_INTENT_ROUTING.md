# P0: Intent Routing Prompt

Use this prompt when executing `P0_INTENT_ROUTING` for the `tech-trend-monitor` skill.

## Inputs

1. `user_prompt`: The exact text the user provided when invoking `/tech-trend-monitor`.
2. `today`: Current date in `YYYY-MM-DD` format.
3. `history`: Last 7 runs from `STATE.md::history`.
4. `config_defaults`: `STATE.md::config.search_queries`.
5. `pending_g5`: Any run with status `COMPLETED_PENDING_G5`.

## Classification Rules

Classify `intent` into exactly one of:

| Intent | Trigger Patterns | Action |
|--------|-----------------|--------|
| `new_topic` | User explicitly names a technology area, trend, or asks "analyze X" / "what's trending in X" | Derive 3-6 GitHub search queries from the topic. Prefer English technical keywords. |
| `continue_topic` | User says "continue", "update", "again", "再来一次", "继续", or references the most recent topic | Reuse/extend the most recent run's queries from `history[0]`. |
| `review_pending` | User says "review", "approve", "publish", "整理今天的趋势", or there is a `COMPLETED_PENDING_G5` run and no explicit new topic | Load the pending report and proceed to G5 review. |
| `explain_skill` | User asks "how does this work", "explain", "解读", "配置架构", "usage" | Skip P1-P5; produce a concise educational explanation of the skill architecture. |
| `unknown` | Intent cannot be confidently determined from the above | Ask a clarifying question with 2-4 concrete options. |

## Query Derivation Guidelines

For `new_topic`, generate queries that:

- Target GitHub specifically (include `"GitHub"` or rely on GitHub Search API context).
- Cover both breadth (trending) and depth (specific technology).
- Include the year when relevant (e.g., `2025`).
- Are distinct enough to avoid near-duplicate results.
- Include both technology-name and problem-space variants.

Example mapping:

| User Topic | Derived Queries |
|------------|-----------------|
| MCP coding agents | `GitHub trending MCP coding agents 2025`, `MCP server AI coding agent orchestrator`, `Model Context Protocol agent IDE integration GitHub` |
| Agent memory | `AI agent memory systems GitHub trending 2025`, `agent long-term memory vector store GitHub`, `multi-agent shared memory framework` |
| Auto-PR | `multi-agent auto pr pull request agent GitHub`, `claude code skill pull request`, `github app autonomous pull request agent` |

## Confidence Scoring

Score confidence 0.0-1.0 based on:

- `1.0`: User explicitly provided a topic and clear action verb.
- `0.8-0.9`: User provided a topic but vague action (e.g., "关于 agent memory").
- `0.6-0.7`: User gave a phrase that partially maps to a known intent (e.g., "整理一下").
- `0.4-0.5`: Multiple intents are plausible.
- `0.0-0.3`: No discernible intent.

## Output Format

```yaml
phases:
  P0_INTENT_ROUTING:
    status: completed
    started_at: "2026-07-11T00:00:00Z"
    completed_at: "2026-07-11T00:01:00Z"
    intent:
      classified_intent: "new_topic"
      confidence_score: 0.92
      rationale: "User explicitly asked for analysis of MCP-enabled coding agents"
    search_queries:
      - "GitHub trending MCP coding agents 2025"
      - "MCP server AI coding agent orchestrator"
      - "Model Context Protocol agent IDE integration GitHub"
    target_run_id: null
    clarifying_question: null
    fallback_used: false
    fallback_reason: null

gates:
  G0_INTENT_CLARITY:
    status: passed
    score: 0.92
    details: "new_topic intent with 3 valid queries; confidence above 0.70 threshold"
```

## Failure Path

If classified intent is `unknown` or confidence `< 0.70`:

1. Set `phases.P0_INTENT_ROUTING.status` to `failed` or `conditional`.
2. Set `gates.G0_INTENT_CLARITY.status` to `failed` or `conditional`.
3. Populate `phases.P0_INTENT_ROUTING.clarifying_question`.
4. Present the question to the user.
5. **Stop.** Do not proceed to P1 until G0 is resolved.
