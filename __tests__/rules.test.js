const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RULES } = require('../src/rules');

describe('Security Rules', () => {
  it('detects hardcoded API keys', () => {
    const content = 'API_KEY=sk-abc123def456ghi789jkl012mno345pqr678';
    const issues = RULES['sec-api-key'].check(content);
    assert.ok(issues.length > 0, 'Should detect API key');
    assert.equal(issues[0].severity, 'error');
  });

  it('detects GitHub PAT', () => {
    const content = 'token: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const issues = RULES['sec-api-key'].check(content);
    assert.ok(issues.length > 0, 'Should detect GitHub PAT');
  });

  it('detects private paths', () => {
    const content = 'config is at /home/user/.ssh/id_rsa';
    const issues = RULES['sec-private-path'].check(content);
    assert.ok(issues.length > 0, 'Should detect private path');
  });

  it('does not flag clean content', () => {
    const content = 'Use environment variables for API keys. Never hardcode them.';
    const issues = RULES['sec-api-key'].check(content);
    assert.equal(issues.length, 0, 'Should not flag clean content');
  });
});

describe('Structural Rules', () => {
  it('detects files with no sections', () => {
    const content = 'word '.repeat(200);
    const issues = RULES['struct-no-sections'].check(content);
    assert.ok(issues.length > 0, 'Should flag missing sections');
  });

  it('passes files with proper headers', () => {
    const content = '## Overview\nSome content here.\n## Details\nMore content.';
    const issues = RULES['struct-no-sections'].check(content);
    assert.equal(issues.length, 0, 'Should pass files with headers');
  });

  it('detects empty sections', () => {
    const content = '## Section A\n## Section B\nContent here.';
    const issues = RULES['struct-empty-sections'].check(content);
    assert.ok(issues.length > 0, 'Should flag empty section');
  });

  it('detects too-long files', () => {
    const content = 'word '.repeat(5000);
    const issues = RULES['struct-too-long'].check(content, { maxTokens: 4000 });
    assert.ok(issues.length > 0, 'Should flag too-long file');
  });
});

describe('AI Anti-Pattern Rules', () => {
  it('detects vague instructions', () => {
    const content = 'Be good and follow best practices always.';
    const issues = RULES['ai-vague-instructions'].check(content);
    assert.ok(issues.length > 0, 'Should flag vague instructions');
  });

  it('detects conflicting rules', () => {
    const content = 'Always use tabs. Never use tabs.';
    const issues = RULES['ai-conflicting-rules'].check(content);
    assert.ok(issues.length > 0, 'Should flag conflicting rules');
  });

  it('detects redundant instructions', () => {
    const content = 'Write code that works. Always write good code.';
    const issues = RULES['bp-redundant-instructions'].check(content);
    assert.ok(issues.length > 0, 'Should flag redundant instructions');
  });
});
