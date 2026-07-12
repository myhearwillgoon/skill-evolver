const { getToolCalls, getEntryText } = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");
const { getToolResults } = require("../transcript-loader.cjs");

function findPriorUserQuery(transcript, entryIndex) {
  for (let i = entryIndex - 1; i >= 0; i -= 1) {
    const entry = transcript.entries[i];
    if (entry.role === "user" || entry.type === "user") {
      const text = getEntryText(entry).trim();
      if (text.length > 5) return text;
    }
  }
  return transcript.session_id;
}

const EMPTY_PATTERNS = [
  /not found/i,
  /does not exist/i,
  /no such file/i,
  /empty/i,
  /^\s*$/,
  /error reading/i,
  /unable to read/i
];

function isEmptyReadResult(toolName, resultText) {
  const normalized = (toolName || "").toLowerCase();
  if (!normalized.includes("read") && !normalized.includes("file")) return false;
  return EMPTY_PATTERNS.some((pattern) => pattern.test(resultText));
}

function detect(transcript, config) {
  const signals = [];
  const toolResultsById = new Map();

  for (const entry of transcript.entries) {
    for (const tr of getToolResults(entry)) {
      toolResultsById.set(tr.tool_use_id, tr);
    }
  }

  for (let i = 0; i < transcript.entries.length; i += 1) {
    const entry = transcript.entries[i];
    if (entry.role !== "assistant" && entry.type !== "assistant") continue;
    const toolCalls = getToolCalls(entry);
    for (const tool of toolCalls) {
      const toolName = tool.function?.name || tool.name || "unknown";
      const toolUseId = tool.id || tool.tool_use_id;
      const result = toolUseId ? toolResultsById.get(toolUseId) : null;
      const resultText = result ? result.content : "";
      if (isEmptyReadResult(toolName, resultText)) {
        const confidence = Math.min(0.95, 0.7 + (resultText.length < 10 ? 0.15 : 0));
        signals.push({
          type: "empty_tool_result",
          confidence: Number(confidence.toFixed(3)),
          session_id: transcript.session_id,
          task_id: entry.task_id || transcript.session_id,
          query_text: findPriorUserQuery(transcript, i).slice(0, 500),
          details: {
            tool: toolName,
            result_preview: resultText.slice(0, 200)
          }
        });
      }
    }
  }

  return signals;
}

module.exports = { detect };
