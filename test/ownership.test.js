const { describe, it } = require('node:test');
const assert = require('node:assert');
const { OwnershipAnalyzer } = require('../src/analyzers/ownership');

// Mock repo data for testing
function createMockRepoData() {
  return {
    name: 'test-repo',
    url: 'https://github.com/test/test-repo',
    path: '/tmp/test-repo',
    commits: [
      {
        hash: 'abc123',
        author: 'Alice',
        email: 'alice@test.com',
        date: '2025-01-15T10:00:00Z',
        subject: 'Initial commit',
        parents: [],
        files: [
          { added: 100, removed: 0, path: 'src/index.js' },
          { added: 50, removed: 0, path: 'src/utils.js' }
        ]
      },
      {
        hash: 'def456',
        author: 'Bob',
        email: 'bob@test.com',
        date: '2025-02-20T14:00:00Z',
        subject: 'Add feature',
        parents: ['abc123'],
        files: [
          { added: 80, removed: 10, path: 'src/index.js' },
          { added: 30, removed: 0, path: 'src/feature.js' }
        ]
      },
      {
        hash: 'ghi789',
        author: 'Alice',
        email: 'alice@test.com',
        date: '2025-03-10T09:00:00Z',
        subject: 'Fix bug in utils',
        parents: ['def456'],
        files: [
          { added: 5, removed: 15, path: 'src/utils.js' }
        ]
      },
      {
        hash: 'jkl012',
        author: 'Charlie',
        email: 'charlie@test.com',
        date: '2025-04-05T16:00:00Z',
        subject: 'Refactor',
        parents: ['ghi789'],
        files: [
          { added: 40, removed: 30, path: 'src/index.js' },
          { added: 20, removed: 5, path: 'src/utils.js' },
          { added: 10, removed: 0, path: 'src/feature.js' }
        ]
      }
    ],
    files: new Map(),
    contributors: new Map(),
    timespan: '3 months'
  };
}

describe('OwnershipAnalyzer', () => {
  it('should calculate top owners correctly', () => {
    const repo = createMockRepoData();
    const analyzer = new OwnershipAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(report.topOwners.length > 0, 'Should have owners');
    assert.strictEqual(report.topOwners[0].name, 'Alice', 'Alice should be top owner');
    assert.ok(report.topOwners[0].linesAdded > 0, 'Alice should have added lines');
    assert.ok(report.topOwners[0].ownership > 0, 'Alice should have ownership > 0');
  });

  it('should have bus factor analysis', () => {
    const repo = createMockRepoData();
    const analyzer = new OwnershipAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(Array.isArray(report.busFactor), 'busFactor should be an array');
  });

  it('should calculate file ownership', () => {
    const repo = createMockRepoData();
    const analyzer = new OwnershipAnalyzer(repo);
    const report = analyzer.analyze();

    assert.ok(report.fileOwnership.length > 0, 'Should have file ownership data');
    assert.ok(report.fileOwnership[0].primaryOwner, 'Files should have primary owners');
    assert.ok(report.fileOwnership[0].authors.length > 0, 'Files should have author lists');
  });

  it('should sort owners by lines added', () => {
    const repo = createMockRepoData();
    const analyzer = new OwnershipAnalyzer(repo);
    const report = analyzer.analyze();

    for (let i = 1; i < report.topOwners.length; i++) {
      assert.ok(
        report.topOwners[i - 1].linesAdded >= report.topOwners[i].linesAdded,
        'Owners should be sorted by lines added (descending)'
      );
    }
  });

  it('should calculate ownership percentages that sum to ~1.0', () => {
    const repo = createMockRepoData();
    const analyzer = new OwnershipAnalyzer(repo);
    const report = analyzer.analyze();

    const totalOwnership = report.topOwners.reduce((s, o) => s + o.ownership, 0);
    assert.ok(Math.abs(totalOwnership - 1.0) < 0.01, 'Ownership should sum to ~1.0');
  });
});
