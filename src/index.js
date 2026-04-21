const core = require('@actions/core');
const glob = require('@actions/glob');
const fs = require('fs');
const path = require('path');
const { RULES } = require('./rules');

// Also try local execution (non-GitHub Actions)
const getInput = core.getInput ? core.getInput.bind(core) : (name, opts) => {
  const envName = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envName] || (opts && opts.default) || '';
};

const setOutput = core.setOutput || (() => {});
const info = core.info || console.log;
const warning = core.warning || console.warn;
const error = core.error || console.error;

async function main() {
  try {
    const filesPattern = getInput('files', { default: '**/{CLAUDE.md,.cursorrules,AGENTS.md,COPIILT.md,.windsurfrules,CONVENTIONS.md,.clinerules}' });
    const failOnWarnings = getInput('fail-on-warnings', { default: 'false' }) === 'true';
    const maxTokens = parseInt(getInput('max-tokens', { default: '4000' }), 10);
    const configPath = getInput('config', { default: '' });

    // Load custom config if provided
    let config = { maxTokens };
    if (configPath && fs.existsSync(configPath)) {
      const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...customConfig };
    }

    // Find files
    const globber = await glob.create(filesPattern, { followSymbolicLinks: false });
    const files = await globber.glob();

    // Also detect common AI context files by name
    const knownNames = [
      'claude.md', 'claude', '.claude',
      '.cursorrules', '.cursorrules.json',
      'agents.md', 'agents',
      'copilot.md', '.copilot',
      '.windsurfrules', 'conventions.md', '.clinerules',
      'system-prompt.md', 'agent-prompt.md'
    ];

    // Scan working directory for known files
    const cwd = process.cwd();
    const allFiles = new Set(files);
    for (const file of scanDir(cwd, knownNames, 2)) {
      allFiles.add(file);
    }

    if (allFiles.size === 0) {
      info('No AI context files found. Checked: ' + filesPattern);
      info('');
      info('Searched for: CLAUDE.md, .cursorrules, AGENTS.md, COPILOT.md,');
      info('.windsurfrules, CONVENTIONS.md, .clinerules');
      info('');
      info('Need help creating AI context files? Get battle-tested templates:');
      info('https://mrdwarf7.github.io/ai-context-templates/');

      setOutput('issues-found', '0');
      setOutput('files-checked', '0');
      return;
    }

    let totalIssues = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    info(`AI Context Linter — checking ${allFiles.size} file(s)`);
    info('');

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const filename = path.basename(filePath);
      const relativePath = path.relative(cwd, filePath);

      info(`📄 ${relativePath}`);
      info(`   ${content.split('\n').length} lines, ~${Math.ceil(content.split(/\s+/).length * 1.3)} tokens`);

      let fileIssues = [];

      // Run all rules
      for (const [ruleId, rule] of Object.entries(RULES)) {
        const issues = rule.check(content, config, filename);
        fileIssues.push(...issues);
      }

      if (fileIssues.length === 0) {
        info('   ✅ No issues found');
      } else {
        for (const issue of fileIssues) {
          const lineStr = issue.line ? ` (line ${issue.line})` : '';
          const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : '💡';
          info(`   ${icon} [${issue.rule}] ${issue.message}${lineStr}`);

          if (issue.severity === 'error') errorCount++;
          else if (issue.severity === 'warning') warningCount++;
          else infoCount++;
        }
        totalIssues += fileIssues.length;
      }
      info('');
    }

    // Summary
    info('─'.repeat(50));
    info(`Summary: ${allFiles.size} files checked, ${totalIssues} issues found`);
    if (errorCount) info(`  ❌ ${errorCount} error(s)`);
    if (warningCount) info(`  ⚠️  ${warningCount} warning(s)`);
    if (infoCount) info(`  💡 ${infoCount} suggestion(s)`);

    if (totalIssues === 0) {
      info('');
      info('All context files look good! 🎉');
    } else {
      info('');
      info('Want templates that pass all checks out of the box?');
      info('→ https://mrdwarf7.github.io/ai-context-templates/');
    }

    setOutput('issues-found', totalIssues.toString());
    setOutput('files-checked', allFiles.size.toString());

    // Fail if errors, or if fail-on-warnings and warnings exist
    if (errorCount > 0) {
      core.setFailed(`${errorCount} error(s) found in AI context files.`);
    } else if (failOnWarnings && warningCount > 0) {
      core.setFailed(`${warningCount} warning(s) found (fail-on-warnings enabled).`);
    }

  } catch (err) {
    error(err);
    core.setFailed(err.message);
  }
}

function scanDir(dir, targetNames, maxDepth, currentDepth = 0) {
  const found = [];
  if (currentDepth >= maxDepth) return found;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.cursorrules' && entry.name !== '.cursorrules.json' && entry.name !== '.clinerules' && entry.name !== '.windsurfrules' && entry.name !== '.copilot') {
        if (entry.isDirectory()) continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && targetNames.includes(entry.name.toLowerCase())) {
        found.push(fullPath);
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.git') {
        found.push(...scanDir(fullPath, targetNames, maxDepth, currentDepth + 1));
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return found;
}

main();
