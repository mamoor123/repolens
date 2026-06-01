const { describe, it } = require('node:test');
const assert = require('node:assert');
const { BugArchaeology } = require('../src/analyzers/bugs');

function createMockRepoData() {
  return {
    name: 'test-repo',
    url: 'https://github.com/test/test-repo',
    path: '/tmp/test-repo',
    commits: [
      {
        hash: 'aaa111', author: 'Alice', email: 'a@t.com',
        date: '2025-01-15T10:00:00Z', subject: 'Initial commit', parents: [],
        files: [{ added: 200, removed: 0, path: 'src/app.js' }]
      },
      {
        hash: 'bbb222', author: 'Bob', email: 'b@t.com',
        date: '2025-02-10T10:00:00Z', subject: 'Fix null pointer in auth', parents: ['aaa111'],
        files: [{ added: 10, removed: 5, path: 'src/auth.js' }]
      },
      {
        hash: 'ccc333', author: 'Alice', email: 'a@t.com',
        date: '2025-03-05T10:00:00Z', subject: 'Fix crash on login page', parents: ['bbb222'],
        files: [
          { added: 5, removed: 3, path: 'src/auth.js' },
          { added: 2, removed: 0, path: 'src/app.js' }
        ]
      },
      {
        hash: 'ddd444', author: 'Charlie', email: 'c@t.com',
        date: '2025-04-01T10:00:00Z', subject: 'Add new feature', parents: ['ccc333'],
        files: [{ added: 100, removed: 0, path: 'src/feature.js' }]
      },
      {
        hash: 'eee555', author: 'Bob', email: 'b@t.com',
        date: '2025-05-01T10:00:00Z', subject: 'Fix regression in auth module', parents: ['ddd444'],
        files: [{ added: 8, removed: 12, path: 'src/auth.js' }]
      },
      {
        hash: 'fff666', author: 'Alice', email: 'a@t.com',
        date: '2025-06-01T10:00:00Z', subject: 'Security patch for CVE-2025-1234', parents: ['eee555'],
        files: [{ added: 15, removed: 3, path: 'src/auth.js' }]
      },
      {
        hash: 'ggg777', author: 'Charlie', email: 'c@t.com',
        date: '2025-07-01T10:00:00Z', subject: 'Revert broken change', parents: ['fff666'],
        files: [{ added: 0, removed: 50, path: 'src/feature.js' }]
      }
    ],
    files: new Map(),
    contributors: new Map(),
    timespan: '6 months'
  };
}

describe('BugArchaeology', () => {
  it('should identify bug-fix commits', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.totalBugFixes > 0, 'Should find bug-fix commits');
    assert.ok(report.totalBugFixes >= 4, 'Should find at least 4 bug-fix commits');
  });

  it('should calculate bug fix percentage', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.bugFixPercent > 0, 'Bug fix percent should be > 0');
    assert.ok(report.bugFixPercent < 1, 'Bug fix percent should be < 1');
  });

  it('should find bug hotspots', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.hotspots.length > 0, 'Should have hotspots');
    // auth.js appears in most bug-fix commits
    const authHotspot = report.hotspots.find(h => h.file.includes('auth'));
    assert.ok(authHotspot, 'auth.js should be a hotspot');
    assert.ok(authHotspot.bugFixCommits >= 3, 'auth.js should have 3+ bug fixes');
  });

  it('should classify security bugs', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.stats.byType.security > 0, 'Should detect security commits');
  });

  it('should classify reverts', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.stats.byType.revert > 0, 'Should detect revert commits');
  });

  it('should calculate risk levels', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    const authHotspot = report.hotspots.find(h => h.file.includes('auth'));
    assert.ok(authHotspot, 'Should have auth hotspot');
    assert.ok(['critical', 'high', 'medium', 'low'].includes(authHotspot.riskLevel),
      'Risk level should be valid');
  });

  it('should build bug timeline', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.timeline.length > 0, 'Should have timeline data');
    assert.ok(report.timeline[0].period, 'Timeline entries should have periods');
    assert.ok(report.timeline[0].count > 0, 'Timeline entries should have counts');
  });

  it('should list recent bugs', () => {
    const repo = createMockRepoData();
    const analyzer = new BugArchaeology(repo);
    const report = analyzer.analyze();

    assert.ok(report.recentBugs.length > 0, 'Should have recent bugs');
    assert.ok(report.recentBugs[0].hash, 'Recent bugs should have hashes');
    assert.ok(report.recentBugs[0].subject, 'Recent bugs should have subjects');
  });
});
