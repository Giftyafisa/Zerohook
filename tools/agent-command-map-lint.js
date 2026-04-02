const fs = require('fs');
const path = require('path');

function extractCommands(text) {
  const matches = text.match(/\/[a-z]-[a-z0-9-]+/gi) || [];
  return matches.map((cmd) => cmd.toLowerCase());
}

function unique(list) {
  return [...new Set(list)];
}

function main() {
  const repoRoot = process.cwd();
  const agentsDir = path.join(repoRoot, '.claude', 'agents');
  const mapPath = path.join(agentsDir, 'quantum-command-map.md');

  if (!fs.existsSync(agentsDir)) {
    console.error('ERROR: .claude/agents directory not found.');
    process.exit(1);
  }

  if (!fs.existsSync(mapPath)) {
    console.error('ERROR: .claude/agents/quantum-command-map.md not found.');
    process.exit(1);
  }

  const agentFiles = fs
    .readdirSync(agentsDir)
    .filter((name) => name.endsWith('.agent.md'))
    .sort();

  const commandToSources = new Map();

  for (const fileName of agentFiles) {
    const filePath = path.join(agentsDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    const commands = unique(extractCommands(content));

    for (const cmd of commands) {
      if (!commandToSources.has(cmd)) {
        commandToSources.set(cmd, new Set());
      }
      commandToSources.get(cmd).add(fileName);
    }
  }

  const mapContent = fs.readFileSync(mapPath, 'utf8');
  const mapCommands = new Set(unique(extractCommands(mapContent)));

  const agentCommands = [...commandToSources.keys()].sort();
  const missingInMap = agentCommands.filter((cmd) => !mapCommands.has(cmd));

  if (missingInMap.length > 0) {
    console.error('Command map lint failed. Missing commands in quantum-command-map.md:');
    for (const cmd of missingInMap) {
      const sources = [...commandToSources.get(cmd)].sort().join(', ');
      console.error(`  ${cmd}  (from: ${sources})`);
    }
    process.exit(1);
  }

  const mapOnly = [...mapCommands].filter((cmd) => !commandToSources.has(cmd)).sort();

  console.log('Command map lint passed.');
  console.log(`  Agent files scanned: ${agentFiles.length}`);
  console.log(`  Unique agent commands: ${agentCommands.length}`);
  console.log(`  Map commands: ${mapCommands.size}`);

  if (mapOnly.length > 0) {
    console.log('  Note: commands present in map but not currently found in .agent.md files:');
    for (const cmd of mapOnly) {
      console.log(`    ${cmd}`);
    }
  }
}

main();
