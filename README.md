# AI Context Linter

A GitHub Action that checks your AI coding context files for problems before your agent starts writing bad code.

**What it checks:**
- `CLAUDE.md` / `.cursorrules` / `AGENTS.md` / `COPILOT.md` / `.windsurfrules` / `.clinerules`
- Security issues (leaked API keys, private file paths)
- Structural problems (missing sections, empty headings, wall-of-text files)
- AI anti-patterns (vague instructions, conflicting rules, redundant directives)
- File-type specific checks (tool guidance for CLAUDE.md, file scope for .cursorrules)

## Quick Start

```yaml
- uses: MrDwarf7/ai-context-linter@v1
```

That's it. It auto-detects your context files and runs 12 rules against them.

## Full Example

```yaml
name: Lint AI Context Files
on: [push, pull_request]

jobs:
  lint-context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MrDwarf7/ai-context-linter@v1
        with:
          files: '**/{CLAUDE.md,.cursorrules,AGENTS.md}'
          max-tokens: '3000'
          fail-on-warnings: 'false'
```

## What Gets Checked

### Security (errors — these fail the build)
| Rule | What it catches |
|------|----------------|
| `sec-api-key` | Hardcoded API keys (OpenAI, Stripe, GitHub PAT, Slack tokens) |
| `sec-private-path` | Leaked home directory paths (`/home/user/.ssh/...`) |

### Structure (warnings)
| Rule | What it catches |
|------|----------------|
| `struct-too-long` | Files over the token limit — wastes context window, dilutes instructions |
| `struct-no-sections` | 500+ chars with no `##` headings — AI agents parse structured files better |
| `struct-empty-sections` | A heading followed immediately by another heading — empty section |
| `struct-missing-description` | No overview/description section — agent doesn't know what the project is |

### AI Anti-Patterns (warnings)
| Rule | What it catches |
|------|----------------|
| `ai-vague-instructions` | "Be good", "follow best practices", "don't be stupid" — says nothing useful |
| `ai-conflicting-rules` | "Always use tabs" + "never use tabs" — confuses the agent |
| `bp-redundant-instructions` | "Write code that works" — the AI already tries to do this |

### Best Practices (info — suggestions, not failures)
| Rule | What it catches |
|------|----------------|
| `bp-no-structure-hints` | No formatting/style guidance — consider adding it |
| `bp-too-short` | Under 50 words — might not be enough context |
| `bp-html-comments` | Large hidden HTML comments (possible prompt injection vector) |

### File-Type Specific (info)
| Rule | What it catches |
|------|----------------|
| `ft-claude-missing-tools` | CLAUDE.md with no tool/command references |
| `ft-cursor-no-globs` | .cursorrules with no file scope patterns |

## Outputs

| Output | Description |
|--------|-------------|
| `issues-found` | Total count of errors + warnings + suggestions |
| `files-checked` | Number of context files found and checked |

## Custom Config

Create `.ai-context-linter.yml` in your repo root:

```yaml
maxTokens: 3000
disabledRules:
  - bp-too-short
  - struct-missing-description
```

Then reference it:

```yaml
- uses: MrDwarf7/ai-context-linter@v1
  with:
    config: '.ai-context-linter.yml'
```

## Why This Exists

If you're using Claude Code, Cursor, Copilot, or any AI coding agent, you've probably written a CLAUDE.md or .cursorrules file. Maybe you wrote it at 2 AM. Maybe it has your OpenAI key hardcoded in an example. Maybe it says "follow best practices" and nothing else.

Your AI agent reads that file every time it starts. If the file is wrong, the agent is wrong. This action catches those problems in CI before they become problems in production.

## Need Good Templates?

This linter checks your files against best practices. If you want context files that pass every check on the first try:

**[AI Context Engineering Templates →](https://mrdwarf7.github.io/ai-context-templates/)**

Battle-tested templates for Claude Code, Cursor, multi-agent setups, and more. Written by someone who's spent 200+ hours figuring out what actually makes AI agents write better code.

## License

MIT — use it however you want.
