const fs = require("fs");
const path = require("path");
const {
  parseTranscript,
  getEntryText,
  getToolCalls
} = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");
const { directoryExists, listFiles, readText } = require("./utils/fs.cjs");

function discoverTranscripts(dirs) {
  const found = [];
  for (const dir of dirs) {
    if (!directoryExists(dir)) continue;
    for (const file of listFiles(dir)) {
      if (file.endsWith(".jsonl") || file.endsWith(".json")) {
        found.push(path.join(dir, file));
      }
    }
  }
  return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function getToolResults(entry) {
  const results = [];
  const content = entry.message?.content || entry.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "tool_result" || part.type === "tool_result") {
        results.push({
          tool_use_id: part.tool_use_id,
          is_error: !!part.is_error,
          content: typeof part.content === "string" ? part.content : JSON.stringify(part.content || "")
        });
      }
    }
  }
  if (entry.tool_results) {
    for (const tr of entry.tool_results) {
      results.push({
        tool_use_id: tr.tool_use_id,
        is_error: !!tr.is_error,
        content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content || "")
      });
    }
  }
  return results;
}

function loadTranscript(filePath) {
  const parsed = parseTranscript(filePath);
  const stat = fs.statSync(filePath);
  const sessionId = path.basename(filePath, path.extname(filePath));
  return {
    path: filePath,
    session_id: sessionId,
    mtime: stat.mtimeMs,
    entries: parsed.entries,
    metrics: parsed.metrics,
    userEntries: parsed.entries.filter(
      (entry) => entry.role === "user" || entry.type === "user"
    ),
    assistantEntries: parsed.entries.filter(
      (entry) => entry.role === "assistant" || entry.type === "assistant"
    ),
    toolResultEntries: parsed.entries.filter(
      (entry) => entry.role === "tool" || entry.type === "tool_result" || getToolResults(entry).length > 0
    )
  };
}

function loadRecentTranscripts(dirs, maxAgeHours = 720) {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const files = discoverTranscripts(dirs).filter((file) => fs.statSync(file).mtimeMs > cutoff);
  return files.map(loadTranscript);
}

function getFirstUserQuery(transcript) {
  for (const entry of transcript.entries) {
    if (entry.role === "user" || entry.type === "user") {
      const text = getEntryText(entry).trim();
      if (text.length > 5) return text;
    }
  }
  return transcript.session_id;
}

function getLastUserQuery(transcript) {
  let text = "";
  for (const entry of transcript.entries) {
    if (entry.role === "user" || entry.type === "user") {
      const t = getEntryText(entry).trim();
      if (t.length > 5) text = t;
    }
  }
  return text || transcript.session_id;
}

module.exports = {
  discoverTranscripts,
  getFirstUserQuery,
  getLastUserQuery,
  getToolResults,
  loadRecentTranscripts,
  loadTranscript
};
