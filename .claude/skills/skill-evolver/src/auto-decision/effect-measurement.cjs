/**
 * Effect Measurement Module
 * Implements A/B testing and shadow mode for measuring skill effectiveness
 * Tracks signal reduction rate, resolution quality, and other metrics
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config.cjs");
const { readState, writeState, logHandoff } = require("./state.cjs");

class EffectMeasurement {
  constructor(skillId, state) {
    this.skillId = skillId;
    this.state = state;
    this.config = loadConfig();
    this.effectConfig = this.config.effect_measurement || {};
    this.metrics = this.load();
  }

  /**
   * Load effect metrics from state
   */
  load() {
    const metrics = this.state.skill_evolver?.effect_metrics || {};
    return metrics[this.skillId] || {
      status: "not_started",
      start_date: null,
      end_date: null,
      shadow_mode: false,
      samples: {
        control: [],
        treatment: [],
      },
      aggregates: {
        control: {},
        treatment: {},
        comparison: {},
      },
      recommendation: null,
    };
  }

  /**
   * Save effect metrics to state
   */
  save() {
    if (!this.state.skill_evolver.effect_metrics) {
      this.state.skill_evolver.effect_metrics = {};
    }
    this.state.skill_evolver.effect_metrics[this.skillId] = this.metrics;
  }

  /**
   * Setup shadow mode for a newly published skill
   */
  async setupShadowMode() {
    const shadowConfig = this.effectConfig.shadow_mode;
    if (!shadowConfig?.enabled) {
      console.log("[effect-measurement] Shadow mode disabled, skipping setup");
      return { setup: false, reason: "disabled" };
    }

    this.metrics.status = "shadow_mode";
    this.metrics.shadow_mode = true;
    this.metrics.start_date = new Date().toISOString();
    this.metrics.duration = shadowConfig.duration;
    this.metrics.end_date = this.calculateEndDate(shadowConfig.duration);
    this.metrics.traffic_split = {
      primary: 100 - (shadowConfig.primary_skill_percentage || 10),
      shadow: shadowConfig.primary_skill_percentage || 10,
    };

    this.save();

    console.log(`[effect-measurement] Shadow mode setup for ${this.skillId}`);
    console.log(`  Duration: ${shadowConfig.duration}`);
    console.log(`  End date: ${this.metrics.end_date}`);

    return {
      setup: true,
      skill_id: this.skillId,
      start_date: this.metrics.start_date,
      end_date: this.metrics.end_date,
      traffic_split: this.metrics.traffic_split,
    };
  }

  /**
   * Calculate end date from duration string
   */
  calculateEndDate(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Default 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]).toISOString();
  }

  /**
   * Record a sample for effect measurement
   * @param {string} group - 'control' or 'treatment'
   * @param {Object} data - Sample data
   */
  recordSample(group, data) {
    if (!this.metrics.samples[group]) {
      this.metrics.samples[group] = [];
    }

    const sample = {
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.metrics.samples[group].push(sample);

    // Keep only last 1000 samples per group
    if (this.metrics.samples[group].length > 1000) {
      this.metrics.samples[group] = this.metrics.samples[group].slice(-1000);
    }

    this.save();
    return sample;
  }

  /**
   * Calculate primary metric: signal reduction rate
   * Formula: (signals_before - signals_after) / signals_before
   */
  calculateSignalReductionRate() {
    const control = this.metrics.samples.control;
    const treatment = this.metrics.samples.treatment;

    if (control.length === 0 || treatment.length === 0) {
      return { rate: null, confidence: 0, reason: "insufficient_data" };
    }

    const controlSignals = control
      .filter((s) => s.signal_count !== undefined)
      .map((s) => s.signal_count);

    const treatmentSignals = treatment
      .filter((s) => s.signal_count !== undefined)
      .map((s) => s.signal_count);

    if (controlSignals.length < 10 || treatmentSignals.length < 10) {
      return { rate: null, confidence: 0, reason: "insufficient_samples" };
    }

    const avgControl =
      controlSignals.reduce((a, b) => a + b, 0) / controlSignals.length;
    const avgTreatment =
      treatmentSignals.reduce((a, b) => a + b, 0) / treatmentSignals.length;

    if (avgControl === 0) {
      return { rate: 0, confidence: 0.5, reason: "zero_baseline" };
    }

    const rate = (avgControl - avgTreatment) / avgControl;
    const confidence = Math.min(
      0.95,
      (controlSignals.length + treatmentSignals.length) / 100
    );

    return {
      rate,
      confidence,
      avg_control: avgControl,
      avg_treatment: avgTreatment,
      sample_size: {
        control: controlSignals.length,
        treatment: treatmentSignals.length,
      },
    };
  }

  /**
   * Calculate secondary metrics
   */
  calculateSecondaryMetrics() {
    const metrics = {};

    // User intervention rate
    const controlInterventions = this.metrics.samples.control.filter(
      (s) => s.intervention_required
    ).length;
    const treatmentInterventions = this.metrics.samples.treatment.filter(
      (s) => s.intervention_required
    ).length;
    const controlTotal = this.metrics.samples.control.length;
    const treatmentTotal = this.metrics.samples.treatment.length;

    if (controlTotal > 0 && treatmentTotal > 0) {
      metrics.intervention_rate = {
        control: controlInterventions / controlTotal,
        treatment: treatmentInterventions / treatmentTotal,
        improvement:
          (controlInterventions / controlTotal - treatmentInterventions / treatmentTotal) /
          (controlInterventions / controlTotal || 1),
      };
    }

    // Turn count reduction
    const controlTurns = this.metrics.samples.control
      .filter((s) => s.turn_count !== undefined)
      .map((s) => s.turn_count);
    const treatmentTurns = this.metrics.samples.treatment
      .filter((s) => s.turn_count !== undefined)
      .map((s) => s.turn_count);

    if (controlTurns.length > 0 && treatmentTurns.length > 0) {
      const avgControlTurns =
        controlTurns.reduce((a, b) => a + b, 0) / controlTurns.length;
      const avgTreatmentTurns =
        treatmentTurns.reduce((a, b) => a + b, 0) / treatmentTurns.length;

      metrics.turn_count = {
        control: avgControlTurns,
        treatment: avgTreatmentTurns,
        reduction: (avgControlTurns - avgTreatmentTurns) / avgControlTurns,
      };
    }

    // Success rate
    const controlSuccess = this.metrics.samples.control.filter(
      (s) => s.success
    ).length;
    const treatmentSuccess = this.metrics.samples.treatment.filter(
      (s) => s.success
    ).length;

    if (controlTotal > 0 && treatmentTotal > 0) {
      const controlRate = controlSuccess / controlTotal;
      const treatmentRate = treatmentSuccess / treatmentTotal;

      metrics.success_rate = {
        control: controlRate,
        treatment: treatmentRate,
        improvement: (treatmentRate - controlRate) / (controlRate || 1),
      };
    }

    return metrics;
  }

  /**
   * Evaluate if shadow mode is complete and generate recommendation
   */
  evaluate() {
    const now = new Date();
    const endDate = this.metrics.end_date ? new Date(this.metrics.end_date) : null;

    // Check if shadow period is complete
    if (endDate && now < endDate) {
      return {
        complete: false,
        days_remaining: Math.ceil((endDate - now) / (24 * 60 * 60 * 1000)),
        status: "in_progress",
      };
    }

    // Calculate metrics
    const primaryMetrics = this.calculateSignalReductionRate();
    const secondaryMetrics = this.calculateSecondaryMetrics();

    // Apply promotion criteria
    const criteria = this.effectConfig.promotion_criteria;
    let recommendation = "iterate";
    let confidence = 0.5;

    if (primaryMetrics.rate !== null) {
      const signalReduction = primaryMetrics.rate * 100; // Convert to percentage
      const escalationRate = secondaryMetrics.intervention_rate
        ? (secondaryMetrics.intervention_rate.treatment || 0) * 100
        : 0;

      if (
        signalReduction >= 30 &&
        escalationRate < 20 &&
        criteria.promote_to_primary?.condition.includes("signal_reduction >= 30%")
      ) {
        recommendation = "promote";
        confidence = primaryMetrics.confidence;
      } else if (
        signalReduction < 10 &&
        criteria.deprecate?.condition.includes("signal_reduction < 10%")
      ) {
        recommendation = "deprecate";
        confidence = 1 - primaryMetrics.confidence;
      } else {
        recommendation = "iterate";
        confidence = 0.7;
      }
    }

    this.metrics.status = "evaluated";
    this.metrics.end_date = now.toISOString();
    this.metrics.aggregates = {
      primary: primaryMetrics,
      secondary: secondaryMetrics,
    };
    this.metrics.recommendation = {
      action: recommendation,
      confidence,
      reason: this.getRecommendationReason(recommendation, primaryMetrics, secondaryMetrics),
    };

    this.save();

    // Log handoff
    logHandoff(this.state, {
      from: "effect-measurement",
      to: "auto-tune",
      skill_id: this.skillId,
      recommendation,
      confidence,
      primary_metrics: primaryMetrics,
      timestamp: now.toISOString(),
    });

    return {
      complete: true,
      status: "evaluated",
      recommendation,
      confidence,
      metrics: {
        primary: primaryMetrics,
        secondary: secondaryMetrics,
      },
      action_required: recommendation !== "iterate",
    };
  }

  /**
   * Get human-readable recommendation reason
   */
  getRecommendationReason(recommendation, primaryMetrics, secondaryMetrics) {
    const reasons = {
      promote: `Signal reduction rate ${((primaryMetrics.rate || 0) * 100).toFixed(
        1
      )}% meets threshold (>=30%) and escalation rate is acceptable (<20%)`,
      deprecate: `Signal reduction rate ${((primaryMetrics.rate || 0) * 100).toFixed(
        1
      )}% below minimum threshold (<10%)`,
      iterate: `Signal reduction rate ${((primaryMetrics.rate || 0) * 100).toFixed(
        1
      )}% between thresholds (10-30%), recommend iteration`,
    };
    return reasons[recommendation] || "Evaluation complete";
  }

  /**
   * Get current status for reporting
   */
  getStatus() {
    const now = new Date();
    const endDate = this.metrics.end_date ? new Date(this.metrics.end_date) : null;
    const daysRemaining = endDate
      ? Math.ceil((endDate - now) / (24 * 60 * 60 * 1000))
      : null;

    return {
      skill_id: this.skillId,
      status: this.metrics.status,
      shadow_mode: this.metrics.shadow_mode,
      start_date: this.metrics.start_date,
      end_date: this.metrics.end_date,
      days_remaining: daysRemaining,
      sample_counts: {
        control: this.metrics.samples.control.length,
        treatment: this.metrics.samples.treatment.length,
      },
      recommendation: this.metrics.recommendation,
    };
  }

  /**
   * Force complete shadow mode (for testing)
   */
  forceComplete() {
    this.metrics.end_date = new Date().toISOString();
    return this.evaluate();
  }
}

