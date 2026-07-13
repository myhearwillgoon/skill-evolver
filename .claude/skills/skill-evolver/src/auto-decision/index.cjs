/**
 * Auto-Decision Module Index
 * Exports all auto-decision components
 */

const { EscalationCounter, createEscalationCounter, getActiveEscalations, cleanupOldEscalations } = require("./escalation-counter.cjs");
const { EffectMeasurement, createEffectMeasurement, getActiveMeasurements, evaluateCompletedMeasurements, collectSampleFromTranscript } = require("./effect-measurement.cjs");
const { AutoDecisionEngine, createAutoDecisionEngine, runAutoDecision } = require("./auto-decision-engine.cjs");
const { AutoTuner, createAutoTuner, runAutoTune } = require("./auto-tune.cjs");

module.exports = {
  // Escalation Counter
  EscalationCounter,
  createEscalationCounter,
  getActiveEscalations,
  cleanupOldEscalations,

  // Effect Measurement
  EffectMeasurement,
  createEffectMeasurement,
  getActiveMeasurements,
  evaluateCompletedMeasurements,
  collectSampleFromTranscript,

  // Auto-Decision Engine
  AutoDecisionEngine,
  createAutoDecisionEngine,
  runAutoDecision,

  // Auto-Tune
  AutoTuner,
  createAutoTuner,
  runAutoTune,
};
