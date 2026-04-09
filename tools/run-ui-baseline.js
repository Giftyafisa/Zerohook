#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VALID_MODES = new Set(['check', 'update']);

function parseArgs(argv) {
  const options = {
    mode: 'check',
    pack: 'public-core'
  };

  for (const arg of argv) {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
      continue;
    }

    if (arg.startsWith('--pack=')) {
      options.pack = arg.slice('--pack='.length);
      continue;
    }
  }

  return options;
}

function readRoutePacks(packsPath) {
  if (!fs.existsSync(packsPath)) {
    throw new Error(`Route baseline pack file not found: ${packsPath}`);
  }

  const raw = fs.readFileSync(packsPath, 'utf8');
  return JSON.parse(raw);
}

function resolvePackList(allPacks, selectedPack) {
  if (selectedPack === 'all') {
    return Object.keys(allPacks);
  }

  if (!allPacks[selectedPack]) {
    const known = Object.keys(allPacks).join(', ');
    throw new Error(`Unknown UI baseline pack: ${selectedPack}. Known packs: ${known}`);
  }

  return [selectedPack];
}

function runPlaywrightForPack({ rootDir, clientDir, mode, pack }) {
  const baselineScript = mode === 'update' ? 'ui:baseline:update' : 'ui:baseline:check';
  const command = `npm run ${baselineScript}`;

  const result = spawnSync(command, {
    cwd: clientDir,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      UI_BASELINE_PACK: pack
    }
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`UI baseline ${mode} failed for pack: ${pack}`);
  }

  const relativeClientDir = path.relative(rootDir, clientDir) || '.';
  console.log(`[ui-baseline] ${mode} passed for pack '${pack}' in ${relativeClientDir}`);
}

function main() {
  try {
    const rootDir = path.resolve(__dirname, '..');
    const clientDir = path.join(rootDir, 'client');
    const packsPath = path.join(clientDir, 'tests', 'ui-baseline.packs.json');
    const options = parseArgs(process.argv.slice(2));

    if (!VALID_MODES.has(options.mode)) {
      throw new Error(`Invalid --mode value: ${options.mode}. Use one of: check, update`);
    }

    const allPacks = readRoutePacks(packsPath);
    const packsToRun = resolvePackList(allPacks, options.pack);

    for (const pack of packsToRun) {
      console.log(`[ui-baseline] Running mode='${options.mode}' pack='${pack}'`);
      runPlaywrightForPack({
        rootDir,
        clientDir,
        mode: options.mode,
        pack
      });
    }
  } catch (error) {
    console.error(`[ui-baseline] ${error.message}`);
    process.exit(1);
  }
}

main();