/**
 * Create effect measurement for a skill
 */
function createEffectMeasurement(skillId, state) {
  return new EffectMeasurement(skillId, state);
}

/**
 * Get all active effect measurements
 */
function getActiveMeasurements(state) {
  const metrics = state.skill_evolver?.effect_metrics || {};
  return Object.entries(metrics)
    .filter(([_, m]) => m.status === "shadow_mode")
    .map(([skillId, metric]) => ({
      skill_id: skillId,
      ...metric,
    }));
}

/**
 * Check and evaluate all completed measurements
 */
function evaluateCompletedMeasurements(state) {
  const metrics = state.skill_evolver?.effect_metrics || {};
  const results = [];

  Object.entries(metrics).forEach(([skillId, metric]) => {
    if (metric.status === "shadow_mode" && metric.end_date) {
      const endDate = new Date(metric.end_date);
      if (new Date() >= endDate) {
        const measurement = new EffectMeasurement(skillId, state);
        const result = measurement.evaluate();
        results.push({
          skill_id: skillId,
          ...result,
        });
      }
    }
  });

  return results;
}

/**
 * Collect sample data from a transcript
 */
function collectSampleFromTranscript(transcript, skillId) {
  // Extract relevant metrics from transcript
  const sample = {
    timestamp: new Date().toISOString(),
    session_id: transcript.session_id,
    signal_count: transcript.signals?.length || 0,
    turn_count: transcript.entries?.length || 0,
    success: transcript.success || false,
    intervention_required: transcript.intervention_required || false,
    resolution_time: transcript.resolution_time,
  };

  return sample;
}

module.exports = {
  EffectMeasurement,
  createEffectMeasurement,
  getActiveMeasurements,
  evaluateCompletedMeasurements,
  collectSampleFromTranscript,
};
