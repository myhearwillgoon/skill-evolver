const { getToolCalls, getEntryText } = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");
const { getToolResults } = require("../transcript-loader.cjs");

function detect(transcript, config) {
  const signals = [];
  const threshold = config.tool_failure_repeat_threshold || 3;
  const toolResultsById = new Map();

  for (const entry of transcript.entries) {
    for (const tr of getToolResults(entry)) {
      toolResultsById.set(tr.tool_use_id, tr);
    }
  }

  const failuresByType = {};
  for (const entry of transcript.entries) {
    if (entry.role !== "assistant" && entry.type !== "assistant") continue;
    const toolCalls = getToolCalls(entry);
    for (const tool of toolCalls) {
      const toolName = tool.function?.name || tool.name || "unknown";
      const toolUseId = tool.id || tool.tool_use_id;
      const result = toolUseId ? toolResultsById.get(toolUseId) : null;
      if (result?.is_error || entry.error || entry.status === "error") {
        const type = categorizeOperation(toolName);
        failuresByType[type] = (failuresByType[type] || 0) + 1;
      }
    }
  }

  for (const [type, count] of Object.entries(failuresByType)) {
    if (count >= threshold) {
      const confidence = Math.min(0.9, 0.7 + (count - threshold) * 0.05);
      signals.push({
        type: "tool_failure_pattern",
        confidence: Number(confidence.toFixed(3)),
        session_id: transcript.session_id,
        task_id: transcript.entries.find((e) => e.task_id)?.task_id || transcript.session_id,
        query_text: getEntryText(transcript.entries.find((e) => e.role === "user" || e.type === "user") || {}).slice(0, 500),
        details: {
          operation_type: type,
          failure_count: count
        }
      });
    }
  }

  return signals;
}

function categorizeOperation(toolName) {
  const normalized = (toolName || "").toLowerCase();
  if (normalized.includes("read")) return "file_read";
  if (normalized.includes("edit") || normalized.includes("write")) return "file_write";
  if (normalized.includes("bash") || normalized.includes("exec")) return "command";
  if (normalized.includes("web")) return "web";
  if (normalized.includes("mcp")) return "mcp";
  if (normalized.includes("search")) return "search";
  return "other";
}

module.exports = { detect };
