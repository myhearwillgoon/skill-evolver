#!/usr/bin/env node

const { run } = require("../src/harvester-cli.cjs");

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg.startsWith("--gap-id=")) {
      options.gapId = arg.slice("--gap-id=".length);
    } else if (arg === "--auto") {
      options.auto = true;
    } else if (arg.startsWith("--max-harvests=")) {
      options.max_harvests = parseInt(arg.slice("--max-harvests=".length), 10);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: skill-harvester --gap-id=ID | --auto [options]

Options:
  --gap-id=ID           Harvest a specific gap
  --auto                Harvest top ready gap(s)
  --max-harvests=N      Limit auto harvests (default: 1)
  --help, -h            Show this help
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (!options.gapId && !options.auto) {
    console.error("Error: --gap-id=... or --auto is required.");
    printUsage();
    process.exit(2);
  }

  try {
    await run(options);
  } catch (error) {
    console.error(`[skill-harvester] Error: ${error.stack || error.message}`);
    process.exit(2);
  }
}

main();
