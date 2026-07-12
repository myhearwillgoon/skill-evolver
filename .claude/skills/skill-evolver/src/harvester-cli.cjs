const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config.cjs");
const { readState, writeState, isDisabled, logHandoff } = require("./state.cjs");
const { loadRecentTranscripts, getLastUserQuery } = require("./transcript-loader.cjs");
const { ngramCosine } = require("./embedding.cjs");
const { kebabCase } = require("./naming.cjs");
const { runVerifier } = require("./verifier-bridge.cjs");
const { getEntryText } = require("/home/lenovo/.claude/skills/skills-verifier/src/validators/l3-runtime.cjs");
const { directoryExists, listFiles, readText, ensureDirectory, writeText } = require("./utils/fs.cjs");

function makeHarvestId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 15).replace(/:/g, "");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `harvest_${date}_${time}_${random}`;
}

function loadExistingSkillItems(globalDir, projectDir) {
  const items = [];
  const dirs = [globalDir, projectDir].filter(Boolean);
  for (const dir of dirs) {
    if (!directoryExists(dir)) continue;
    for (const name of listFiles(dir)) {
      const skillPath = path.join(dir, name, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const text = readText(skillPath);
        const firstLine = text.split("\n").slice(0, 15).join("\n");
        items.push({ id: name, path: skillPath, text, description: firstLine });
      }
    }
  }
  return items;
}

function findMaxSimilarity(queryText, items) {
  let maxSim = 0;
  let closest = null;
  for (const item of items) {
    const text = item.description || item.text || "";
    const sim = ngramCosine(queryText, text, 2);
    if (sim > maxSim) {
      maxSim = sim;
      closest = item.id;
    }
  }
  return { max_similarity: maxSim, closest_skill: closest };
}

function gatherTranscripts(gap, config) {
  const transcripts = loadRecentTranscripts(config.transcript_dirs, config.signal_ttl_hours);
  const taskSet = new Set(gap.distinct_tasks || []);
  const matched = transcripts.filter((t) =>
    taskSet.has(t.session_id) || taskSet.has(path.basename(t.path, path.extname(t.path)))
  );
  return matched.slice(0, config.max_transcripts_per_gap || 5);
}

function extractGoldenPath(transcript) {
  const resolution = transcript.entries
    .filter((e) => e.role === "assistant" || e.type === "assistant")
    .slice(-3)
    .map((e) => {
      const text = getEntryText(e);
      return text.slice(0, 300);
    })
    .filter(Boolean);
  return resolution;
}

function generateSkillMarkdown(name, gap, transcripts, existingSkills) {
  const shortName = name;
  const description = (gap.representative_query || "Automated skill draft").slice(0, 200);
  const signalSummary = (gap.component_signals || gap.signals || [])
    .map((s) => `- ${s.type} (confidence ${s.confidence || "n/a"})`)
    .join("\n");
  const evidence = transcripts.map((t, i) => {
    const query = getLastUserQuery(t).slice(0, 200);
    const resolution = extractGoldenPath(t).join("\n  ");
    return `### Session ${i + 1}: ${t.session_id}\n\n**User query:** ${query}\n\n**Resolution snippet:**\n${resolution}`;
  }).join("\n\n");

  const related = existingSkills
    .filter((s) => s.id !== shortName)
    .slice(0, 3)
    .map((s) => `- ${s.id}`)
    .join("\n") || "- none";

  return `---
name: ${shortName}
description: ${description}
type: interactive
author: skill-evolver
version: 1.0.0
---

# ${shortName}

## Problem

Users repeatedly encounter friction around: "${description}".
This skill captures the golden-path resolution discovered from real transcripts.

## When to invoke

- When a user asks a question related to: ${description}
- When signals indicate ${gap.fusion_category || "recurring friction"}

## Steps

1. Identify the user's intent from the latest query.
2. Look up the relevant project convention (see AGENTS.md if available).
3. Apply the golden-path steps discovered in transcripts.
4. Confirm the outcome before proceeding.

## Evidence

Detected signals:
${signalSummary || "- (no component signal details recorded)"}

Representative transcripts (${transcripts.length}):

${evidence || "_No representative transcripts matched._"}

## Examples

### Good

User asks the question; agent applies this skill and resolves in fewer turns.

### Common mistake

Guessing the answer without checking project conventions or prior successful resolutions.

## Related

${related}
`;
}

