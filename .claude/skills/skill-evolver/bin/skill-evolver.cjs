#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { readState, writeState, isDisabled } = require("../src/state.cjs");
const { loadConfig } = require("../src/config.cjs");

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "publish") {
      options.command = "publish";
    } else if (arg === "reject") {
      options.command = "reject";
    } else if (arg.startsWith("--harvest-id=")) {
      options.harvestId = arg.slice("--harvest-id=".length);
    } else if (arg.startsWith("--reason=")) {
      options.reason = arg.slice("--reason=".length);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: skill-evolver <command> [options]

Commands:
  publish --harvest-id=ID              Move draft skill to active skills dir
  reject --harvest-id=ID --reason=...  Mark harvest rejected and increment counter

Options:
  --harvest-id=ID
  --reason=TEXT
  --help, -h                           Show this help
`);
}

function publishHarvest(harvestId, state, config) {
  const harvest = (state.skill_evolver.harvests || []).find((h) => h.id === harvestId);
  if (!harvest) throw new Error(`Harvest ${harvestId} not found.`);
  if (harvest.status !== "pending_human_review") {
    throw new Error(`Harvest ${harvestId} status is ${harvest.status}; only pending_human_review can be published.`);
  }

  const draftDir = path.resolve(process.cwd(), harvest.candidate_skill);
  const draftSkillPath = path.join(draftDir, "SKILL.md");
  if (!fs.existsSync(draftSkillPath)) {
    throw new Error(`Draft not found at ${draftSkillPath}.`);
  }

  const skillName = path.basename(draftDir);
  const activeDir = path.join(process.env.HOME || ".", ".claude", "skills", skillName);
  const activePath = path.join(activeDir, "SKILL.md");

  if (fs.existsSync(activePath)) {
    throw new Error(`Active skill already exists at ${activePath}. Will not overwrite.`);
  }

  fs.mkdirSync(activeDir, { recursive: true });
  fs.copyFileSync(draftSkillPath, activePath);

  harvest.status = "published";
  harvest.updated_at = new Date().toISOString();

  const gap = (state.skill_evolver.gap_candidates || []).find((g) => g.id === harvest.gap_id);
  if (gap) {
    gap.status = "harvested";
    gap.updated_at = new Date().toISOString();
  }

  state.skill_evolver.counters = state.skill_evolver.counters || {};
  state.skill_evolver.counters.consecutive_harvest_rejects = 0;

  console.log(`[skill-evolver] Published ${draftSkillPath} → ${activePath}`);
  return { activePath };
}

function rejectHarvest(harvestId, reason, state, config) {
  const harvest = (state.skill_evolver.harvests || []).find((h) => h.id === harvestId);
  if (!harvest) throw new Error(`Harvest ${harvestId} not found.`);

  harvest.status = "rejected";
  harvest.rejection_reason = reason;
  harvest.updated_at = new Date().toISOString();

  state.skill_evolver.counters = state.skill_evolver.counters || {};
  state.skill_evolver.counters.consecutive_harvest_rejects =
    (state.skill_evolver.counters.consecutive_harvest_rejects || 0) + 1;

  console.log(`[skill-evolver] Rejected ${harvestId}: ${reason || "no reason given"}`);
  return { harvest };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (!options.command) {
    console.error("Error: command (publish|reject) is required.");
    printUsage();
    process.exit(2);
  }

  if (!options.harvestId) {
    console.error("Error: --harvest-id=ID is required.");
    printUsage();
    process.exit(2);
  }

  if (isDisabled(process.cwd())) {
    console.log("[skill-evolver] Kill switch active. Skipping.");
    process.exit(0);
  }

  const config = loadConfig(options);
  const state = readState(process.cwd());

  try {
    if (options.command === "publish") {
      publishHarvest(options.harvestId, state, config);
    } else if (options.command === "reject") {
      rejectHarvest(options.harvestId, options.reason || "", state, config);
    }
    writeState(process.cwd(), state.data);
  } catch (error) {
    console.error(`[skill-evolver] Error: ${error.stack || error.message}`);
    process.exit(2);
  }
}

main();
