const { describe, it } = require('node:test');
const assert = require('node:assert');
const { GitParser } = require('../src/parser');

describe('GitParser', () => {
  it('should throw for non-existent path', async () => {
    const parser = new GitParser('/nonexistent/path');
    await assert.rejects(() => parser.parse(), /not found/i);
  });

  it('should throw for non-git directory', async () => {
    const parser = new GitParser('/tmp');
    await assert.rejects(() => parser.parse(), /not a git/i);
  });

  it('should parse log output correctly', () => {
    const parser = new GitParser('/tmp');
    const marker = parser.COMMIT_MARKER;
    // Format: COMMIT_MARKER\nHASH\x00AUTHOR\x00EMAIL\x00DATE\x00SUBJECT\x00PARENTS\n<numstat lines>
    const output = `${marker}\nabc123\x00Alice\x00alice@test.com\x002025-01-15T10:00:00Z\x00Initial commit\x00\n100\t0\tsrc/index.js\n50\t0\tsrc/utils.js\n`;

    const commits = parser.parseLogOutput(output);

    assert.strictEqual(commits.length, 1);
    assert.strictEqual(commits[0].hash, 'abc123');
    assert.strictEqual(commits[0].author, 'Alice');
    assert.strictEqual(commits[0].email, 'alice@test.com');
    assert.strictEqual(commits[0].subject, 'Initial commit');
    assert.strictEqual(commits[0].files.length, 2);
    assert.strictEqual(commits[0].files[0].added, 100);
    assert.strictEqual(commits[0].files[0].removed, 0);
    assert.strictEqual(commits[0].files[0].path, 'src/index.js');
    assert.strictEqual(commits[0].files[1].added, 50);
    assert.strictEqual(commits[0].files[1].path, 'src/utils.js');
  });

  it('should handle multiple commits in log output', () => {
    const parser = new GitParser('/tmp');
    const marker = parser.COMMIT_MARKER;
    const output = [
      `${marker}\naaa\x00Alice\x00a@t.com\x002025-01-01T00:00:00Z\x00First\x00`,
      `10\t0\tfile.js`,
      `${marker}\nbbb\x00Bob\x00b@t.com\x002025-02-01T00:00:00Z\x00Second\x00aaa`,
      `5\t3\tfile.js`,
      ''
    ].join('\n');

    const commits = parser.parseLogOutput(output);

    assert.strictEqual(commits.length, 2);
    assert.strictEqual(commits[0].author, 'Alice');
    assert.strictEqual(commits[0].parents.length, 0, 'Root commit has no parents');
    assert.strictEqual(commits[1].author, 'Bob');
    assert.strictEqual(commits[1].parents[0], 'aaa');
    assert.strictEqual(commits[1].files.length, 1);
    assert.strictEqual(commits[1].files[0].added, 5);
    assert.strictEqual(commits[1].files[0].removed, 3);
  });

  it('should handle binary files (dash stats)', () => {
    const parser = new GitParser('/tmp');
    const marker = parser.COMMIT_MARKER;
    const output = `${marker}\nabc\x00Alice\x00a@t.com\x002025-01-01T00:00:00Z\x00Add image\x00\n-\t-\timage.png\n`;

    const commits = parser.parseLogOutput(output);

    assert.strictEqual(commits.length, 1);
    assert.strictEqual(commits[0].files[0].added, 0);
    assert.strictEqual(commits[0].files[0].removed, 0);
    assert.strictEqual(commits[0].files[0].path, 'image.png');
  });

  it('should build file index', () => {
    const parser = new GitParser('/tmp');
    const commits = [
      {
        hash: 'a', author: 'Alice', email: 'a@t.com', date: '2025-01-01',
        subject: 'First', parents: [],
        files: [{ added: 100, removed: 0, path: 'src/main.js' }]
      },
      {
        hash: 'b', author: 'Bob', email: 'b@t.com', date: '2025-02-01',
        subject: 'Second', parents: ['a'],
        files: [{ added: 50, removed: 10, path: 'src/main.js' }]
      }
    ];

    const files = parser.buildFileIndex(commits);

    assert.ok(files.has('src/main.js'), 'Should index the file');
    const main = files.get('src/main.js');
    assert.strictEqual(main.commitCount, 2);
    assert.strictEqual(main.totalAdded, 150);
    assert.strictEqual(main.totalRemoved, 10);
    assert.strictEqual(main.authors.size, 2);
  });

  it('should build contributor index', () => {
    const parser = new GitParser('/tmp');
    const commits = [
      {
        hash: 'a', author: 'Alice', email: 'a@t.com', date: '2025-01-01',
        subject: 'First', parents: [],
        files: [{ added: 100, removed: 0, path: 'a.js' }, { added: 50, removed: 0, path: 'b.js' }]
      },
      {
        hash: 'b', author: 'Alice', email: 'a@t.com', date: '2025-02-01',
        subject: 'Second', parents: ['a'],
        files: [{ added: 30, removed: 10, path: 'a.js' }]
      }
    ];

    const contributors = parser.buildContributorIndex(commits);

    assert.ok(contributors.has('Alice'));
    const alice = contributors.get('Alice');
    assert.strictEqual(alice.commits, 2);
    assert.strictEqual(alice.linesAdded, 180);
    assert.strictEqual(alice.linesRemoved, 10);
    assert.strictEqual(alice.files.size, 2);
  });

  it('should calculate timespan', () => {
    const parser = new GitParser('/tmp');
    const commits = [
      { date: '2024-01-01T00:00:00Z' },
      { date: '2025-06-01T00:00:00Z' }
    ];

    const timespan = parser.calculateTimespan(commits);
    assert.ok(timespan.includes('year'), 'Should mention years');
  });

  it('should handle empty log output', () => {
    const parser = new GitParser('/tmp');
    const commits = parser.parseLogOutput('');
    assert.strictEqual(commits.length, 0);
  });

  it('should handle commit with no files', () => {
    const parser = new GitParser('/tmp');
    const marker = parser.COMMIT_MARKER;
    const output = `${marker}\nabc\x00Alice\x00a@t.com\x002025-01-01T00:00:00Z\x00Empty commit\x00\n`;

    const commits = parser.parseLogOutput(output);
    assert.strictEqual(commits.length, 1);
    assert.strictEqual(commits[0].files.length, 0);
  });
});
