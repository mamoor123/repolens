/**
 * ComplexityAnalyzer — tracks codebase complexity over time using
 * commit frequency, file churn, and size metrics.
 *
 * Complexity here is measured as a composite of:
 * 1. File churn rate (how often a file changes)
 * 2. Lines changed per commit (big changes = complex)
 * 3. Number of authors per file (many authors = complex handoffs)
 * 4. File growth rate
 */
class ComplexityAnalyzer {
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
    const timeline = this.buildTimeline();
    const trend = this.calculateTrend(timeline);
    const hotspotFiles = this.findHotspots();
    const stats = this.calculateStats();

    return {
      timeline,
      trend,
      hotspotFiles,
      stats
    };
  }

  /**
   * Build a period-by-period complexity timeline.
   * Groups commits by month and calculates complexity metrics per period.
   */
  buildTimeline() {
    const periods = new Map();

    for (const commit of this.commits) {
      const date = new Date(commit.date);
      if (isNaN(date.getTime())) continue;

      const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!periods.has(periodKey)) {
        periods.set(periodKey, {
          period: periodKey,
          commits: 0,
          filesChanged: 0,
          totalLinesChanged: 0,
          authors: new Set(),
          fileChurn: new Map()
        });
      }

      const p = periods.get(periodKey);
      p.commits++;
      p.authors.add(commit.author);

      for (const file of commit.files) {
        p.filesChanged++;
        p.totalLinesChanged += file.added + file.removed;

        if (!p.fileChurn.has(file.path)) {
          p.fileChurn.set(file.path, 0);
        }
        p.fileChurn.set(file.path, p.fileChurn.get(file.path) + 1);
      }
    }

    // Convert to array with complexity scores
    const timeline = [];
    for (const [key, data] of periods) {
      // Complexity formula: weighted combination of metrics
      const churnScore = this.calculateChurnScore(data.fileChurn);
      const avgLinesPerCommit = data.commits > 0 ? data.totalLinesChanged / data.commits : 0;
      const authorDiversity = data.authors.size;

      const complexity = (
        churnScore * 0.4 +
        (avgLinesPerCommit / 100) * 0.3 + // Normalize to ~1.0
        Math.log2(authorDiversity + 1) * 0.3
      );

      timeline.push({
        period: key,
        commits: data.commits,
        filesChanged: data.filesChanged,
        totalLinesChanged: data.totalLinesChanged,
        uniqueAuthors: data.authors.size,
        avgComplexity: complexity,
        maxComplexity: churnScore,
        filesAnalyzed: data.fileChurn.size
      });
    }

    timeline.sort((a, b) => a.period.localeCompare(b.period));
    return timeline;
  }

  /**
   * Calculate churn score: how much files are being modified repeatedly.
   * High churn = high complexity.
   */
  calculateChurnScore(fileChurn) {
    if (fileChurn.size === 0) return 0;

    const churnValues = Array.from(fileChurn.values());
    const avgChurn = churnValues.reduce((a, b) => a + b, 0) / churnValues.length;
    const maxChurn = Math.max(...churnValues);

    // Score is driven by average churn with a penalty for extreme churn
    return avgChurn * (1 + Math.log2(maxChurn + 1) * 0.2);
  }

  /**
   * Calculate the overall trend direction
   */
  calculateTrend(timeline) {
    if (timeline.length < 2) {
      return {
        direction: 'stable',
        percentChange: 0,
        periods: timeline.length,
        currentAvg: timeline[0]?.avgComplexity || 0,
        mostComplexFile: this.getMostComplexFile()
      };
    }

    // Compare first third to last third
    const third = Math.max(1, Math.floor(timeline.length / 3));
    const earlyPeriods = timeline.slice(0, third);
    const latePeriods = timeline.slice(-third);

    const earlyAvg = earlyPeriods.reduce((s, p) => s + p.avgComplexity, 0) / earlyPeriods.length;
    const lateAvg = latePeriods.reduce((s, p) => s + p.avgComplexity, 0) / latePeriods.length;

    const percentChange = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : 0;

    let direction;
    if (percentChange > 10) direction = 'increasing';
    else if (percentChange < -10) direction = 'decreasing';
    else direction = 'stable';

    return {
      direction,
      percentChange: Math.abs(percentChange).toFixed(1),
      periods: timeline.length,
      currentAvg: lateAvg,
      mostComplexFile: this.getMostComplexFile()
    };
  }

  /**
   * Find files with highest churn (most frequently changed)
   */
  findHotspots() {
    const fileStats = [];

    for (const [filePath, fileData] of this.files) {
      const churn = fileData.commitCount;
      const totalChanges = fileData.totalAdded + fileData.totalRemoved;
      const authorCount = fileData.authors.size;

      // Complexity per file
      const complexity = churn * 0.5 + (totalChanges / 100) * 0.3 + authorCount * 0.2;

      fileStats.push({
        file: filePath,
        commits: churn,
        totalChanges,
        authors: authorCount,
        complexityScore: complexity,
        avgChangesPerCommit: churn > 0 ? totalChanges / churn : 0
      });
    }

    fileStats.sort((a, b) => b.complexityScore - a.complexityScore);
    return fileStats;
  }

  getMostComplexFile() {
    const hotspots = this.findHotspots();
    return hotspots.length > 0 ? hotspots[0].file : 'N/A';
  }

  calculateStats() {
    let totalFiles = this.files.size;
    let totalChurn = 0;
    let maxChurn = 0;

    for (const [, fileData] of this.files) {
      totalChurn += fileData.commitCount;
      maxChurn = Math.max(maxChurn, fileData.commitCount);
    }

    return {
      totalFiles,
      totalChurn,
      avgChurn: totalFiles > 0 ? (totalChurn / totalFiles).toFixed(1) : 0,
      maxChurn
    };
  }
}

module.exports = { ComplexityAnalyzer };
// Added complexity tracking
