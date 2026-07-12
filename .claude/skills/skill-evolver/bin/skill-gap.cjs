#!/usr/bin/env node

const { run } = require("../src/gap-cli.cjs");

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg === "--promote" || arg === "--cluster") {
      options.promote = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: skill-gap --promote

Options:
  --promote, --cluster  Cluster signals and promote qualified gaps
  --help, -h            Show this help
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (!options.promote) {
    console.error("Error: --promote is required.");
    printUsage();
    process.exit(2);
  }

  try {
    await run(options);
  } catch (error) {
    console.error(`[skill-gap] Error: ${error.stack || error.message}`);
    process.exit(2);
  }
}

main();
