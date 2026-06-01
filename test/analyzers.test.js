const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ComplexityAnalyzer } = require('../src/analyzers/complexity');
const { DeadCodeDetector } = require('../src/analyzers/deadcode');
const { DependencyRisk } = require('../src/analyzers/dependencies');
const { formatNumber, formatPercent, formatDuration } = require('../src/utils/format');

function createMockRepoData() {
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  return {
    name: 'test-repo',
    url: 'https://github.com/test/test-repo',
    path: '/tmp/test-repo',
    commits: [
      {
        hash: 'a1', author: 'Alice', email: 'a@t.com',
        date: twoYearsAgo.toISOString(), subject: 'Init', parents: [],
        files: [
          { added: 100, removed: 0, path: 'src/main.js' },
          { added: 50, removed: 0, path: 'src/util.js' },
          { added: 30, removed: 0, path: 'src/old-module.js' }
        ]
      },
      {
        hash: 'a2', author: 'Bob', email: 'b@t.com',
        date: oneYearAgo.toISOString(), subject: 'Update', parents: ['a1'],
        files: [
          { added: 80, removed: 20, path: 'src/main.js' },
          { added: 40, removed: 5, path: 'src/util.js' }
        ]
      },
      {
        hash: 'a3', author: 'Alice', email: 'a@t.com',
        date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        subject: 'Recent changes', parents: ['a2'],
        files: [
          { added: 30, removed: 10, path: 'src/main.js' },
          { added: 20, removed: 0, path: 'src/new-feature.js' }
        ]
      }
    ],
    files: new Map(),
    contributors: new Map(),
    timespan: '2 years'
  };
}

describe('ComplexityAnalyzer', () => {
  it('should build a complexity timeline', () => {
    const repo = createMockRepoData();
    const analyzer = new ComplexityAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(report.timeline.length > 0, 'Should have timeline data');
    assert.ok(report.timeline[0].period, 'Should have period labels');
    assert.ok(typeof report.timeline[0].avgComplexity === 'number', 'Should have numeric complexity');
  });

  it('should calculate trend direction', () => {
    const repo = createMockRepoData();
    const analyzer = new ComplexityAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(['increasing', 'decreasing', 'stable'].includes(report.trend.direction),
      'Trend direction should be valid');
    assert.ok(typeof report.trend.percentChange === 'string',
      'Percent change should be a string');
    assert.ok(report.trend.mostComplexFile, 'Should identify most complex file');
  });

  it('should find hotspot files', () => {
    const repo = createMockRepoData();
    const analyzer = new ComplexityAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(report.hotspotFiles.length > 0, 'Should have hotspot files');
    assert.ok(report.hotspotFiles[0].file, 'Hotspots should have file paths');
    assert.ok(typeof report.hotspotFiles[0].complexityScore === 'number',
      'Hotspots should have complexity scores');
  });

  it('should calculate stats', () => {
    const repo = createMockRepoData();
    const analyzer = new ComplexityAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(typeof report.stats.totalFiles === 'number', 'Should have totalFiles');
    assert.ok(typeof report.stats.totalChurn === 'number', 'Should have totalChurn');
  });
});

describe('DeadCodeDetector', () => {
  it('should find dead code suspects', () => {
    const repo = createMockRepoData();
    const analyzer = new DeadCodeDetector(repo);
    const report = analyzer.analyze();

    assert.ok(Array.isArray(report.suspects), 'Suspects should be an array');
    // old-module.js hasn't been touched in 2 years
    const oldModule = report.suspects.find(s => s.file.includes('old-module'));
    if (oldModule) {
      assert.ok(oldModule.daysIdle > 365, 'Old module should be idle 365+ days');
      assert.ok(oldModule.confidence, 'Should have confidence level');
    }
  });

  it('should categorize suspects', () => {
    const repo = createMockRepoData();
    const analyzer = new DeadCodeDetector(repo);
    const report = analyzer.analyze();

    assert.ok(report.byCategory, 'Should have categories');
    assert.ok(Array.isArray(report.byCategory.source), 'Source category should be an array');
  });

  it('should calculate stats', () => {
    const repo = createMockRepoData();
    const analyzer = new DeadCodeDetector(repo);
    const report = analyzer.analyze();

    assert.ok(typeof report.stats.totalSuspects === 'number', 'Should have totalSuspects');
    assert.ok(typeof report.stats.highConfidence === 'number', 'Should have highConfidence');
  });
});

describe('DependencyRisk', () => {
  it('should find critical files', () => {
    const repo = createMockRepoData();
    const analyzer = new DependencyRisk(repo);
    const report = analyzer.analyze();

    assert.ok(Array.isArray(report.criticalFiles), 'Critical files should be an array');
    if (report.criticalFiles.length > 0) {
      assert.ok(report.criticalFiles[0].file, 'Should have file path');
      assert.ok(typeof report.criticalFiles[0].riskScore === 'number', 'Should have risk score');
    }
  });

  it('should find coupling clusters', () => {
    const repo = createMockRepoData();
    const analyzer = new DependencyRisk(repo);
    const report = analyzer.analyze();

    assert.ok(Array.isArray(report.couplingClusters), 'Clusters should be an array');
  });

  it('should calculate stats', () => {
    const repo = createMockRepoData();
    const analyzer = new DependencyRisk(repo);
    const report = analyzer.analyze();

    assert.ok(typeof report.stats.totalAnalyzed === 'number', 'Should have totalAnalyzed');
  });
});

describe('Format utilities', () => {
  it('should format numbers', () => {
    assert.strictEqual(formatNumber(1234), '1,234');
    assert.strictEqual(formatNumber(0), '0');
    assert.strictEqual(formatNumber(null), '0');
  });

  it('should format percentages', () => {
    assert.strictEqual(formatPercent(0.5), '50.0%');
    assert.strictEqual(formatPercent(0), '0.0%');
    assert.strictEqual(formatPercent(1), '100.0%');
  });

  it('should format durations', () => {
    assert.strictEqual(formatDuration(500), '500ms');
    assert.ok(formatDuration(1500).includes('s'));
    assert.ok(formatDuration(125000).includes('m'));
  });
});
