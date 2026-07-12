const { spawnSync } = require("child_process");
const path = require("path");

const VERIFIER_BIN = "/home/lenovo/.claude/skills/skills-verifier/bin/claude-verify.cjs";

function runVerifier(draftPath, options = {}) {
  const args = [
    VERIFIER_BIN,
    "--path", draftPath,
    "--mode", options.mode || "full",
    "--json",
    "--allow-unattributed-transcript"
  ];

  const result = spawnSync("node", args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 10 * 60 * 1000
  });

  let report = null;
  if (result.stdout) {
    try {
      // The verifier prints a single top-level JSON report when --json is used.
      const jsonStart = result.stdout.indexOf("{");
      if (jsonStart !== -1) {
        report = JSON.parse(result.stdout.slice(jsonStart));
      }
    } catch (error) {
      // ignore parse error
    }
  }

  const status = result.status === 0 ? "passed" : "failed";
  const runId = report?.run?.id || `v_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  return {
    id: runId,
    target: draftPath,
    mode: options.mode || "full",
    status,
    exit_code: result.status,
    scores: {
      l1: report?.scores?.l1_static ?? report?.results?.l1?.score ?? 0,
      l2: report?.scores?.l2_smoke ?? report?.results?.l2?.score ?? 0,
      l3: report?.scores?.l3_runtime ?? report?.results?.l3?.score ?? 0
    },
    findings: report?.findings || [],
    raw_stdout: result.stdout || "",
    raw_stderr: result.stderr || ""
  };
}

module.exports = {
  runVerifier
};
