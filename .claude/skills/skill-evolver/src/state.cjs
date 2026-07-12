const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { fileExists, readText, writeText, ensureDirectory } = require("./utils/fs.cjs");

function findStateFile(startDir) {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;
  while (current !== root) {
    const candidate = path.join(current, ".claude", "STATE.md");
    if (fileExists(candidate)) {
      return candidate;
    }
    const alt = path.join(current, "STATE.md");
    if (fileExists(alt)) {
      return alt;
    }
    current = path.dirname(current);
  }
  return null;
}

function ensureStateFile(startDir) {
  const statePath = findStateFile(startDir);
  if (statePath) {
    return statePath;
  }
  const projectRoot = path.resolve(startDir);
  const defaultPath = path.join(projectRoot, ".claude", "STATE.md");
  ensureDirectory(path.dirname(defaultPath));
  writeText(defaultPath, "---\n{}\n---\n\n# Project State\n\nManaged by skill-evolver and skills-verifier.\n");
  return defaultPath;
}

function parseState(statePath) {
  if (!fileExists(statePath)) {
    return { data: {}, body: "" };
  }
  const raw = readText(statePath);
  if (!raw.startsWith("---\n")) {
    return { data: {}, body: raw };
  }
  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { data: {}, body: raw };
  }
  const frontmatterRaw = raw.slice(4, endIndex);
  const body = raw.slice(endIndex + 5);
  try {
    const data = yaml.load(frontmatterRaw) || {};
    return { data, body };
  } catch (error) {
    console.warn(`[skill-evolver] Warning: failed to parse STATE.md frontmatter: ${error.message}`);
    return { data: {}, body };
  }
}

function readState(startDir) {
  const statePath = ensureStateFile(startDir);
  const { data, body } = parseState(statePath);
  data.skill_evolver = data.skill_evolver || {};
  data.skills_verifier = data.skills_verifier || {};
  data.handoffs = data.handoffs || [];

  return {
    path: statePath,
    data,
    body,
    skill_evolver: data.skill_evolver,
    skills_verifier: data.skills_verifier,
    handoffs: data.handoffs
  };
}

function writeState(startDir, patch) {
  const statePath = ensureStateFile(startDir);
  const { data, body } = parseState(statePath);
  const next = { ...data };
  if (patch.skill_evolver !== undefined) {
    next.skill_evolver = patch.skill_evolver;
  }
  if (patch.skills_verifier !== undefined) {
    next.skills_verifier = patch.skills_verifier;
  }
  if (patch.handoffs !== undefined) {
    next.handoffs = patch.handoffs;
  }
  const frontmatter = yaml.dump(next, { lineWidth: -1 });
  writeText(statePath, `---\n${frontmatter}---\n${body}`);
  return statePath;
}

function isDisabled(startDir, section) {
  const state = readState(startDir);
  if (state.skill_evolver.disabled === true) return true;
  if (section === "harvester" && state.skill_evolver.skill_harvester?.disabled === true) return true;
  if (section === "signal" && state.skill_evolver.skill_signal?.disabled === true) return true;
  return false;
}

function logHandoff(startDirOrState, record) {
  const state = startDirOrState.data ? startDirOrState : readState(startDirOrState);
  const handoff = {
    at: new Date().toISOString(),
    ...record
  };
  state.data.handoffs = state.data.handoffs || [];
  state.data.handoffs.push(handoff);
  const stateDir = state.path ? path.dirname(state.path) : startDirOrState;
  writeState(stateDir, state.data);
  return handoff;
}

module.exports = {
  ensureStateFile,
  findStateFile,
  isDisabled,
  logHandoff,
  parseState,
  readState,
  writeState
};
