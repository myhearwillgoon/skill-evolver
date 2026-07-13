const fs = require("fs");
const path = require("path");
const { ngramCosine } = require("./embedding.cjs");
const { FUSION_RULES, getCategory } = require("./signals/shared.cjs");
const { directoryExists, listFiles, readText } = require("./utils/fs.cjs");

function makeId(prefix) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 15).replace(/:/g, "");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${prefix}_${date}_${time}_${random}`;
}

function loadExistingSkillTexts(globalDir, projectDir) {
  const skills = [];
  const dirs = [globalDir, projectDir].filter(Boolean);
  for (const dir of dirs) {
    if (!directoryExists(dir)) continue;
    for (const name of listFiles(dir)) {
      const skillPath = path.join(dir, name, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        skills.push({ path: skillPath, text: readText(skillPath) });
      }
    }
  }
  return skills;
}

function findExistingSimilarity(queryText, existingItems) {
  let maxSim = 0;
  let closest = null;
  for (const item of existingItems) {
    const text = item.representative_query || item.description || item.text || "";
    if (!text) continue;
    const sim = ngramCosine(queryText, text, 2);
    if (sim > maxSim) {
      maxSim = sim;
      closest = item.id || item.name || item.path || null;
    }
  }
  return { max_similarity: maxSim, closest_skill: closest };
}

function clusterSignals(signals, config) {
  const clusters = [];
  const similarityThreshold = 0.75;

  for (const signal of signals) {
    const query = signal.query_text || "";
    let matched = false;
    for (const cluster of clusters) {
      if (ngramCosine(query, cluster.representative_query, 2) >= similarityThreshold) {
        cluster.signals.push(signal);
        if (query.length > cluster.representative_query.length) {
          cluster.representative_query = query;
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({
        cluster_id: `cluster_${makeId("c")}`,
        representative_query: query,
        signals: [signal]
      });
    }
  }

  return clusters;
}

function satisfiesFusion(clusterSignals) {
  const types = new Set(clusterSignals.map((s) => s.type));
  for (const rule of FUSION_RULES) {
    if (rule.types.every((t) => types.has(t))) return rule.name;
  }
  return null;
}

function buildGapCandidates(signals, existingGaps, existingSkills, config) {
  const clusters = clusterSignals(signals, config);
  const candidates = [];

  for (const cluster of clusters) {
    const fusion = satisfiesFusion(cluster.signals);
    if (!fusion) continue;

    const distinctTasks = [
      ...new Set(cluster.signals.map((s) => s.task_id || s.session_id).filter(Boolean))
    ];
    if (cluster.signals.length < (config.min_signals_per_gap || 2)) continue;

    const avgConfidence = cluster.signals.reduce((sum, s) => sum + s.confidence, 0) / cluster.signals.length;
    const simCheck = findExistingSimilarity(cluster.representative_query, [...existingGaps, ...existingSkills]);
    if (simCheck.max_similarity > (config.existing_skill_threshold || 0.82)) continue;

    const now = new Date().toISOString();
    const gapTtlMs = (config.gap_ttl_hours || 168) * 60 * 60 * 1000;

    candidates.push({
      id: makeId("gap"),
      cluster_id: cluster.cluster_id,
      representative_query: cluster.representative_query.slice(0, 500),
      distinct_tasks: distinctTasks,
      signal_count: cluster.signals.length,
      confidence: Number(avgConfidence.toFixed(3)),
      status: distinctTasks.length >= (config.distinct_tasks_min || 3) ? "ready_for_harvest" : "open",
      fusion_category: fusion,
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + gapTtlMs).toISOString(),
      similarity_check: simCheck
    });
  }

  return candidates;
}

function mergeGaps(existing, fresh) {
  const byCluster = new Map();
  for (const gap of existing) {
    byCluster.set(gap.cluster_id, gap);
  }
  for (const gap of fresh) {
    const existingGap = byCluster.get(gap.cluster_id);
    if (existingGap) {
      const mergedTasks = [...new Set([...existingGap.distinct_tasks, ...gap.distinct_tasks])];
      existingGap.distinct_tasks = mergedTasks;
      existingGap.signal_count = (existingGap.signal_count || 0) + gap.signal_count;
      existingGap.confidence = Math.max(existingGap.confidence || 0, gap.confidence);
      existingGap.updated_at = new Date().toISOString();
      if (mergedTasks.length >= (config.distinct_tasks_min || 3) && ["open", "promoted"].includes(existingGap.status)) {
        existingGap.status = "ready_for_harvest";
      }
    } else {
      byCluster.set(gap.cluster_id, gap);
    }
  }
  return Array.from(byCluster.values());
}

async function run(options = {}) {
  const { loadConfig } = require("./config.cjs");
  const { readState, writeState } = require("./state.cjs");
  const config = loadConfig(options);
  const state = readState(process.cwd());

  const globalSkillsDir = path.join(process.env.HOME || ".", ".claude", "skills");
  const projectSkillsDir = path.join(process.cwd(), ".claude", "skills");
  const uxHelpersDir = config.ux_helpers_dir || path.join(process.env.HOME || ".", ".claude", "skills", "ux-helpers");
  // 合并所有来源：全局 skills + 项目 skills + ux-helpers
  const existingSkills = [
    ...loadExistingSkillTexts(globalSkillsDir, null),
    ...loadExistingSkillTexts(projectSkillsDir, null),
    ...loadExistingSkillTexts(uxHelpersDir, null)
  ];

  const signals = state.skill_evolver.signals || [];
  const activeSignals = signals.filter((s) => new Date(s.expires_at || "9999") > new Date());

  const fresh = buildGapCandidates(
    activeSignals,
    state.skill_evolver.gap_candidates || [],
    existingSkills,
    config
  );

  const merged = mergeGaps(state.skill_evolver.gap_candidates || [], fresh);
  state.skill_evolver.gap_candidates = merged;

  writeState(process.cwd(), state.data);

  const ready = merged.filter((g) => g.status === "ready_for_harvest");
  console.log(`[skill-gap] Clustered ${activeSignals.length} signals into ${merged.length} gap candidates (${ready.length} ready for harvest).`);
  for (const gap of ready.slice(0, 10)) {
    console.log(`  - ${gap.id}: ${gap.representative_query.slice(0, 80)} (${gap.distinct_tasks.length} tasks, conf=${gap.confidence})`);
  }

  return { gaps: merged, ready };
}

module.exports = {
  buildGapCandidates,
  clusterSignals,
  loadExistingSkillTexts,
  makeId,
  mergeGaps,
  run
};
