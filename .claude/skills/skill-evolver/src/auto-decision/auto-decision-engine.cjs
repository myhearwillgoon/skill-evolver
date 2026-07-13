/**
 * Auto-Decision Engine
 * Coordinates L1/L2/L3 validation and makes final publish decisions
 * Replaces Human Gate with automated decision making (3-strike escalation)
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { loadConfig } = require("../config.cjs");
const { readState, writeState, logHandoff } = require("../state.cjs");
const { EscalationCounter } = require("./escalation-counter.cjs");
const { runVerifier } = require("../verifier-bridge.cjs");

class AutoDecisionEngine {
  constructor(harvestId, state) {
    this.harvestId = harvestId;
    this.state = state;
    this.config = loadConfig();
    this.adConfig = this.loadAutoDecisionConfig();
    this.escalationCounter = new EscalationCounter(harvestId, state);
  }

  /**
   * Load auto-decision configuration
   */
  loadAutoDecisionConfig() {
    const configPath = path.join(
      process.env.HOME || ".",
      ".claude",
      "skills",
      "skill-evolver",
      "auto-decision.config.yaml"
    );

    if (!fs.existsSync(configPath)) {
      console.warn("[auto-decision] Config not found, using defaults");
      return this.getDefaultConfig();
    }

    try {
      const content = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(content);
      return config.auto_decision || this.getDefaultConfig();
    } catch (error) {
      console.warn("[auto-decision] Failed to load config:", error.message);
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      enabled: false,
      stages: {
        l1_static: { weight: 0.3, threshold: 60 },
        l2_semantic: { weight: 0.4, threshold: 60 },
        l3_runtime: { weight: 0.3, threshold: 60 },
      },
      decision_matrix: {
        approve: { condition: "l1 >= 80 AND l2 >= 70 AND l3 >= 60" },
        conditional_approve: { condition: "l1 >= 60 AND l2 >= 60 AND l3 >= 60" },
        reject: { condition: "l1 < 60 OR l2 < 60 OR l3 < 60" },
        escalate: { condition: "conflict_detected OR confidence < 0.70" },
      },
      escalation: {
        max_retries: 3,
        backoff: "exponential",
      },
    };
  }

  /**
   * Run full auto-decision pipeline
   */
  async runDecision(draftDir, draftPath) {
    if (!this.adConfig.enabled) {
      return {
        type: "MANUAL_REQUIRED",
        reason: "auto_decision_disabled",
        message: "Auto-decision is disabled, manual review required",
      };
    }

    console.log(`[auto-decision] Running decision for ${this.harvestId}`);

    // Get harvest info
    const harvest = this.getHarvest();
    if (!harvest) {
      throw new Error(`Harvest ${this.harvestId} not found`);
    }

    // Run the decision with escalation logic
    return await this.escalationCounter.attemptDecision(async () => {
      // Stage 1: L1 Static Check
      const l1Result = await this.runL1Check(draftPath);
      console.log(`[auto-decision] L1 score: ${l1Result.score}`);

      // Stage 2: L2 Semantic Evaluation
      const l2Result = await this.runL2Check(draftPath, harvest);
      console.log(`[auto-decision] L2 score: ${l2Result.score}`);

      // Stage 3: L3 Runtime Test
      const l3Result = await this.runL3Check(draftDir, harvest);
      console.log(`[auto-decision] L3 score: ${l3Result.score}`);

      // Calculate weighted final score
      const scores = {
        l1: l1Result.score,
        l2: l2Result.score,
        l3: l3Result.score,
      };

      const weights = {
        l1: this.adConfig.stages.l1_static.weight,
        l2: this.adConfig.stages.l2_semantic.weight,
        l3: this.adConfig.stages.l3_runtime.weight,
      };

      const finalScore =
        scores.l1 * weights.l1 +
        scores.l2 * weights.l2 +
        scores.l3 * weights.l3;

      // Check for conflicts
      const conflicts = this.detectConflicts(scores);

      // Make decision
      const decision = this.makeDecision(scores, finalScore, conflicts);

      // Log decision
      this.logDecision({
        harvest_id: this.harvestId,
        scores,
        weights,
        final_score: finalScore,
        decision: decision.type,
        conflicts,
        details: {
          l1: l1Result,
          l2: l2Result,
          l3: l3Result,
        },
      });

      return {
        type: decision.type,
        scores,
        final_score: finalScore,
        confidence: decision.confidence,
        rationale: decision.rationale,
        conflicts,
        context: {
          harvest_id: this.harvestId,
          draft_path: draftPath,
        },
      };
    });
  }

  /**
   * Stage 1: L1 Static Check
   */
  async runL1Check(draftPath) {
    const checks = this.adConfig.stages.l1_static.checks;
    const results = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Read draft content
    const content = fs.readFileSync(draftPath, "utf8");

    for (const check of checks) {
      const result = await this.runL1CheckItem(check, content, draftPath);
      results.push(result);
      totalScore += result.score * (check.weight || 0.25);
      totalWeight += check.weight || 0.25;
    }

    const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

    return {
      score: Math.round(normalizedScore),
      passed: normalizedScore >= this.adConfig.stages.l1_static.threshold,
      results,
    };
  }

  /**
   * Run individual L1 check
   */
  async runL1CheckItem(check, content, draftPath) {
    const checkName = check.name;
    let score = 0;
    let details = [];

    switch (checkName) {
      case "schema_validation":
        // Check frontmatter schema
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          try {
            const frontmatter = yaml.load(frontmatterMatch[1]);
            const required = ["name", "description", "type"];
            const present = required.filter((k) => frontmatter[k]);
            score = (present.length / required.length) * 100;
            details = present;
          } catch (e) {
            score = 0;
            details = ["invalid_yaml"];
          }
        } else {
          score = 0;
          details = ["no_frontmatter"];
        }
        break;

      case "duplicate_detection":
        // Already checked during harvest, use that data
        const harvest = this.getHarvest();
        if (harvest?.similarity_check) {
          const sim = harvest.similarity_check.max_similarity;
          score = Math.max(0, (1 - sim) * 100);
          details = { max_similarity: sim };
        } else {
          score = 50; // Unknown
        }
        break;

      case "syntax_check":
        // Basic markdown syntax check
        const hasProperStructure =
          content.includes("#") && content.includes("##");
        const hasCodeBlocks = content.includes("```");
        score = hasProperStructure ? (hasCodeBlocks ? 100 : 80) : 50;
        details = { has_structure: hasProperStructure, has_code: hasCodeBlocks };
        break;

      case "completeness_check":
        // Check required sections
        const requiredSections = check.required_sections || [
          "name",
          "description",
          "steps",
          "examples",
        ];
        const presentSections = requiredSections.filter((section) => {
          const patterns = [
            new RegExp(`^## ${section}`, "im"),
            new RegExp(`^### ${section}`, "im"),
          ];
          return patterns.some((p) => p.test(content));
        });
        score = (presentSections.length / requiredSections.length) * 100;
        details = { present: presentSections, missing: requiredSections.filter(s => !presentSections.includes(s)) };
        break;

      default:
        score = 50; // Unknown check
    }

    return { name: checkName, score: Math.round(score), details };
  }

  /**
   * Stage 2: L2 Semantic Evaluation
   */
  async runL2Check(draftPath, harvest) {
    const checks = this.adConfig.stages.l2_semantic.checks;
    const results = [];
    let totalScore = 0;
    let totalWeight = 0;

    for (const check of checks) {
      const result = await this.runL2CheckItem(check, draftPath, harvest);
      results.push(result);
      totalScore += result.score * (check.weight || 0.33);
      totalWeight += check.weight || 0.33;
    }

    const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

    return {
      score: Math.round(normalizedScore),
      passed: normalizedScore >= this.adConfig.stages.l2_semantic.threshold,
      results,
    };
  }

  /**
   * Run individual L2 check
   */
  async runL2CheckItem(check, draftPath, harvest) {
    const checkName = check.name;
    let score = 0;
    let details = {};

    switch (checkName) {
      case "similarity_depth":
        // Deep semantic similarity (already computed)
        const sim = harvest?.similarity_check?.max_similarity || 0;
        score = Math.max(0, (1 - sim) * 100);
        details = { max_similarity: sim, threshold: 0.82 };
        break;

      case "risk_assessment":
        // Assess potential risks
        const content = fs.readFileSync(draftPath, "utf8");
        const riskCategories = check.risk_categories || [];
        const detectedRisks = [];

        // Simple risk detection
        if (content.includes("rm -rf") || content.includes("DELETE")) {
          detectedRisks.push("destructive_operations");
        }
        if (content.includes("API_KEY") || content.includes("token")) {
          detectedRisks.push("credential_exposure");
        }
        if (content.includes("fetch(") || content.includes("axios")) {
          detectedRisks.push("external_api_dependency");
        }

        score =
          detectedRisks.length === 0
            ? 100
            : Math.max(0, 100 - detectedRisks.length * 20);
        details = { risks: detectedRisks };
        break;

      case "alignment_check":
        // Check alignment with ecosystem
        const uxHelpersDir = this.config.ux_helpers_dir;
        const isUxHelper = draftPath.includes("ux-helpers");
        score = isUxHelper ? 90 : 80; // UX-Helpers get higher alignment
        details = { is_ux_helper: isUxHelper, category: "ux-helper" };
        break;

      default:
        score = 50;
    }

    return { name: checkName, score: Math.round(score), details };
  }

  /**
   * Stage 3: L3 Runtime Test
   */
  async runL3Check(draftDir, harvest) {
    // Run the actual skills-verifier
    try {
      const verifierResult = runVerifier(draftDir, { mode: "full" });

      return {
        score: verifierResult.scores?.l3 || 50,
        passed: (verifierResult.scores?.l3 || 0) >=
          this.adConfig.stages.l3_runtime.threshold,
        results: [
          {
            name: "verifier_l3",
            score: verifierResult.scores?.l3 || 0,
            details: verifierResult,
          },
        ],
      };
    } catch (error) {
      console.warn("[auto-decision] L3 check failed:", error.message);
      return {
        score: 0,
        passed: false,
        results: [
          {
            name: "verifier_l3",
            score: 0,
            error: error.message,
          },
        ],
      };
    }
  }

  /**
   * Detect conflicts between stages
   */
  detectConflicts(scores) {
    const conflicts = [];
    const rules = this.adConfig.conflict_detection?.rules || [];

    for (const rule of rules) {
      let conflict = false;

      switch (rule.name) {
        case "high_variance":
          const maxScore = Math.max(scores.l1, scores.l2, scores.l3);
          const minScore = Math.min(scores.l1, scores.l2, scores.l3);
          conflict = maxScore - minScore > 40;
          break;

        case "l1_pass_l2_fail":
          conflict = scores.l1 >= 80 && scores.l2 < 50;
          break;

        case "l2_pass_l3_fail":
          conflict = scores.l2 >= 80 && scores.l3 < 50;
          break;
      }

      if (conflict) {
        conflicts.push(rule.name);
      }
    }

    return conflicts;
  }

  /**
   * Make final decision based on scores and conflicts
   */
  makeDecision(scores, finalScore, conflicts) {
    const matrix = this.adConfig.decision_matrix;

    // Check conflicts first
    if (conflicts.length > 0) {
      return {
        type: "ESCALATE",
        confidence: 0.5,
        rationale: `Conflicts detected: ${conflicts.join(", ")}`,
      };
    }

    // Check approve condition
    if (
      scores.l1 >= 80 &&
      scores.l2 >= 70 &&
      scores.l3 >= 60 &&
      finalScore >= 75
    ) {
      return {
        type: "APPROVE",
        confidence: finalScore / 100,
        rationale: `All stages passed strongly (L1=${scores.l1}, L2=${scores.l2}, L3=${scores.l3}, final=${finalScore.toFixed(1)})`,
      };
    }

    // Check conditional approve
    if (scores.l1 >= 60 && scores.l2 >= 60 && scores.l3 >= 60) {
      return {
        type: "CONDITIONAL_APPROVE",
        confidence: finalScore / 100,
        rationale: `All stages passed (L1=${scores.l1}, L2=${scores.l2}, L3=${scores.l3}, final=${finalScore.toFixed(1)})`,
      };
    }

    // Check reject
    if (scores.l1 < 60 || scores.l2 < 60 || scores.l3 < 60) {
      const failedStages = [];
      if (scores.l1 < 60) failedStages.push("L1");
      if (scores.l2 < 60) failedStages.push("L2");
      if (scores.l3 < 60) failedStages.push("L3");

      return {
        type: "REJECT",
        confidence: 1 - finalScore / 100,
        rationale: `Stages failed: ${failedStages.join(", ")}`,
      };
    }

    // Default to escalate
    return {
      type: "ESCALATE",
      confidence: 0.5,
      rationale: "Edge case - could not determine clear decision",
    };
  }

  /**
   * Get harvest from state
   */
  getHarvest() {
    return (this.state.skill_evolver?.harvests || []).find(
      (h) => h.id === this.harvestId
    );
  }

  /**
   * Log decision to audit trail
   */
  logDecision(decisionData) {
    // Update harvest with decision
    const harvest = this.getHarvest();
    if (harvest) {
      harvest.auto_decision = {
        timestamp: new Date().toISOString(),
        ...decisionData,
      };
    }

    // Add to decision log
    if (!this.state.skill_evolver.decision_log) {
      this.state.skill_evolver.decision_log = [];
    }

    this.state.skill_evolver.decision_log.push({
      timestamp: new Date().toISOString(),
      ...decisionData,
    });

    // Log handoff
    logHandoff(this.state, {
      from: "auto-decision",
      to: decisionData.decision === "APPROVE" ? "publish" : "human-gate",
      harvest_id: this.harvestId,
      decision: decisionData.decision,
      confidence: decisionData.confidence,
    });
  }

  /**
   * Publish approved skill
   */
  async publishSkill(draftDir, draftPath) {
    const harvest = this.getHarvest();
    if (!harvest) {
      throw new Error(`Harvest ${this.harvestId} not found`);
    }

    // Determine target directory
    const targetDir = path.join(
      process.env.HOME || ".",
      ".claude",
      "skills",
      "ux-helpers",
      path.basename(draftDir)
    );

    // Create target directory
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy skill file
    const targetPath = path.join(targetDir, "SKILL.md");
    fs.copyFileSync(draftPath, targetPath);

    // Update harvest status
    harvest.status = "published";
    harvest.published_at = new Date().toISOString();
    harvest.published_to = targetDir;

    console.log(`[auto-decision] Published skill to ${targetPath}`);

    // Log handoff
    logHandoff(this.state, {
      from: "auto-decision",
      to: "effect-measurement",
      harvest_id: this.harvestId,
      skill_path: targetPath,
      action: "setup_shadow_mode",
    });

    return {
      published: true,
      path: targetPath,
      harvest_id: this.harvestId,
    };
  }
}

/**
 * Create auto-decision engine for a harvest
 */
function createAutoDecisionEngine(harvestId, state) {
  return new AutoDecisionEngine(harvestId, state);
}

/**
 * Run auto-decision for a harvest
 */
async function runAutoDecision(harvestId, draftDir, draftPath, state) {
  const engine = createAutoDecisionEngine(harvestId, state);
  return await engine.runDecision(draftDir, draftPath);
}

module.exports = {
  AutoDecisionEngine,
  createAutoDecisionEngine,
  runAutoDecision,
};