function harvestGap(gap, state, config) {
  if (!gap || gap.status !== "ready_for_harvest") {
    throw new Error(`Gap ${gap?.id} is not ready_for_harvest (status=${gap?.status}).`);
  }

  if ((gap.distinct_tasks || []).length < (config.distinct_tasks_min || 3)) {
    throw new Error(`Gap ${gap.id} has too few distinct tasks (${gap.distinct_tasks?.length || 0}).`);
  }

  const globalSkillsDir = path.join(process.env.HOME || ".", ".claude", "skills");
  const projectSkillsDir = path.join(process.cwd(), ".claude", "skills");
  const existingSkills = loadExistingSkillItems(globalSkillsDir, projectSkillsDir);
  const pendingHarvests = (state.skill_evolver.harvests || []).filter((h) => h.status !== "rejected" && h.status !== "published");

  const simCheck = findMaxSimilarity(
    gap.representative_query,
    [...existingSkills, ...pendingHarvests.map((h) => ({ id: h.id, description: h.candidate_skill }))]
  );

  if (simCheck.max_similarity > (config.existing_skill_threshold || 0.82)) {
    throw new Error(
      `Gap ${gap.id} too similar to existing skill (${simCheck.closest_skill}, sim=${simCheck.max_similarity.toFixed(3)}). Aborting harvest.`
    );
  }

  const transcripts = gatherTranscripts(gap, config);
  const skillName = kebabCase(gap.representative_query);
  const draftDir = path.resolve(process.cwd(), config.draft_dir, skillName);
  const draftPath = path.join(draftDir, "SKILL.md");

  if (fs.existsSync(draftPath)) {
    throw new Error(`Draft already exists at ${draftPath}. Will not overwrite.`);
  }

  const markdown = generateSkillMarkdown(skillName, gap, transcripts, existingSkills);
  ensureDirectory(draftDir);
  writeText(draftPath, markdown);

  const harvestId = makeHarvestId();
  const harvest = {
    id: harvestId,
    gap_id: gap.id,
    candidate_skill: draftDir,
    status: "pending_verification",
    similarity_check: simCheck,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  state.skill_evolver.harvests = state.skill_evolver.harvests || [];
  state.skill_evolver.harvests.push(harvest);

  logHandoff(state, {
    from: "skill-gap",
    to: "skill-harvester",
    gap_id: gap.id,
    harvest_id: harvestId,
    artifact: draftDir,
    reason: `distinct_tasks=${gap.distinct_tasks.length}, confidence=${gap.confidence}`
  });

  return { harvest, draftDir, draftPath, transcripts };
}

function updateHarvestWithVerifier(state, harvestId, verifierResult) {
  const harvest = (state.skill_evolver.harvests || []).find((h) => h.id === harvestId);
  if (!harvest) return null;

  harvest.verifier_run_id = verifierResult.id;
  harvest.verifier_score = verifierResult.scores;
  harvest.updated_at = new Date().toISOString();

  const minL1 = state.skill_evolver.config?.min_verifier_l1_score || 60;
  const minL2 = state.skill_evolver.config?.min_verifier_l2_score || 60;
  const minL3 = state.skill_evolver.config?.min_verifier_l3_score || 60;

  if (
    verifierResult.scores.l1 >= minL1 &&
    verifierResult.scores.l2 >= minL2 &&
    verifierResult.scores.l3 >= minL3
  ) {
    harvest.status = "pending_human_review";
  } else {
    harvest.status = "verifier_failed";
  }

  state.skills_verifier = state.skills_verifier || {};
  state.skills_verifier.runs = state.skills_verifier.runs || [];
  state.skills_verifier.runs.push({
    id: verifierResult.id,
    target: verifierResult.target,
    mode: verifierResult.mode,
    status: verifierResult.status,
    scores: verifierResult.scores,
    findings: verifierResult.findings,
    triggered_by: harvestId,
    created_at: new Date().toISOString()
  });

  logHandoff(state, {
    from: "skill-harvester",
    to: "skills-verifier",
    harvest_id: harvestId,
    verifier_run_id: verifierResult.id,
    artifact: verifierResult.target
  });

  if (harvest.status === "pending_human_review") {
    logHandoff(state, {
      from: "skills-verifier",
      to: "human_gate",
      harvest_id: harvestId,
      verifier_run_id: verifierResult.id,
      verdict: "ready_for_review"
    });
  }

  return harvest;
}

async function harvestById(gapId, options = {}) {
  const config = loadConfig(options);
  if (isDisabled(process.cwd(), "harvester")) {
    console.log("[skill-harvester] Kill switch active. Skipping.");
    return { disabled: true };
  }

  const state = readState(process.cwd());
  const gap = (state.skill_evolver.gap_candidates || []).find((g) => g.id === gapId);
  if (!gap) {
    throw new Error(`Gap ${gapId} not found in STATE.md.`);
  }

  const result = harvestGap(gap, state, config);
  writeState(process.cwd(), state.data);

  console.log(`[skill-harvester] Drafted ${result.draftPath}`);

  const verifierResult = runVerifier(result.draftDir, { mode: "full" });
  updateHarvestWithVerifier(state, result.harvest.id, verifierResult);
  writeState(process.cwd(), state.data);

  console.log(`[skill-harvester] Verifier run ${verifierResult.id}: L1=${verifierResult.scores.l1} L2=${verifierResult.scores.l2} L3=${verifierResult.scores.l3} status=${verifierResult.status}`);
  return { harvest: result.harvest, verifierResult };
}

async function autoHarvest(options = {}) {
  const config = loadConfig(options);
  if (isDisabled(process.cwd(), "harvester")) {
    console.log("[skill-harvester] Kill switch active. Skipping.");
    return { disabled: true };
  }

  const state = readState(process.cwd());
  const rejects = state.skill_evolver.counters?.consecutive_harvest_rejects || 0;
  if (rejects >= (config.harvest_reject_threshold || 3)) {
    console.log(`[skill-harvester] Circuit breaker: ${rejects} consecutive rejects. Refusing auto-harvest.`);
    return { circuitBroken: true };
  }

  const ready = (state.skill_evolver.gap_candidates || [])
    .filter((g) => g.status === "ready_for_harvest")
    .sort((a, b) => b.confidence - a.confidence);

  const limit = options.max_harvests || config.max_harvests_per_run || 1;
  const results = [];

  for (let i = 0; i < Math.min(limit, ready.length); i += 1) {
    const gap = ready[i];
    try {
      const result = await harvestById(gap.id, options);
      results.push(result);
    } catch (error) {
      console.warn(`[skill-harvester] Failed to harvest ${gap.id}: ${error.message}`);
    }
  }

  console.log(`[skill-harvester] Auto-harvested ${results.length} gap(s).`);
  return { results };
}

async function run(options = {}) {
  if (options.gapId) {
    return harvestById(options.gapId, options);
  }
  if (options.auto) {
    return autoHarvest(options);
  }
  throw new Error("Either --gap-id=... or --auto is required.");
}

module.exports = {
  autoHarvest,
  harvestById,
  makeHarvestId,
  run,
  updateHarvestWithVerifier
};
