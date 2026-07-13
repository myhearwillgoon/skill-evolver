/**
 * Escalation Counter Module
 * Implements 3-strike escalation mechanism for auto-decision
 * Only escalates to human after 3 consecutive failures
 */

const fs = require("fs");
const path = require("path");
const { readState, writeState, logHandoff } = require("./state.cjs");
const { loadConfig } = require("./config.cjs");

class EscalationCounter {
  constructor(gapId, state) {
    this.gapId = gapId;
    this.state = state;
    this.config = loadConfig();
    this.counter = this.load();
    this.maxRetries = this.config.auto_decision?.escalation?.max_retries || 3;
    this.initialDelay = this.parseDuration(
      this.config.auto_decision?.escalation?.initial_delay || "1h"
    );
    this.backoffFactor = this.config.auto_decision?.escalation?.backoff_factor || 2.0;
    this.maxDelay = this.parseDuration(
      this.config.auto_decision?.escalation?.max_delay || "4h"
    );
  }

  /**
   * Load escalation counter from state
   */
  load() {
    const counters = this.state.skill_evolver?.escalation_counters || {};
    return counters[this.gapId] || {
      count: 0,
      first_escalation: null,
      last_escalation: null,
      history: [],
    };
  }

  /**
   * Save escalation counter to state
   */
  save() {
    if (!this.state.skill_evolver.escalation_counters) {
      this.state.skill_evolver.escalation_counters = {};
    }
    this.state.skill_evolver.escalation_counters[this.gapId] = this.counter;
  }

  /**
   * Parse duration string (e.g., "1h", "30m") to milliseconds
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  /**
   * Attempt to make a decision with automatic retry logic
   * @param {Function} decisionFn - Async function that returns decision result
   * @returns {Object} Final decision or escalation
   */
  async attemptDecision(decisionFn) {
    try {
      const result = await decisionFn();

      // Record attempt
      this.counter.history.push({
        timestamp: new Date().toISOString(),
        result_type: result.type,
        scores: result.scores,
      });

      // Trim history to last 10 entries
      if (this.counter.history.length > 10) {
        this.counter.history = this.counter.history.slice(-10);
      }

      if (result.type === "ESCALATE") {
        return await this.handleEscalation(result);
      }

      // Reset counter on success
      if (result.type === "APPROVE" || result.type === "REJECT") {
        this.reset();
        this.save();
        return result;
      }

      // CONDITIONAL_APPROVE - still counts as resolution
      if (result.type === "CONDITIONAL_APPROVE") {
        this.reset();
        this.save();
        return result;
      }

      this.save();
      return result;
    } catch (error) {
      // Unexpected error - count as escalation
      this.counter.count += 1;
      this.counter.last_escalation = new Date().toISOString();
      this.save();

      return {
        type: "ESCALATE",
        reason: "unexpected_error",
        error: error.message,
        escalation_count: this.counter.count,
        should_break_loop: this.counter.count >= this.maxRetries,
      };
    }
  }

  /**
   * Handle escalation with 3-strike logic
   */
  async handleEscalation(result) {
    // Increment counter
    this.counter.count += 1;

    if (!this.counter.first_escalation) {
      this.counter.first_escalation = new Date().toISOString();
    }
    this.counter.last_escalation = new Date().toISOString();

    // Check if we should break loop
    if (this.counter.count >= this.maxRetries) {
      this.save();

      // Log handoff to human
      logHandoff(this.state, {
        from: "auto-decision",
        to: "human-gate",
        gap_id: this.gapId,
        escalation_count: this.counter.count,
        reason: "3 consecutive escalations reached",
        context: result.context,
        timestamp: new Date().toISOString(),
      });

      return {
        type: "BREAK_LOOP",
        action: "ESCALATE_TO_HUMAN",
        reason: `3 consecutive escalations for gap ${this.gapId}`,
        gap_id: this.gapId,
        escalation_count: this.counter.count,
        history: this.counter.history,
        context: result.context,
      };
    }

    // Calculate retry delay with exponential backoff
    const delay = this.calculateBackoff();
    const adjustedWeights = this.tuneWeights(result);

    this.save();

    return {
      type: "RETRY",
      delay: delay,
      delay_ms: this.calculateBackoffMs(),
      adjusted_weights: adjustedWeights,
      escalation_count: this.counter.count,
      retry_number: this.counter.count,
      context: result.context,
    };
  }

