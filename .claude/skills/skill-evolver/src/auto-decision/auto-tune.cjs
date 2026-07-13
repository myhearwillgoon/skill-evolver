/**
 * Auto-Tune Module
 * Automatically adjusts decision weights based on effect measurement results
 * Requires human approval for threshold changes
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { loadConfig } = require("../config.cjs");
const { readState, writeState, logHandoff } = require("../state.cjs");
const { createEffectMeasurement, evaluateCompletedMeasurements } = require("./effect-measurement.cjs");

class AutoTuner {
  constructor(state) {
    this.state = state;
    this.config = loadConfig();
    this.tuneConfig = this.config.auto_decision?.escalation?.weight_adjustment;
    this.effectConfig = this.config.effect_measurement;
    this.maxAdjustment = this.effectConfig?.auto_tune?.max_adjustment || 0.1;
    this.minSamples = this.effectConfig?.auto_tune?.min_samples || 10;
  }

  /**
   * Check if auto-tuning is enabled
   */
  isEnabled() {
    return this.effectConfig?.auto_tune?.enabled === true;
  }

  /**
   * Get current weights from config
   */
  getCurrentWeights() {
    return {
      l1: this.config.auto_decision?.stages?.l1_static?.weight || 0.3,
      l2: this.config.auto_decision?.stages?.l2_semantic?.weight || 0.4,
      l3: this.config.auto_decision?.stages?.l3_runtime?.weight || 0.3,
    };
  }

  /**
   * Calculate suggested weight adjustments based on effect data
   */
  calculateAdjustments() {
    const metrics = this.state.skill_evolver?.effect_metrics || {};
    const adjustments = { l1: 0, l2: 0, l3: 0 };
    const reasons = [];

    // Analyze all completed measurements
    const completedMeasurements = Object.entries(metrics).filter(
      ([_, m]) => m.status === "evaluated" && m.aggregates?.primary?.rate !== null
    );

    if (completedMeasurements.length < this.minSamples) {
      return {
        canTune: false,
        reason: `Insufficient samples: ${completedMeasurements.length} < ${this.minSamples}`,
      };
    }

    // Calculate success rates per stage
    const stageSuccessRates = { l1: [], l2: [], l3: [] };
    const decisionScores = [];

    completedMeasurements.forEach(([skillId, metric]) => {
      const decision = metric.auto_decision || {};
      const scores = decision.scores || {};
      const recommendation = metric.recommendation?.action;

      decisionScores.push({
        skillId,
        scores,
        recommendation,
        signalReduction: metric.aggregates?.primary?.rate || 0,
      });

      // Track which stages had high scores for successful vs failed skills
      if (scores.l1 !== undefined) stageSuccessRates.l1.push({ score: scores.l1, outcome: recommendation });
      if (scores.l2 !== undefined) stageSuccessRates.l2.push({ score: scores.l2, outcome: recommendation });
      if (scores.l3 !== undefined) stageSuccessRates.l3.push({ score: scores.l3, outcome: recommendation });
    });

    // Calculate correlation between stage scores and outcomes
    const correlations = this.calculateCorrelations(stageSuccessRates, decisionScores);

    // Adjust weights based on correlations
    // Higher correlation = stage is more predictive of success = higher weight
    const avgCorrelation = (correlations.l1 + correlations.l2 + correlations.l3) / 3;

    if (correlations.l1 > avgCorrelation * 1.2) {
      adjustments.l1 += this.maxAdjustment * 0.5;
      adjustments.l2 -= this.maxAdjustment * 0.25;
      adjustments.l3 -= this.maxAdjustment * 0.25;
      reasons.push("L1 static checks strongly correlate with success");
    }

    if (correlations.l2 > avgCorrelation * 1.2) {
      adjustments.l2 += this.maxAdjustment * 0.5;
      adjustments.l1 -= this.maxAdjustment * 0.25;
      adjustments.l3 -= this.maxAdjustment * 0.25;
      reasons.push("L2 semantic evaluation strongly correlates with success");
    }

    if (correlations.l3 > avgCorrelation * 1.2) {
      adjustments.l3 += this.maxAdjustment * 0.5;
      adjustments.l1 -= this.maxAdjustment * 0.25;
      adjustments.l2 -= this.maxAdjustment * 0.25;
      reasons.push("L3 runtime tests strongly correlate with success");
    }

    // Analyze failed skills
    const failedSkills = decisionScores.filter((d) => d.recommendation === "deprecate");
    if (failedSkills.length > 0) {
      const avgFailedL1 = failedSkills.reduce((sum, d) => sum + (d.scores.l1 || 0), 0) / failedSkills.length;
      const avgFailedL2 = failedSkills.reduce((sum, d) => sum + (d.scores.l2 || 0), 0) / failedSkills.length;
      const avgFailedL3 = failedSkills.reduce((sum, d) => sum + (d.scores.l3 || 0), 0) / failedSkills.length;

      // If failed skills consistently have low scores in a stage, that stage is working
      if (avgFailedL1 < 50) {
        adjustments.l1 += this.maxAdjustment * 0.3;
        reasons.push("L1 effectively identifies low-quality skills");
      }
      if (avgFailedL2 < 50) {
        adjustments.l2 += this.maxAdjustment * 0.3;
        reasons.push("L2 effectively identifies low-quality skills");
      }
      if (avgFailedL3 < 50) {
        adjustments.l3 += this.maxAdjustment * 0.3;
        reasons.push("L3 effectively identifies low-quality skills");
      }
    }

    // Normalize adjustments to sum to 0
    const sum = adjustments.l1 + adjustments.l2 + adjustments.l3;
    if (sum !== 0) {
      const normalizeFactor = sum / 3;
      adjustments.l1 -= normalizeFactor;
      adjustments.l2 -= normalizeFactor;
      adjustments.l3 -= normalizeFactor;
    }

    // Clamp adjustments
    adjustments.l1 = Math.max(-this.maxAdjustment, Math.min(this.maxAdjustment, adjustments.l1));
    adjustments.l2 = Math.max(-this.maxAdjustment, Math.min(this.maxAdjustment, adjustments.l2));
    adjustments.l3 = Math.max(-this.maxAdjustment, Math.min(this.maxAdjustment, adjustments.l3));

    return {
      canTune: true,
      adjustments,
      reasons,
      sampleCount: completedMeasurements.length,
      correlations,
    };
  }

  /**
   * Calculate correlation between stage scores and outcomes
   */
  calculateCorrelations(stageSuccessRates, decisionScores) {
    // Simple correlation: average score for promoted vs deprecated skills
    const correlations = { l1: 0.5, l2: 0.5, l3: 0.5 };

    ["l1", "l2", "l3"].forEach((stage) => {
      const rates = stageSuccessRates[stage];
      if (rates.length === 0) return;

      const promoted = rates.filter((r) => r.outcome === "promote").map((r) => r.score);
      const deprecated = rates.filter((r) => r.outcome === "deprecate").map((r) => r.score);

      if (promoted.length > 0 && deprecated.length > 0) {
        const avgPromoted = promoted.reduce((a, b) => a + b, 0) / promoted.length;
        const avgDeprecated = deprecated.reduce((a, b) => a + b, 0) / deprecated.length;

        // Correlation = (promoted_avg - deprecated_avg) / 100
        correlations[stage] = (avgPromoted - avgDeprecated) / 100;
      }
    });

    return correlations;
  }

  /**
   * Apply weight adjustments to config
   */
  applyAdjustments(adjustments) {
    const current = this.getCurrentWeights();
    const newWeights = {
      l1: current.l1 + adjustments.l1,
      l2: current.l2 + adjustments.l2,
      l3: current.l3 + adjustments.l3,
    };

    // Normalize to sum to 1
    const sum = newWeights.l1 + newWeights.l2 + newWeights.l3;
    newWeights.l1 = Math.round((newWeights.l1 / sum) * 1000) / 1000;
    newWeights.l2 = Math.round((newWeights.l2 / sum) * 1000) / 1000;
    newWeights.l3 = Math.round((newWeights.l3 / sum) * 1000) / 1000;

    return { current, new: newWeights };
  }

  /**
   * Generate tuning report
   */
  generateReport(tuningResult) {
    const { adjustments, reasons, sampleCount, correlations } = tuningResult;
    const { current, new: newWeights } = this.applyAdjustments(adjustments);

    return {
      timestamp: new Date().toISOString(),
      sample_count: sampleCount,
      current_weights: current,
      suggested_weights: newWeights,
      adjustments,
      correlations,
      reasons,
      requires_approval: true,
      config_path: path.join(
        process.env.HOME || ".",
        ".claude",
        "skills",
        "skill-evolver",
        "auto-decision.config.yaml"
      ),
    };
  }

  /**
   * Save tuning suggestion to state
   */
  saveSuggestion(report) {
    if (!this.state.skill_evolver.auto_tune_suggestions) {
      this.state.skill_evolver.auto_tune_suggestions = [];
    }

    this.state.skill_evolver.auto_tune_suggestions.push(report);

    // Keep only last 10 suggestions
    if (this.state.skill_evolver.auto_tune_suggestions.length > 10) {
      this.state.skill_evolver.auto_tune_suggestions =
        this.state.skill_evolver.auto_tune_suggestions.slice(-10);
    }
  }

  /**
   * Run full auto-tune cycle
   */
  async run() {
    if (!this.isEnabled()) {
      console.log("[auto-tune] Auto-tuning is disabled");
      return { tuned: false, reason: "disabled" };
    }

    // First, evaluate any completed measurements
    const completedEvaluations = evaluateCompletedMeasurements(this.state);
    if (completedEvaluations.length > 0) {
      console.log(`[auto-tune] Evaluated ${completedEvaluations.length} completed measurements`);
    }

    // Calculate adjustments
    const tuningResult = this.calculateAdjustments();

    if (!tuningResult.canTune) {
      console.log(`[auto-tune] ${tuningResult.reason}`);
      return { tuned: false, reason: tuningResult.reason };
    }

    // Generate report
    const report = this.generateReport(tuningResult);

    // Save suggestion
    this.saveSuggestion(report);

    // Log handoff
    logHandoff(this.state, {
      from: "auto-tune",
      to: "human_approval",
      action: "weight_adjustment_suggested",
      current_weights: report.current_weights,
      suggested_weights: report.suggested_weights,
      reasons: report.reasons,
      timestamp: report.timestamp,
    });

    console.log("[auto-tune] Generated weight adjustment suggestion");
    console.log(`  Current: L1=${report.current_weights.l1}, L2=${report.current_weights.l2}, L3=${report.current_weights.l3}`);
    console.log(`  Suggested: L1=${report.suggested_weights.l1}, L2=${report.suggested_weights.l2}, L3=${report.suggested_weights.l3}`);
    console.log(`  Reasons: ${report.reasons.join("; ")}`);

    return {
      tuned: true,
      report,
      requires_human_approval: true,
    };
  }

  /**
   * Apply approved tuning (called after human approval)
   */
  async applyApprovedTuning(suggestionIndex = -1) {
    const suggestions = this.state.skill_evolver?.auto_tune_suggestions || [];
    if (suggestions.length === 0) {
      throw new Error("No tuning suggestions available");
    }

    const suggestion = suggestionIndex === -1
      ? suggestions[suggestions.length - 1]
      : suggestions[suggestionIndex];

    if (!suggestion) {
      throw new Error(`Invalid suggestion index: ${suggestionIndex}`);
    }

    // Update config file
    const configPath = suggestion.config_path;
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(content);

    // Update weights
    if (config.auto_decision?.stages) {
      config.auto_decision.stages.l1_static.weight = suggestion.suggested_weights.l1;
      config.auto_decision.stages.l2_semantic.weight = suggestion.suggested_weights.l2;
      config.auto_decision.stages.l3_runtime.weight = suggestion.suggested_weights.l3;
    }

    // Write back
    fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }));

    // Mark as applied
    suggestion.applied = true;
    suggestion.applied_at = new Date().toISOString();

    console.log("[auto-tune] Applied approved tuning");
    console.log(`  New weights: L1=${suggestion.suggested_weights.l1}, L2=${suggestion.suggested_weights.l2}, L3=${suggestion.suggested_weights.l3}`);

    return {
      applied: true,
      suggestion,
    };
  }

  /**
   * Get tuning status
   */
  getStatus() {
    const suggestions = this.state.skill_evolver?.auto_tune_suggestions || [];
    const pending = suggestions.filter((s) => !s.applied);
    const applied = suggestions.filter((s) => s.applied);

    return {
      enabled: this.isEnabled(),
      pending_suggestions: pending.length,
      applied_suggestions: applied.length,
      last_suggestion: suggestions.length > 0 ? suggestions[suggestions.length - 1] : null,
      current_weights: this.getCurrentWeights(),
    };
  }
}

/**
 * Create auto-tuner instance
 */
function createAutoTuner(state) {
  return new AutoTuner(state);
}

/**
 * Run auto-tune cycle
 */
async function runAutoTune(state) {
  const tuner = createAutoTuner(state);
  return await tuner.run();
}

module.exports = {
  AutoTuner,
  createAutoTuner,
  runAutoTune,
};
