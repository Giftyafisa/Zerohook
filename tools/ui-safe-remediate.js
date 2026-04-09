#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SPACING_TOKENS = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const CSS_EXTENSIONS = new Set(['.css', '.scss', '.sass']);

function parseArgs(argv) {
  const options = {
    write: false,
    root: path.resolve(__dirname, '..', 'client', 'src')
  };

  for (const arg of argv) {
    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.write = false;
      continue;
    }

    if (arg.startsWith('--root=')) {
      options.root = path.resolve(arg.slice('--root='.length));
    }
  }

  return options;
}

function walkFiles(dirPath, files) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'build') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (CSS_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }
}

function nearestSpacingToken(pxValue) {
  let winner = SPACING_TOKENS[0];
  let winnerDistance = Math.abs(pxValue - winner);

  for (const token of SPACING_TOKENS) {
    const distance = Math.abs(pxValue - token);
    if (distance < winnerDistance) {
      winner = token;
      winnerDistance = distance;
    }
  }

  return winner;
}

function normalizeSpacingValue(rawValue) {
  const trimmed = rawValue.trim();

  if (
    trimmed.includes('calc(') ||
    trimmed.includes('var(') ||
    trimmed.includes('%') ||
    trimmed.includes('rem') ||
    trimmed.includes('em') ||
    trimmed.includes('vw') ||
    trimmed.includes('vh') ||
    trimmed.includes('auto') ||
    trimmed.includes('/')
  ) {
    return null;
  }

  let important = '';
  let valueBody = trimmed;

  if (valueBody.endsWith('!important')) {
    important = ' !important';
    valueBody = valueBody.slice(0, -'!important'.length).trim();
  }

  const parts = valueBody.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const normalizedParts = [];
  let changed = false;

  for (const part of parts) {
    if (part === '0' || part === '0px') {
      normalizedParts.push('0');
      if (part !== '0') {
        changed = true;
      }
      continue;
    }

    if (!/^\d+px$/.test(part)) {
      return null;
    }

    const numericValue = Number.parseInt(part, 10);
    const token = nearestSpacingToken(numericValue);
    const nextPart = token === 0 ? '0' : `${token}px`;

    if (nextPart !== part) {
      changed = true;
    }

    normalizedParts.push(nextPart);
  }

  if (!changed) {
    return null;
  }

  return `${normalizedParts.join(' ')}${important}`;
}

function applySafeRemediation(content) {
  let nextContent = content;
  let spacingFixes = 0;
  let overflowFixes = 0;

  const spacingDeclarationPattern = /(^[ \t]*)(margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap)\s*:\s*([^;]+);/gm;

  nextContent = nextContent.replace(
    spacingDeclarationPattern,
    (fullMatch, indent, property, value) => {
      const normalized = normalizeSpacingValue(value);
      if (!normalized) {
        return fullMatch;
      }

      spacingFixes += 1;
      return `${indent}${property}: ${normalized};`;
    }
  );

  const widthOverflowPattern = /(^[ \t]*)width\s*:\s*100vw\s*;/gm;
  nextContent = nextContent.replace(widthOverflowPattern, (fullMatch, indent) => {
    overflowFixes += 1;
    return `${indent}width: 100%;`;
  });

  const maxWidthOverflowPattern = /(^[ \t]*)max-width\s*:\s*100vw\s*;/gm;
  nextContent = nextContent.replace(maxWidthOverflowPattern, (fullMatch, indent) => {
    overflowFixes += 1;
    return `${indent}max-width: 100%;`;
  });

  return {
    content: nextContent,
    spacingFixes,
    overflowFixes
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.root)) {
    console.error(`[ui-remediate] Root path not found: ${options.root}`);
    process.exit(1);
  }

  const files = [];
  walkFiles(options.root, files);

  let touchedFiles = 0;
  let totalSpacingFixes = 0;
  let totalOverflowFixes = 0;

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, 'utf8');
    const result = applySafeRemediation(original);

    if (result.content === original) {
      continue;
    }

    touchedFiles += 1;
    totalSpacingFixes += result.spacingFixes;
    totalOverflowFixes += result.overflowFixes;

    if (options.write) {
      fs.writeFileSync(filePath, result.content, 'utf8');
    }
  }

  const modeLabel = options.write ? 'write' : 'dry-run';
  console.log(`[ui-remediate] Mode: ${modeLabel}`);
  console.log(`[ui-remediate] CSS files scanned: ${files.length}`);
  console.log(`[ui-remediate] Files with safe fixes: ${touchedFiles}`);
  console.log(`[ui-remediate] Spacing token fixes: ${totalSpacingFixes}`);
  console.log(`[ui-remediate] Overflow fixes: ${totalOverflowFixes}`);

  if (!options.write && touchedFiles > 0) {
    console.log('[ui-remediate] Run with --write to apply these safe fixes.');
  }
}

main();
