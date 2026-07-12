const SIGNAL_CATEGORIES = {
  rephrased_intent: "understanding_failure",
  empty_tool_result: "understanding_failure",
  high_intervention: "cognitive_load",
  long_turn_chain: "cognitive_load",
  tool_failure_pattern: "execution_failure"
};

const FUSION_RULES = [
  {
    name: "understanding_failure",
    types: ["rephrased_intent", "empty_tool_result"]
  },
  {
    name: "cognitive_load",
    types: ["high_intervention", "long_turn_chain"]
  },
  {
    name: "exploration_failure",
    types: ["long_turn_chain", "empty_tool_result"]
  },
  {
    name: "execution_failure",
    types: ["tool_failure_pattern", "high_intervention"]
  }
];

function getCategory(signalType) {
  return SIGNAL_CATEGORIES[signalType] || "other";
}

function findFusions(componentSignals) {
  const byTask = {};
  for (const sig of componentSignals) {
    const key = sig.task_id || sig.session_id || "unknown";
    byTask[key] = byTask[key] || [];
    byTask[key].push(sig);
  }

  const fusions = [];
  for (const [taskId, taskSigs] of Object.entries(byTask)) {
    const present = new Set(taskSigs.map((s) => s.type));
    for (const rule of FUSION_RULES) {
      if (rule.types.every((t) => present.has(t))) {
        const matched = taskSigs.filter((s) => rule.types.includes(s.type));
        const avgConfidence = matched.reduce((sum, s) => sum + s.confidence, 0) / matched.length;
        fusions.push({
          type: rule.name,
          task_id: taskId,
          session_id: matched[0].session_id,
          query_text: matched[0].query_text,
          confidence: Math.min(0.99, avgConfidence + 0.05),
          component_signals: matched.map((s) => ({ type: s.type, confidence: s.confidence }))
        });
      }
    }
  }
  return fusions;
}

module.exports = {
  FUSION_RULES,
  SIGNAL_CATEGORIES,
  findFusions,
  getCategory
};
