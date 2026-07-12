const { getEntryText } = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");
const { ngramCosine } = require("../embedding.cjs");

function detect(transcript, config) {
  const signals = [];
  const threshold = 0.85;
  const userTexts = [];

  for (let i = 0; i < transcript.entries.length; i += 1) {
    const entry = transcript.entries[i];
    if (entry.role !== "user" && entry.type !== "user") continue;
    const text = getEntryText(entry).trim();
    if (text.length < 10) continue;
    userTexts.push({ index: i, text, entry });
  }

  for (let i = 1; i < userTexts.length; i += 1) {
    const current = userTexts[i];
    const prev = userTexts[i - 1];
    const sim = ngramCosine(current.text, prev.text, 2);
    if (sim >= threshold) {
      const confidence = Math.min(0.9, 0.6 + (sim - threshold) * 2);
      signals.push({
        type: "rephrased_intent",
        confidence: Number(confidence.toFixed(3)),
        session_id: transcript.session_id,
        task_id: current.entry.task_id || transcript.session_id,
        query_text: current.text.slice(0, 500),
        details: {
          similarity: Number(sim.toFixed(3)),
          previous_text: prev.text.slice(0, 300)
        }
      });
    }
  }

  return signals;
}

module.exports = { detect };
