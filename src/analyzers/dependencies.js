/**
 * DependencyRisk — identifies files that are depended upon by many other files.
 * These are "critical" files: changing them has a high blast radius.
 *
 * Uses co-change analysis: if file A and file B are frequently changed
 * in the same commit, they are likely coupled.
 */
class DependencyRisk {
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
    const coChangeMap = this.buildCoChangeMap();
    const criticalFiles = this.calculateCriticalFiles(coChangeMap);
    const couplingClusters = this.findClusters(coChangeMap);
    const stats = this.calculateStats(criticalFiles);

    return {
      criticalFiles,
      couplingClusters,
      stats
    };
  }

  /**
   * Build a map of which files change together
   */
  buildCoChangeMap() {
    const coChange = new Map(); // file → Set of files that change with it

    for (const commit of this.commits) {
      const filePaths = commit.files.map(f => f.path);

      // Only analyze commits that touch multiple files
      if (filePaths.length < 2) continue;

      for (const file of filePaths) {
        if (!coChange.has(file)) {
          coChange.set(file, new Map());
        }

        const fileDeps = coChange.get(file);
        for (const other of filePaths) {
          if (other === file) continue;
          fileDeps.set(other, (fileDeps.get(other) || 0) + 1);
        }
      }
    }

    return coChange;
  }

  /**
   * Calculate critical files based on how many other files
   * are co-changed with them
   */
  calculateCriticalFiles(coChangeMap) {
    const files = [];

    for (const [filePath, dependencies] of coChangeMap) {
      // Count unique files this file is coupled with
      const dependents = dependencies.size;

      // Count total co-changes
      const totalCoChanges = Array.from(dependencies.values()).reduce((a, b) => a + b, 0);

      // Risk score: combination of breadth (how many files) and depth (how often)
      const riskScore = dependents * 2 + Math.log2(totalCoChanges + 1) * 5;

      // Find the most coupled files
      const topCouplings = Array.from(dependencies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([file, count]) => ({ file, coChanges: count }));

      files.push({
        file: filePath,
        dependents,
        totalCoChanges,
        riskScore,
        topCouplings,
        commitCount: this.files.get(filePath)?.commitCount || 0
      });
    }

    files.sort((a, b) => b.riskScore - a.riskScore);
    return files;
  }

  /**
   * Find clusters of tightly coupled files
   */
  findClusters(coChangeMap) {
    const visited = new Set();
    const clusters = [];

    for (const [filePath, dependencies] of coChangeMap) {
      if (visited.has(filePath)) continue;

      // Find all files tightly coupled to this one (>5 co-changes)
      const tightlyCoupled = Array.from(dependencies.entries())
        .filter(([, count]) => count > 5)
        .map(([file]) => file);

      if (tightlyCoupled.length === 0) continue;

      const cluster = new Set([filePath, ...tightlyCoupled]);
      let changed = true;

      // Expand cluster: add files that are coupled with any member
      while (changed) {
        changed = false;
        for (const member of cluster) {
          if (!coChangeMap.has(member)) continue;
          for (const [file, count] of coChangeMap.get(member)) {
            if (count > 3 && !cluster.has(file)) {
              cluster.add(file);
              changed = true;
            }
          }
        }
      }

      // Only keep meaningful clusters
      if (cluster.size >= 2) {
        for (const f of cluster) visited.add(f);
        clusters.push({
          files: Array.from(cluster),
          size: cluster.size,
          description: cluster.size > 5 ? 'Large tightly-coupled module' : 'Tightly coupled files'
        });
      }
    }

    clusters.sort((a, b) => b.size - a.size);
    return clusters.slice(0, 10);
  }

  calculateStats(criticalFiles) {
    return {
      totalAnalyzed: criticalFiles.length,
      highRisk: criticalFiles.filter(f => f.riskScore > 50).length,
      mediumRisk: criticalFiles.filter(f => f.riskScore > 20 && f.riskScore <= 50).length,
      lowRisk: criticalFiles.filter(f => f.riskScore <= 20).length,
      mostCritical: criticalFiles[0]?.file || 'N/A'
    };
  }
}

module.exports = { DependencyRisk };
