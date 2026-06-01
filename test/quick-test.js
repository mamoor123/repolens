const { GitParser } = require('../src/parser');
const { OwnershipAnalyzer } = require('../src/analyzers/ownership');
const { ComplexityAnalyzer } = require('../src/analyzers/complexity');
const { BugArchaeology } = require('../src/analyzers/bugs');
const { DeadCodeDetector } = require('../src/analyzers/deadcode');
const { DependencyRisk } = require('../src/analyzers/dependencies');
const { AIBriefing } = require('../src/ai/briefing');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => { console.log(`  ✅ ${name}`); passed++; })
        .catch(e => { console.log(`  ❌ ${name}: ${e.message}`); failed++; });
    }
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function runAll() {
  // ─── Parser Tests ─────────────────────────────────────────────
  console.log('\n🧪 GitParser');
  const parser = new GitParser('/tmp');
  const marker = parser.COMMIT_MARKER;

  await test('parseLogOutput - single commit', () => {
    const output = `${marker}\nabc123\x00Alice\x00alice@test.com\x002025-01-15T10:00:00Z\x00Initial commit\x00\n100\t0\tsrc/index.js\n50\t0\tsrc/utils.js\n`;
    const commits = parser.parseLogOutput(output);
    assert(commits.length === 1, `Expected 1 commit, got ${commits.length}`);
    assert(commits[0].hash === 'abc123', `Hash: ${commits[0].hash}`);
    assert(commits[0].author === 'Alice', `Author: ${commits[0].author}`);
    assert(commits[0].files.length === 2, `Files: ${commits[0].files.length}, expected 2`);
    assert(commits[0].files[0].added === 100, `Added: ${commits[0].files[0].added}`);
    assert(commits[0].files[0].path === 'src/index.js', `Path: ${commits[0].files[0].path}`);
  });

  await test('parseLogOutput - multiple commits', () => {
    const output = `${marker}\naaa\x00Alice\x00a@t.com\x002025-01-01T00:00:00Z\x00First\x00\n10\t0\tfile.js\n${marker}\nbbb\x00Bob\x00b@t.com\x002025-02-01T00:00:00Z\x00Second\x00aaa\n5\t3\tfile.js\n`;
    const commits = parser.parseLogOutput(output);
    assert(commits.length === 2, `Expected 2 commits, got ${commits.length}`);
    assert(commits[0].author === 'Alice');
    assert(commits[1].author === 'Bob');
    assert(commits[1].parents[0] === 'aaa', `Parents: ${JSON.stringify(commits[1].parents)}`);
  });

  await test('parseLogOutput - binary files', () => {
    const output = `${marker}\nabc\x00Alice\x00a@t.com\x002025-01-01T00:00:00Z\x00Add image\x00\n-\t-\timage.png\n`;
    const commits = parser.parseLogOutput(output);
    assert(commits.length === 1);
    assert(commits[0].files[0].added === 0, `Added: ${commits[0].files[0].added}`);
    assert(commits[0].files[0].removed === 0);
    assert(commits[0].files[0].path === 'image.png');
  });

  await test('parseLogOutput - empty output', () => {
    const commits = parser.parseLogOutput('');
    assert(commits.length === 0);
  });

  await test('buildFileIndex', () => {
    const commits = [
      { hash: 'a', author: 'A', email: '', date: '2025-01-01', subject: '', parents: [], files: [{ added: 100, removed: 0, path: 'x.js' }] },
      { hash: 'b', author: 'B', email: '', date: '2025-02-01', subject: '', parents: ['a'], files: [{ added: 50, removed: 10, path: 'x.js' }] }
    ];
    const files = parser.buildFileIndex(commits);
    assert(files.has('x.js'));
    assert(files.get('x.js').commitCount === 2);
    assert(files.get('x.js').totalAdded === 150);
  });

  await test('buildContributorIndex', () => {
    const commits = [
      { hash: 'a', author: 'A', email: 'a@t', date: '2025-01-01', subject: '', parents: [], files: [{ added: 100, removed: 0, path: 'x.js' }] },
      { hash: 'b', author: 'A', email: 'a@t', date: '2025-02-01', subject: '', parents: ['a'], files: [{ added: 30, removed: 10, path: 'x.js' }] }
    ];
    const c = parser.buildContributorIndex(commits);
    assert(c.has('A'));
    assert(c.get('A').commits === 2);
    assert(c.get('A').linesAdded === 130);
  });

  await test('calculateTimespan', () => {
    const t = parser.calculateTimespan([{ date: '2024-01-01T00:00:00Z' }, { date: '2025-06-01T00:00:00Z' }]);
    assert(t.includes('year'), `Timespan: ${t}`);
  });

  // ─── Shared mock repo ─────────────────────────────────────────
  const mockRepo = () => {
    const commits = [
      { hash: 'a', author: 'Alice', email: '', date: '2025-01-01', subject: '', parents: [], files: [{ added: 100, removed: 0, path: 'index.js' }, { added: 50, removed: 0, path: 'utils.js' }] },
      { hash: 'b', author: 'Bob', email: '', date: '2025-02-01', subject: '', parents: ['a'], files: [{ added: 80, removed: 10, path: 'index.js' }, { added: 30, removed: 0, path: 'feature.js' }] },
      { hash: 'c', author: 'Alice', email: '', date: '2025-03-01', subject: '', parents: ['b'], files: [{ added: 5, removed: 15, path: 'utils.js' }] },
    ];
    return { name: 'test', url: '', path: '/tmp', commits, files: new Map(), contributors: new Map(), timespan: '3 months' };
  };

  const bugRepo = () => {
    const commits = [
      { hash: 'a', author: 'A', email: '', date: '2025-01-01', subject: 'Init', parents: [], files: [{ added: 200, removed: 0, path: 'app.js' }] },
      { hash: 'b', author: 'B', email: '', date: '2025-02-01', subject: 'Fix null pointer in auth', parents: ['a'], files: [{ added: 10, removed: 5, path: 'auth.js' }] },
      { hash: 'c', author: 'A', email: '', date: '2025-03-01', subject: 'Fix crash on login', parents: ['b'], files: [{ added: 5, removed: 3, path: 'auth.js' }] },
      { hash: 'd', author: 'C', email: '', date: '2025-04-01', subject: 'Add feature', parents: ['c'], files: [{ added: 100, removed: 0, path: 'feature.js' }] },
      { hash: 'e', author: 'B', email: '', date: '2025-05-01', subject: 'Fix regression in auth', parents: ['d'], files: [{ added: 8, removed: 12, path: 'auth.js' }] },
      { hash: 'f', author: 'A', email: '', date: '2025-06-01', subject: 'Security patch CVE-2025-1234', parents: ['e'], files: [{ added: 15, removed: 3, path: 'auth.js' }] },
      { hash: 'g', author: 'C', email: '', date: '2025-07-01', subject: 'Revert broken change', parents: ['f'], files: [{ added: 0, removed: 50, path: 'feature.js' }] },
    ];
    return { name: 'test', url: '', path: '/tmp', commits, files: new Map(), contributors: new Map(), timespan: '6 months' };
  };

  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const deadRepo = () => ({
    name: 'test', url: '', path: '/tmp',
    commits: [
      { hash: 'a', author: 'A', email: '', date: twoYearsAgo, subject: '', parents: [], files: [{ added: 100, removed: 0, path: 'src/old.js' }, { added: 200, removed: 0, path: 'src/new.js' }] },
      { hash: 'b', author: 'A', email: '', date: recentDate, subject: '', parents: ['a'], files: [{ added: 50, removed: 10, path: 'src/new.js' }] },
    ],
    files: new Map(), contributors: new Map(), timespan: '2 years'
  });

  // ─── Ownership ────────────────────────────────────────────────
  console.log('\n🧪 OwnershipAnalyzer');
  await test('top owners calculated', () => {
    const report = new OwnershipAnalyzer(mockRepo()).analyze();
    assert(report.topOwners.length > 0);
    assert(report.topOwners[0].name === 'Alice');
  });
  await test('ownership percentages sum to ~1.0', () => {
    const report = new OwnershipAnalyzer(mockRepo()).analyze();
    const total = report.topOwners.reduce((s, o) => s + o.ownership, 0);
    assert(Math.abs(total - 1.0) < 0.01, `Sum: ${total}`);
  });
  await test('file ownership has primary owners', () => {
    const report = new OwnershipAnalyzer(mockRepo()).analyze();
    assert(report.fileOwnership.length > 0);
    assert(report.fileOwnership[0].primaryOwner);
  });

  // ─── Complexity ───────────────────────────────────────────────
  console.log('\n🧪 ComplexityAnalyzer');
  await test('timeline built', () => {
    const report = new ComplexityAnalyzer(mockRepo()).analyze();
    assert(report.timeline.length > 0);
    assert(typeof report.timeline[0].avgComplexity === 'number');
  });
  await test('trend direction valid', () => {
    const report = new ComplexityAnalyzer(mockRepo()).analyze();
    assert(['increasing', 'decreasing', 'stable'].includes(report.trend.direction));
  });

  // ─── Bugs ─────────────────────────────────────────────────────
  console.log('\n🧪 BugArchaeology');
  await test('identifies bug fixes', () => {
    const report = new BugArchaeology(bugRepo()).analyze();
    assert(report.totalBugFixes >= 4, `Found ${report.totalBugFixes}`);
  });
  await test('finds auth.js hotspot', () => {
    const report = new BugArchaeology(bugRepo()).analyze();
    const auth = report.hotspots.find(h => h.file.includes('auth'));
    assert(auth, 'No auth hotspot');
    assert(auth.bugFixCommits >= 3, `Auth fixes: ${auth.bugFixCommits}`);
  });
  await test('classifies security bugs', () => {
    const report = new BugArchaeology(bugRepo()).analyze();
    assert(report.stats.byType.security > 0);
  });
  await test('classifies reverts', () => {
    const report = new BugArchaeology(bugRepo()).analyze();
    assert(report.stats.byType.revert > 0);
  });

  // ─── Dead Code ────────────────────────────────────────────────
  console.log('\n🧪 DeadCodeDetector');
  await test('finds dead code suspects', () => {
    const report = new DeadCodeDetector(deadRepo()).analyze();
    assert(Array.isArray(report.suspects));
  });
  await test('has stats', () => {
    const report = new DeadCodeDetector(deadRepo()).analyze();
    assert(typeof report.stats.totalSuspects === 'number');
  });

  // ─── Dependencies ─────────────────────────────────────────────
  console.log('\n🧪 DependencyRisk');
  await test('finds critical files', () => {
    const report = new DependencyRisk(mockRepo()).analyze();
    assert(Array.isArray(report.criticalFiles));
  });

  // ─── AI Briefing ──────────────────────────────────────────────
  console.log('\n🧪 AIBriefing');
  await test('generates template briefing', async () => {
    const repo = mockRepo();
    const ownership = new OwnershipAnalyzer(repo).analyze();
    const complexity = new ComplexityAnalyzer(repo).analyze();
    const bugs = new BugArchaeology(repo).analyze();
    const deadCode = new DeadCodeDetector(repo).analyze();
    const deps = new DependencyRisk(repo).analyze();
    const ai = new AIBriefing();
    const result = await ai.generate({ repo, ownership, complexity, bugs, deadCode, dependencies: deps });
    assert(result.summary.length > 0, 'Empty summary');
    assert(result.method === 'template');
  });

  // ─── Format ───────────────────────────────────────────────────
  console.log('\n🧪 Format utilities');
  const { formatNumber, formatPercent, formatDuration } = require('../src/utils/format');
  await test('formatNumber', () => { assert(formatNumber(1234) === '1,234'); assert(formatNumber(0) === '0'); });
  await test('formatPercent', () => { assert(formatPercent(0.5) === '50.0%'); assert(formatPercent(0) === '0.0%'); });
  await test('formatDuration', () => { assert(formatDuration(500) === '500ms'); assert(formatDuration(1500).includes('s')); });

  // ─── Summary ──────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(e => { console.error(e); process.exit(1); });
