/**
 * BugArchaeology — identifies bug-fix commits by analyzing commit messages,
 * then maps bugs back to the files they were in.
 *
 * Bug-fix detection patterns:
 * - Messages containing: fix, bug, patch, hotfix, regression, issue, crash,
 *   error, broken, resolve, revert, workaround
 * - Revert commits (always indicate something broke)
 * - Messages referencing issue numbers (#123)
 */
class BugArchaeology {
  constructor(repoData) {
    this.repoData = repoData;
    this.commits = repoData.commits;
    if (repoData.files.size === 0) {
      const { GitParser } = require('../parser');
      const parser = new GitParser('/tmp');
      repoData.files = parser.buildFileIndex(repoData.commits);
    }
    this.files = repoData.files;

    // Patterns that indicate a bug-fix commit
    this.bugPatterns = [
      /\bfix(ed|es|ing)?\b/i,
      /\bbug\b/i,
      /\bpatch\b/i,
      /\bhotfix\b/i,
      /\bregression\b/i,
      /\bissue\b/i,
      /\bcrash\b/i,
      /\berror\b/i,
      /\bbroken\b/i,
      /\bresolve[ds]?\b/i,
      /\brevert\b/i,
      /\bworkaround\b/i,
      /\bdebug\b/i,
      /\bnull\s*pointer\b/i,
      /\bsegfault\b/i,
      /\bmemory\s*leak\b/i,
      /\btype\s*error\b/i,
      /\bnullref\b/i,
      /\boff[\s-]?by[\s-]?one\b/i,
      /\bundo\b/i,
      /\brollback\b/i,
      /\bsecurity\b/i,
      /\bvulnerability\b/i,
      /\bcve-\d+/i,
      /\b#(\d+)\b/  // References to issue numbers
    ];
  }

  analyze() {
    const bugFixes = this.identifyBugFixes();
    const hotspots = this.calculateHotspots(bugFixes);
    const fileRisk = this.calculateFileRisk(hotspots);
    const timeline = this.buildBugTimeline(bugFixes);
    const stats = this.calculateStats(bugFixes);

    return {
      totalBugFixes: bugFixes.length,
      bugFixPercent: this.commits.length > 0 ? bugFixes.length / this.commits.length : 0,
      hotspots,
      fileRisk,
      timeline,
      stats,
      recentBugs: bugFixes.slice(0, 10).map(b => ({
        hash: b.hash.slice(0, 8),
        subject: b.subject,
        date: b.date,
        files: b.files.map(f => f.path)
      }))
    };
  }

  /**
   * Identify which commits are bug fixes
   */
  identifyBugFixes() {
    const bugFixes = [];

    for (const commit of this.commits) {
      const isBugFix = this.isBugFixCommit(commit);
      if (isBugFix) {
        bugFixes.push({
          ...commit,
          bugType: this.classifyBugType(commit.subject),
          matchedPatterns: this.getMatchedPatterns(commit.subject)
        });
      }
    }

    // Sort by date (most recent first)
    bugFixes.sort((a, b) => new Date(b.date) - new Date(a.date));
    return bugFixes;
  }

  isBugFixCommit(commit) {
    const msg = commit.subject.toLowerCase();
    return this.bugPatterns.some(p => p.test(msg));
  }

  classifyBugType(subject) {
    const s = subject.toLowerCase();
    if (/\brevert\b/.test(s)) return 'revert';
    if (/\bsecurity\b|\bvulnerability\b|\bcve\b/.test(s)) return 'security';
    if (/\bcrash\b|\bnull\s*pointer\b|\bsegfault\b/.test(s)) return 'crash';
    if (/\bregression\b/.test(s)) return 'regression';
    if (/\bhotfix\b/.test(s)) return 'hotfix';
    if (/\bmemory\s*leak\b/.test(s)) return 'memory';
    if (/\btype\s*error\b|\bnullref\b/.test(s)) return 'type-error';
    return 'bug-fix';
  }