  /**
   * Calculate backoff delay in milliseconds
   */
  calculateBackoffMs() {
    const delay = this.initialDelay * Math.pow(this.backoffFactor, this.counter.count - 1);
    return Math.min(delay, this.maxDelay);
  }

  /**
   * Calculate backoff delay in human-readable format
   */
  calculateBackoff() {
    const ms = this.calculateBackoffMs();
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
    }
    return `${minutes}m`;
  }

  /**
   * Tune weights based on which stage failed
   */
  tuneWeights(result) {
    const weights = {
      l1: this.config.auto_decision?.stages?.l1_static?.weight || 0.3,
      l2: this.config.auto_decision?.stages?.l2_semantic?.weight || 0.4,
      l3: this.config.auto_decision?.stages?.l3_runtime?.weight || 0.3,
    };

    const adjustment = this.config.auto_decision?.escalation?.weight_adjustment;
    if (!adjustment) return weights;

    // Analyze which stage(s) caused escalation
    const scores = result.scores || {};
    const failures = [];

    if (scores.l1 !== undefined) {
      const l1Threshold = this.config.auto_decision?.stages?.l1_static?.threshold || 60;
      if (scores.l1 < l1Threshold) failures.push("l1");
    }
    if (scores.l2 !== undefined) {
      const l2Threshold = this.config.auto_decision?.stages?.l2_semantic?.threshold || 60;
      if (scores.l2 < l2Threshold) failures.push("l2");
    }
    if (scores.l3 !== undefined) {
      const l3Threshold = this.config.auto_decision?.stages?.l3_runtime?.threshold || 60;
      if (scores.l3 < l3Threshold) failures.push("l3");
    }

    // Apply adjustments
    if (failures.length > 0) {
      // If multiple failures, distribute adjustments
      const adjustmentPerFailure = 0.05 / failures.length;

      failures.forEach((failure) => {
        weights[failure] += adjustmentPerFailure * 2;
      });

      // Reduce weights for non-failing stages
      Object.keys(weights).forEach((key) => {
        if (!failures.includes(key)) {
          weights[key] -= adjustmentPerFailure;
        }
      });
    }

    // Normalize to ensure sum = 1
    const sum = weights.l1 + weights.l2 + weights.l3;
    weights.l1 = weights.l1 / sum;
    weights.l2 = weights.l2 / sum;
    weights.l3 = weights.l3 / sum;

    // Round to 3 decimal places
    weights.l1 = Math.round(weights.l1 * 1000) / 1000;
    weights.l2 = Math.round(weights.l2 * 1000) / 1000;
    weights.l3 = Math.round(weights.l3 * 1000) / 1000;

    return weights;
  }

  /**
   * Reset counter (call on successful resolution)
   */
  reset() {
    this.counter.count = 0;
    this.counter.first_escalation = null;
    this.counter.last_escalation = null;
    this.counter.history = [];
  }

  /**
   * Get current status for reporting
   */
  getStatus() {
    return {
      gap_id: this.gapId,
      escalation_count: this.counter.count,
      max_retries: this.maxRetries,
      remaining_retries: Math.max(0, this.maxRetries - this.counter.count),
      first_escalation: this.counter.first_escalation,
      last_escalation: this.counter.last_escalation,
      history_length: this.counter.history.length,
    };
  }
}

/**
 * Create escalation counter for a gap
 */
function createEscalationCounter(gapId, state) {
  return new EscalationCounter(gapId, state);
}

/**
 * Get all active escalation counters
 */
function getActiveEscalations(state) {
  const counters = state.skill_evolver?.escalation_counters || {};
  return Object.entries(counters)
    .filter(([_, counter]) => counter.count > 0)
    .map(([gapId, counter]) => ({
      gap_id: gapId,
      ...counter,
    }));
}

/**
 * Clean up old escalation counters (older than 7 days)
 */
function cleanupOldEscalations(state) {
  const counters = state.skill_evolver?.escalation_counters || {};
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const cleaned = {};
  Object.entries(counters).forEach(([gapId, counter]) => {
    const lastEscalation = counter.last_escalation
      ? new Date(counter.last_escalation)
      : null;

    if (!lastEscalation || lastEscalation > sevenDaysAgo) {
      cleaned[gapId] = counter;
    }
  });

  state.skill_evolver.escalation_counters = cleaned;
  return Object.keys(counters).length - Object.keys(cleaned).length;
}

module.exports = {
  EscalationCounter,
  createEscalationCounter,
  getActiveEscalations,
  cleanupOldEscalations,
};
