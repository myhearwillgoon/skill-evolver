const { loadConfig } = require("./config.cjs");
const { readState, writeState, isDisabled } = require("./state.cjs");
const { loadRecentTranscripts } = require("./transcript-loader.cjs");
const { detectSignals } = require("./signals/index.cjs");
const { embeddingVector } = require("./embedding.cjs");
const { run: runGapClustering } = require("./gap-cli.cjs");

function makeSignalId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 15).replace(/:/g, "");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `sig_${date}_${time}_${random}`;
}

function recordSignals(signals, config) {
  const state = readState(process.cwd());
  const existing = state.skill_evolver.signals || [];
  const ttlMs = (config.signal_ttl_hours || 720) * 60 * 60 * 1000;
  const now = Date.now();

  const seenKeys = new Set(existing.map((s) => `${s.session_id}:${s.type}:${s.task_id}`));
  let added = 0;

  for (const signal of signals) {
    const key = `${signal.session_id}:${signal.type}:${signal.task_id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    existing.push({
      id: makeSignalId(),
      type: signal.type,
      confidence: signal.confidence,
      session_id: signal.session_id,
      task_id: signal.task_id,
      query_text: signal.query_text,
      query_embedding: embeddingVector(signal.query_text || ""),
      component_signals: signal.component_signals || [{ type: signal.type, confidence: signal.confidence }],
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttlMs).toISOString(),
      details: signal.details || {}
    });
    added += 1;
  }

  state.skill_evolver.signals = existing;
  writeState(process.cwd(), state.data);
  return added;
}

function formatSignal(signal) {
  return `[${signal.type}] conf=${signal.confidence} session=${signal.session_id} task=${signal.task_id} "${(signal.query_text || "").slice(0, 80)}"`;
}

async function scan(options = {}) {
  const config = loadConfig(options);
  if (isDisabled(process.cwd(), "signal")) {
    console.log("[skill-signal] Kill switch active (skill_evolver.disabled or skill_signal.disabled). Skipping.");
    return { signals: [], disabled: true };
  }

  const transcripts = loadRecentTranscripts(config.transcript_dirs, config.signal_ttl_hours);
  console.log(`[skill-signal] Scanned ${transcripts.length} transcript(s).`);

  const all = [];
  for (const transcript of transcripts) {
    const found = detectSignals(transcript, config);
    all.push(...found);
  }

  if (options.dryRun) {
    console.log(`[skill-signal] Dry run: ${all.length} signal(s) detected.`);
    for (const signal of all) {
      console.log(`  ${formatSignal(signal)}`);
    }
    return { signals: all, recorded: 0 };
  }

  const added = recordSignals(all, config);
  console.log(`[skill-signal] Recorded ${added} new signal(s) (${all.length} total detected).`);
  return { signals: all, recorded: added };
}

async function promote(options = {}) {
  const config = loadConfig(options);
  if (isDisabled(process.cwd(), "signal")) {
    console.log("[skill-signal] Kill switch active. Skipping promotion.");
    return { gaps: [], disabled: true };
  }
  return runGapClustering(options);
}

async function run(options = {}) {
  if (options.mode === "promote") {
    return promote(options);
  }
  return scan(options);
}

module.exports = {
  formatSignal,
  makeSignalId,
  promote,
  recordSignals,
  run,
  scan
};
