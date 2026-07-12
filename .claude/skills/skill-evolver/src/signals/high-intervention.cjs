const { getEntryText } = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");

function findRepresentativeQuery(transcript) {
  let last = "";
  for (const entry of transcript.entries) {
    if (entry.role === "user" || entry.type === "user") {
      const text = getEntryText(entry).trim();
      if (text.length > 5) last = text;
    }
  }
  return last || transcript.session_id;
}

function detect(transcript, config) {
  const signals = [];
  const { assistantTurns, userInterventions } = transcript.metrics;
  if (assistantTurns === 0) return signals;
  const ratio = userInterventions / assistantTurns;
  const threshold = config.high_intervention_ratio || 0.4;
  if (ratio >= threshold) {
    signals.push({
      type: "high_intervention",
      confidence: 0.7,
      session_id: transcript.session_id,
      task_id: transcript.entries.find((e) => e.task_id)?.task_id || transcript.session_id,
      query_text: findRepresentativeQuery(transcript).slice(0, 500),
      details: {
        ratio: Number(ratio.toFixed(3)),
        assistant_turns: assistantTurns,
        user_interventions: userInterventions
      }
    });
  }
  return signals;
}

module.exports = { detect };
