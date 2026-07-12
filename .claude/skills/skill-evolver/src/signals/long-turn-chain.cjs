const { getToolCalls, getEntryText } = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");

function findRepresentativeQuery(transcript) {
  let first = "";
  let last = "";
  for (const entry of transcript.entries) {
    if (entry.role === "user" || entry.type === "user") {
      const text = getEntryText(entry).trim();
      if (text.length > 5) {
        if (!first) first = text;
        last = text;
      }
    }
  }
  return last || first || transcript.session_id;
}

function hasWriteOrCommit(entries) {
  for (const entry of entries) {
    const toolCalls = getToolCalls(entry);
    for (const tool of toolCalls) {
      const name = (tool.function?.name || tool.name || "").toLowerCase();
      if (name.includes("write") || name.includes("edit")) return true;
      if (name.includes("bash") || name.includes("exec")) {
        const args = tool.function?.arguments || tool.arguments || {};
        const cmd = typeof args.command === "string" ? args.command : JSON.stringify(args.command || "");
        if (/git\s+commit|git\s+push/.test(cmd)) return true;
      }
    }
  }
  return false;
}

function detect(transcript, config) {
  const signals = [];
  const threshold = config.long_turn_chain_threshold || 10;
  const assistantTurns = transcript.metrics.assistantTurns;
  if (assistantTurns <= threshold) return signals;
  if (hasWriteOrCommit(transcript.entries)) return signals;

  const confidence = Math.min(0.75, 0.7 + (assistantTurns - threshold) * 0.01);
  signals.push({
    type: "long_turn_chain",
    confidence: Number(confidence.toFixed(3)),
    session_id: transcript.session_id,
    task_id: transcript.entries.find((e) => e.task_id)?.task_id || transcript.session_id,
    query_text: findRepresentativeQuery(transcript).slice(0, 500),
    details: {
      assistant_turns: assistantTurns,
      threshold
    }
  });
  return signals;
}

module.exports = { detect };
