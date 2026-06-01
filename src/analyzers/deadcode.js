/**
 * DeadCodeDetector — identifies files that are potentially dead code
 * by analyzing when they were last modified, how often they change,
 * and whether they're referenced by other files.
 *
 * A file is "potentially dead" if:
 * 1. It hasn't been modified in 12+ months
 * 2. It had very few commits overall
 * 3. No other files reference it (basic text-based reference check)
 */
class DeadCodeDetector {
  constructor(repoData) {
    this.repoData = repoData;
    this.commits = repoData.commits;
    if (repoData.files.size === 0) {
      const { GitParser } = require('../parser');
      const parser = new GitParser('/tmp');
      repoData.files = parser.buildFileIndex(repoData.commits);
    }
    this.files = repoData.files;
  }

  analyze() {
    const suspects = this.findSuspects();
    const stats = this.calculateStats(suspects);
    const byCategory = this.categorize(suspects);

    return {
      suspects,
      stats,
      byCategory
    };
  }

  /**
   * Find files that are potentially dead code
   */
  findSuspects() {
    const now = new Date();
    const suspects = [];

    for (const [filePath, fileData] of this.files) {
      const lastModified = new Date(fileData.lastSeen);
      if (isNaN(lastModified.getTime())) continue;

      const daysIdle = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));

      // File is suspicious if idle for 12+ months (365 days)
      if (daysIdle < 365) continue;

      const totalLines = fileData.totalAdded - fileData.totalRemoved;
      const isSmallFile = totalLines < 500;
      const hasFewCommits = fileData.commitCount <= 3;
      const isUnreferenced = this.checkUnreferenced(filePath);

      // Calculate dead score
      let deadScore = 0;
      deadScore += Math.min(daysIdle / 365, 5) * 20; // Up to 100 points for age
      deadScore += hasFewCommits ? 30 : 0;  // Few commits = likely abandoned
      deadScore += isSmallFile ? 20 : 0;    // Small files are more likely dead
      deadScore += isUnreferenced ? 40 : 0; // No references = probably dead

      if (deadScore >= 50) {
        suspects.push({
          file: filePath,
          lastModified: fileData.lastSeen,
          daysIdle,
          lines: Math.max(0, totalLines),
          commits: fileData.commitCount,
          deadScore: Math.min(deadScore, 150),
          reasons: {
            idle: daysIdle >= 365,
            fewCommits: hasFewCommits,
            smallFile: isSmallFile,
            unreferenced: isUnreferenced
          },
          confidence: deadScore >= 100 ? 'high' : deadScore >= 70 ? 'medium' : 'low'
        });
      }
    }

    suspects.sort((a, b) => b.deadScore - a.deadScore);
    return suspects;
  }

  /**
   * Check if a file is referenced by other files.
   * Uses basic text matching on the filename (without extension).
   */
  checkUnreferenced(filePath) {
    const basename = filePath.split('/').pop().replace(/\.[^.]+$/, '');
    if (basename.length < 3) return false; // Too short to match meaningfully

    // Check if any other file in the repo mentions this filename
    for (const [otherPath] of this.files) {
      if (otherPath === filePath) continue;
      const otherName = otherPath.split('/').pop();
      if (otherName.includes(basename)) return false;
    }

    return true;
  }

  calculateStats(suspects) {
    const totalSuspects = suspects.length;
    const highConfidence = suspects.filter(s => s.confidence === 'high').length;
    const mediumConfidence = suspects.filter(s => s.confidence === 'medium').length;
    const totalLines = suspects.reduce((s, d) => s + d.lines, 0);

    return {
      totalSuspects,
      highConfidence,
      mediumConfidence,
      lowConfidence: totalSuspects - highConfidence - mediumConfidence,
      totalDeadLines: totalLines
    };
  }

  categorize(suspects) {
    const categories = {
      'config': [],
      'test': [],
      'documentation': [],
      'source': [],
      'other': []
    };

    for (const suspect of suspects) {
      const path = suspect.file.toLowerCase();
      if (path.includes('test') || path.includes('spec')) {
        categories.test.push(suspect);
      } else if (path.includes('config') || path.includes('.rc') || path.includes('rc.')) {
        categories.config.push(suspect);
      } else if (path.includes('doc') || path.includes('readme') || path.endsWith('.md')) {
        categories.documentation.push(suspect);
      } else if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.py') || path.endsWith('.go') || path.endsWith('.rs')) {
        categories.source.push(suspect);
      } else {
        categories.other.push(suspect);
      }
    }

    return categories;
  }
}

module.exports = { DeadCodeDetector };
// Bug fix for dead code detection
