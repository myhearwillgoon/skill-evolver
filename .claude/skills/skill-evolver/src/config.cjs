const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { fileExists, readText } = require("./utils/fs.cjs");

const DEFAULTS = {
  min_signal_confidence: 0.7,
  min_signals_per_gap: 2,
  distinct_tasks_min: 3,
  gap_ttl_hours: 168,
  signal_ttl_hours: 720,
  existing_skill_threshold: 0.82,
  high_intervention_ratio: 0.4,
  long_turn_chain_threshold: 10,
  tool_failure_repeat_threshold: 3,
  max_harvests_per_run: 1,
  max_transcripts_per_gap: 5,
  harvest_reject_threshold: 3,
  min_verifier_l1_score: 60,
  min_verifier_l2_score: 60,
  min_verifier_l3_score: 60,
  draft_dir: ".claude/skills/draft",
  transcript_dirs: [
    "~/.claude/transcripts",
    "~/.local/share/claude/transcripts"
  ],
  disabled: false
};

function expandHome(filePath) {
  if (typeof filePath !== "string") return filePath;
  if (filePath.startsWith("~/") || filePath === "~") {
    const home = process.env.HOME || process.env.USERPROFILE || ".";
    return path.join(home, filePath.slice(1));
  }
  return filePath;
}

function loadYamlFile(filePath) {
  if (!fileExists(filePath)) {
    return {};
  }
  try {
    return yaml.load(readText(filePath)) || {};
  } catch (error) {
    console.warn(`[skill-evolver] Warning: failed to parse config ${filePath}: ${error.message}`);
    return {};
  }
}

function mergeConfig(base, overlay) {
  if (!overlay || typeof overlay !== "object") {
    return base;
  }
  const merged = { ...base };
  for (const key of Object.keys(overlay)) {
    if (key === "transcript_dirs" && Array.isArray(overlay[key])) {
      merged[key] = overlay[key].map(expandHome);
    } else if (key === "draft_dir" && typeof overlay[key] === "string") {
      merged[key] = expandHome(overlay[key]);
    } else {
      merged[key] = overlay[key];
    }
  }
  return merged;
}

function loadConfig(options = {}) {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  const projectFile = path.resolve(process.cwd(), "skill-evolver.config.yaml");
  const homeFile = path.join(home, ".claude", "skill-evolver.config.yaml");

  let config = { ...DEFAULTS };
  config.transcript_dirs = config.transcript_dirs.map(expandHome);
  config.draft_dir = expandHome(config.draft_dir);

  config = mergeConfig(config, loadYamlFile(projectFile).skill_evolver || {});
  config = mergeConfig(config, loadYamlFile(homeFile).skill_evolver || {});

  // CLI overrides take highest precedence
  for (const key of Object.keys(options)) {
    if (options[key] !== undefined) {
      if (key === "transcript_dirs" && Array.isArray(options[key])) {
        config[key] = options[key].map(expandHome);
      } else if (key === "draft_dir" && typeof options[key] === "string") {
        config[key] = expandHome(options[key]);
      } else {
        config[key] = options[key];
      }
    }
  }

  return config;
}

module.exports = {
  DEFAULTS,
  expandHome,
  loadConfig
};
