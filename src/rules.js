/**
 * AI Context Linter — Rules Engine
 * Each rule returns { rule, severity, message, line? }
 */

const RULES = {
  // ===== SECURITY RULES =====
  'sec-api-key': {
    name: 'Hardcoded API Key',
    severity: 'error',
    check(content) {
      const issues = [];
      const patterns = [
        { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?/gi, msg: 'Possible hardcoded API key' },
        { regex: /(?:sk-|pk-|rk-)[a-zA-Z0-9]{20,}/g, msg: 'Stripe-style key detected' },
        { regex: /ghp_[a-zA-Z0-9]{36}/g, msg: 'GitHub personal access token detected' },
        { regex: /ghs_[a-zA-Z0-9]{36}/g, msg: 'GitHub app token detected' },
        { regex: /sk-[a-zA-Z0-9]{20,}/g, msg: 'OpenAI-style API key detected' },
        { regex: /xox[bpsa]-[a-zA-Z0-9\-]{10,}/g, msg: 'Slack token detected' },
      ];
      for (const { regex, msg } of patterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          const line = content.substring(0, match.index).split('\n').length;
          issues.push({ rule: 'sec-api-key', severity: 'error', message: msg, line });
        }
      }
      return issues;
    }
  },

  'sec-private-path': {
    name: 'Private File Path',
    severity: 'warning',
    check(content) {
      const issues = [];
      const patterns = [
        /(?:\/home\/|\/Users\/)[^\s\n]+/g,
        /(?:C:\\\\Users\\\\)[^\s\n]+/g,
        /~\/\.[a-z]+\/(?:token|secret|credential|password)/gi,
      ];
      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          const line = content.substring(0, match.index).split('\n').length;
          issues.push({
            rule: 'sec-private-path',
            severity: 'warning',
            message: `Private file path exposed: ${match[0].substring(0, 60)}...`,
            line
          });
        }
      }
      return issues;
    }
  },

  // ===== STRUCTURAL RULES =====
  'struct-too-long': {
    name: 'File Too Long',
    severity: 'warning',
    check(content, config) {
      const maxTokens = config.maxTokens || 4000;
      const estimatedTokens = Math.ceil(content.split(/\s+/).length * 1.3);
      if (estimatedTokens > maxTokens) {
        return [{
          rule: 'struct-too-long',
          severity: 'warning',
          message: `File is ~${estimatedTokens} tokens (max recommended: ${maxTokens}). Long context files waste tokens and may dilute important instructions.`
        }];
      }
      return [];
    }
  },

  'struct-no-sections': {
    name: 'No Section Headers',
    severity: 'warning',
    check(content) {
      const headers = content.match(/^#{1,3}\s+.+$/gm) || [];
      if (content.length > 500 && headers.length === 0) {
        return [{
          rule: 'struct-no-sections',
          severity: 'warning',
          message: 'File has no section headers (## or ###). Structured context is easier for AI agents to parse.'
        }];
      }
      return [];
    }
  },

  'struct-empty-sections': {
    name: 'Empty Sections',
    severity: 'warning',
    check(content) {
      const issues = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^#{1,3}\s+.+$/.test(lines[i]) && /^#{1,3}\s+.+$/.test(lines[i + 1])) {
          issues.push({
            rule: 'struct-empty-sections',
            severity: 'warning',
            message: `Empty section: "${lines[i].trim()}" has no content before the next heading.`,
            line: i + 1
          });
        }
      }
      return issues;
    }
  },

  'struct-missing-description': {
    name: 'Missing Project Description',
    severity: 'info',
    check(content) {
      const hasDesc = /^(?:#{1,3}\s+.*(project|about|overview|description|introduction).*)$/im.test(content)
        || content.length < 200;
      if (!hasDesc && content.length > 300) {
        return [{
          rule: 'struct-missing-description',
          severity: 'info',
          message: 'No project description/overview section found. AI agents work better when they understand the project context.'
        }];
      }
      return [];
    }
  },

  // ===== AI ANTI-PATTERN RULES =====
  'ai-vague-instructions': {
    name: 'Vague Instructions',
    severity: 'warning',
    check(content) {
      const issues = [];
      const vaguePatterns = [
        { regex: /^(?:.*\b(?:be|do|write|make|use)\s+(?:good|nice|proper|correct|appropriate|standard)\b.*)$/gim, msg: 'Vague directive — "good/nice/proper" gives the AI nothing specific.' },
        { regex: /^(?:.*\b(?:follow|use)\s+(?:best\s+practices|conventions)\b.*)$/gim, msg: '"Follow best practices" is too vague — specify which practices.' },
        { regex: /^(?:.*\b(?:don'?t|do\s+not)\s+(?:be|do)\s+(?:stupid|dumb|silly|bad)\b.*)$/gim, msg: 'Negative-only instruction — tell the AI what TO do, not just what not to do.' },
      ];
      for (const { regex, msg } of vaguePatterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          const line = content.substring(0, match.index).split('\n').length;
          issues.push({ rule: 'ai-vague-instructions', severity: 'warning', message: msg, line });
        }
      }
      return issues;
    }
  },

  'ai-conflicting-rules': {
    name: 'Potentially Conflicting Rules',
    severity: 'warning',
    check(content) {
      const issues = [];
      // Check for "always" and "never" about the same topic
      const alwaysMatches = [...content.matchAll(/\balways\s+(\w+)/gi)];
      const neverMatches = [...content.matchAll(/\bnever\s+(\w+)/gi)];
      for (const a of alwaysMatches) {
        for (const n of neverMatches) {
          if (a[1].toLowerCase() === n[1].toLowerCase()) {
            issues.push({
              rule: 'ai-conflicting-rules',
              severity: 'warning',
              message: `Conflicting rules: "always ${a[1]}" and "never ${n[1]}"`
            });
          }
        }
      }
      return issues;
    }
  },

  // ===== BEST PRACTICE RULES =====
  'bp-no-structure-hints': {
    name: 'No Output Format Guidance',
    severity: 'info',
    check(content) {
      const hasFormat = /\b(?:format|style|output|response|code\s+style|indent|tab|space|wrap)\b/i.test(content);
      if (!hasFormat && content.length > 300) {
        return [{
          rule: 'bp-no-structure-hints',
          severity: 'info',
          message: 'No output format or code style guidance found. Consider specifying formatting preferences.'
        }];
      }
      return [];
    }
  },

  'bp-too-short': {
    name: 'Context Too Short',
    severity: 'info',
    check(content) {
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > 10 && wordCount < 50) {
        return [{
          rule: 'bp-too-short',
          severity: 'info',
          message: `Only ${wordCount} words. Very short context files may not give the AI enough to work with.`
        }];
      }
      return [];
    }
  },

  'bp-html-comments': {
    name: 'Suspicious HTML Comments',
    severity: 'warning',
    check(content) {
      const issues = [];
      const htmlComments = content.match(/<!--[\s\S]*?-->/g) || [];
      for (const comment of htmlComments) {
        if (comment.length > 100) {
          const line = content.indexOf(comment);
          issues.push({
            rule: 'bp-html-comments',
            severity: 'warning',
            message: 'Large HTML comment detected. This could be a prompt injection attempt — review its contents.',
            line: content.substring(0, line).split('\n').length
          });
        }
      }
      return issues;
    }
  },

  'bp-redundant-instructions': {
    name: 'Redundant/Obvious Instructions',
    severity: 'info',
    check(content) {
      const issues = [];
      const obvious = [
        /write\s+code\s+that\s+works/gi,
        /don'?t\s+include\s+bugs/gi,
        /make\s+sure\s+the\s+code\s+is\s+correct/gi,
        /always\s+write\s+good\s+code/gi,
      ];
      for (const regex of obvious) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          const line = content.substring(0, match.index).split('\n').length;
          issues.push({
            rule: 'bp-redundant-instructions',
            severity: 'info',
            message: `"${match[0]}" is redundant — the AI already tries to do this. Be specific about what "correct" means for your project.`,
            line
          });
        }
      }
      return issues;
    }
  },

  // ===== FILE TYPE SPECIFIC =====
  'ft-claude-missing-tools': {
    name: 'CLAUDE.md Missing Tool Guidance',
    severity: 'info',
    check(content, config, filename) {
      if (!/CLAUDE/i.test(filename)) return [];
      const hasTools = /\b(?:tool|mcp|server|git|test|build|run|command)\b/i.test(content);
      if (!hasTools && content.length > 200) {
        return [{
          rule: 'ft-claude-missing-tools',
          severity: 'info',
          message: 'CLAUDE.md has no tool/command guidance. Consider adding: how to run tests, build, lint, and deploy.'
        }];
      }
      return [];
    }
  },

  'ft-cursor-no-globs': {
    name: '.cursorrules Missing File Scope',
    severity: 'info',
    check(content, config, filename) {
      if (!/cursorrules/i.test(filename)) return [];
      const hasGlob = /\*\.[a-z]+|\/(?:src|lib|app)\//i.test(content);
      if (!hasGlob && content.length > 200) {
        return [{
          rule: 'ft-cursor-no-globs',
          severity: 'info',
          message: '.cursorrules has no file scope patterns. Consider specifying which files/directories these rules apply to.'
        }];
      }
      return [];
    }
  },
};

module.exports = { RULES };
