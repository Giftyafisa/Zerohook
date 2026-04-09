#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const gitDir = path.join(rootDir, '.git');
  const hookFile = path.join(rootDir, '.githooks', 'pre-push');

  if (!fs.existsSync(gitDir)) {
    console.log('[hooks] .git directory not found, skipping git hook installation.');
    return;
  }

  if (!fs.existsSync(hookFile)) {
    console.log('[hooks] .githooks/pre-push not found, skipping hook setup.');
    return;
  }

  const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
  const configResult = spawnSync(gitCommand, ['config', 'core.hooksPath', '.githooks'], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (configResult.error) {
    throw configResult.error;
  }

  if (configResult.status !== 0) {
    throw new Error('Failed to configure git hooksPath to .githooks');
  }

  try {
    fs.chmodSync(hookFile, 0o755);
  } catch (error) {
    // chmod may not apply on all Windows file systems.
  }

  console.log('[hooks] Installed local hooks from .githooks');
}

try {
  main();
} catch (error) {
  console.error(`[hooks] ${error.message}`);
  process.exit(1);
}