  getMatchedPatterns(subject) {
    return this.bugPatterns
      .filter(p => p.test(subject))
      .map(p => p.source)
      .slice(0, 3);
  }

  /**
   * Calculate which files appear most often in bug-fix commits
   */
  calculateHotspots(bugFixes) {
    const fileBugCount = new Map();

    for (const bug of bugFixes) {
      for (const file of bug.files) {
        if (!fileBugCount.has(file.path)) {
          fileBugCount.set(file.path, {
            file: file.path,
            bugFixCommits: 0,
            bugTypes: new Map(),
            firstBug: bug.date,
            lastBug: bug.date,
            totalLinesChanged: 0
          });
        }

        const stats = fileBugCount.get(file.path);
        stats.bugFixCommits++;
        stats.lastBug = bug.date;
        stats.totalLinesChanged += file.added + file.removed;

        const bugType = bug.bugType;
        stats.bugTypes.set(bugType, (stats.bugTypes.get(bugType) || 0) + 1);
      }
    }

    const totalBugs = bugFixes.length;

    const hotspots = Array.from(fileBugCount.values()).map(f => ({
      file: f.file,
      bugFixCommits: f.bugFixCommits,
      percentOfFixes: totalBugs > 0 ? f.bugFixCommits / totalBugs : 0,
      avgLinesChanged: f.bugFixCommits > 0 ? f.totalLinesChanged / f.bugFixCommits : 0,
      dominantBugType: this.getDominantType(f.bugTypes),
      riskLevel: this.calculateRiskLevel(f.bugFixCommits, totalBugs)
    }));

    hotspots.sort((a, b) => b.bugFixCommits - a.bugFixCommits);
    return hotspots;
  }

  getDominantType(bugTypes) {
    let max = 0;
    let dominant = 'unknown';
    for (const [type, count] of bugTypes) {
      if (count > max) {
        max = count;
        dominant = type;
      }
    }
    return dominant;
  }

  calculateRiskLevel(bugFixes, totalBugs) {
    const percent = totalBugs > 0 ? bugFixes / totalBugs : 0;
    if (percent > 0.15) return 'critical';
    if (percent > 0.08) return 'high';
    if (percent > 0.03) return 'medium';
    return 'low';
  }

  /**
   * Calculate risk scores for files based on bug density
   */
  calculateFileRisk(hotspots) {
    return hotspots.map(h => ({
      file: h.file,
      riskScore: h.bugFixCommits * (1 + h.percentOfFixes) * 10,
      recommendation: h.riskLevel === 'critical'
        ? '⚠️  High bug density — consider refactoring or adding tests'
        : h.riskLevel === 'high'
        ? 'Watch this file closely — frequent bug target'
        : 'Normal risk level'
    }));
  }

  /**
   * Show bug fixes over time
   */
  buildBugTimeline(bugFixes) {
    const periods = new Map();

    for (const bug of bugFixes) {
      const date = new Date(bug.date);
      if (isNaN(date.getTime())) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!periods.has(key)) {
        periods.set(key, { period: key, count: 0, types: new Map() });
      }
      const p = periods.get(key);
      p.count++;
      p.types.set(bug.bugType, (p.types.get(bug.bugType) || 0) + 1);
    }

    return Array.from(periods.values()).sort((a, b) => a.period.localeCompare(b.period));
  }

  calculateStats(bugFixes) {
    const typeCount = new Map();
    for (const bug of bugFixes) {
      typeCount.set(bug.bugType, (typeCount.get(bug.bugType) || 0) + 1);
    }

    return {
      byType: Object.fromEntries(typeCount),
      avgFilesPerBug: bugFixes.length > 0
        ? (bugFixes.reduce((s, b) => s + b.files.length, 0) / bugFixes.length).toFixed(1)
        : 0
    };
  }
}

module.exports = { BugArchaeology };
