const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { detectSignals } = require("../src/signals/index.cjs");
const { findFusions } = require("../src/signals/shared.cjs");

function user(text) {
  return { role: "user", type: "user", content: [{ type: "text", text }] };
}

function assistant(text = "") {
  return { role: "assistant", type: "assistant", content: [{ type: "text", text }] };
}

function toolUse(id, name, input = {}) {
  return {
    role: "assistant",
    type: "assistant",
    content: [{ type: "tool_use", id, name, input }]
  };
}

function toolResult(id, content, isError = false) {
  return {
    role: "tool",
    type: "tool_result",
    content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }]
  };
}

function makeTranscript(entries, metrics = {}) {
  return {
    session_id: "test-session",
    path: "/tmp/test.jsonl",
    entries,
    metrics: {
      assistantTurns: 0,
      userInterventions: 0,
      ...metrics
    }
  };
}

describe("rephrased_intent", () => {
  it("detects repeated user prompts", () => {
    const transcript = makeTranscript([
      user("how do we test custom hooks in this repo"),
      assistant("let me check"),
      user("how do we test custom hooks in this repo?")
    ]);
    const signals = detectSignals(transcript, { min_signal_confidence: 0.7 });
    assert.equal(signals.some((s) => s.type === "rephrased_intent"), true);
  });
});

describe("empty_tool_result", () => {
  it("detects empty Read results", () => {
    const transcript = makeTranscript([
      user("show me the config"),
      toolUse("tu1", "Read", { file_path: "/missing" }),
      toolResult("tu1", "not found")
    ]);
    const signals = detectSignals(transcript, { min_signal_confidence: 0.7 });
    assert.equal(signals.some((s) => s.type === "empty_tool_result"), true);
  });
});

describe("high_intervention", () => {
  it("detects high user intervention ratio", () => {
    const transcript = makeTranscript(
      [
        user("start task"),
        assistant("ok"),
        user("fix this"),
        assistant("sure"),
        user("and that"),
        assistant("done")
      ],
      { assistantTurns: 3, userInterventions: 3 }
    );
    const signals = detectSignals(transcript, {
      min_signal_confidence: 0.7,
      high_intervention_ratio: 0.4
    });
    assert.equal(signals.some((s) => s.type === "high_intervention"), true);
  });
});

describe("long_turn_chain", () => {
  it("detects long assistant turn chain without writes", () => {
    const entries = [user("help")];
    for (let i = 0; i < 12; i += 1) {
      entries.push(assistant(`turn ${i + 1}`));
    }
    const transcript = makeTranscript(entries, { assistantTurns: 12, userInterventions: 1 });
    const signals = detectSignals(transcript, {
      min_signal_confidence: 0.5,
      long_turn_chain_threshold: 10
    });
    assert.equal(signals.some((s) => s.type === "long_turn_chain"), true);
  });
});

describe("tool_failure_pattern", () => {
  it("detects repeated tool failures", () => {
    const entries = [user("run command")];
    for (let i = 0; i < 3; i += 1) {
      entries.push(toolUse(`tu${i}`, "Bash", { command: "bad-cmd" }));
      entries.push(toolResult(`tu${i}`, "error", true));
    }
    const transcript = makeTranscript(entries);
    const signals = detectSignals(transcript, {
      min_signal_confidence: 0.7,
      tool_failure_repeat_threshold: 3
    });
    assert.equal(signals.some((s) => s.type === "tool_failure_pattern"), true);
  });
});

describe("multi-signal fusion", () => {
  it("promotes understanding_failure from rephrased_intent + empty_tool_result", () => {
    const signals = [
      { type: "rephrased_intent", task_id: "t1", session_id: "s1", query_text: "q", confidence: 0.8 },
      { type: "empty_tool_result", task_id: "t1", session_id: "s1", query_text: "q", confidence: 0.8 }
    ];
    const fusions = findFusions(signals);
    assert.equal(fusions.some((f) => f.type === "understanding_failure"), true);
  });
});
