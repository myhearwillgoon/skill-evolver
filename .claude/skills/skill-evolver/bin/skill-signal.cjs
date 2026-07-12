#!/usr/bin/env node

const { run } = require("../src/signal-cli.cjs");

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--mode=")) {
      options.mode = arg.slice("--mode=".length);
    } else if (arg.startsWith("--max-transcripts=")) {
      options.max_transcripts = parseInt(arg.slice("--max-transcripts=".length), 10);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: skill-signal --mode=scan|promote [options]

Options:
  --mode=scan       Scan transcripts and emit signals
  --mode=promote    Cluster signals and promote qualified gaps
  --dry-run         Report only; do not write STATE.md
  --max-transcripts=N Limit transcripts scanned (scan mode)
  --help, -h        Show this help
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (!options.mode) {
    console.error("Error: --mode=scan|promote is required.");
    printUsage();
    process.exit(2);
  }

  try {
    await run(options);
  } catch (error) {
    console.error(`[skill-signal] Error: ${error.stack || error.message}`);
    process.exit(2);
  }
}

main();
