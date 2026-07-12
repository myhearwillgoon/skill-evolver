const path = require("path");
const rephrasedIntent = require("./rephrased-intent.cjs");
const emptyToolResult = require("./empty-tool-result.cjs");
const highIntervention = require("./high-intervention.cjs");
const longTurnChain = require("./long-turn-chain.cjs");
const toolFailurePattern = require("./tool-failure-pattern.cjs");

const DETECTORS = [
  { name: "rephrased_intent", module: rephrasedIntent },
  { name: "empty_tool_result", module: emptyToolResult },
  { name: "high_intervention", module: highIntervention },
  { name: "long_turn_chain", module: longTurnChain },
  { name: "tool_failure_pattern", module: toolFailurePattern }
];

function detectSignals(transcript, config) {
  const all = [];
  for (const detector of DETECTORS) {
    try {
      const found = detector.module.detect(transcript, config) || [];
      for (const signal of found) {
        if (signal.confidence >= (config.min_signal_confidence || 0.7)) {
          all.push(signal);
        }
      }
    } catch (error) {
      console.warn(`[skill-evolver] Detector ${detector.name} failed on ${transcript.path}: ${error.message}`);
    }
  }
  return all;
}

module.exports = {
  DETECTORS,
  detectSignals
};
