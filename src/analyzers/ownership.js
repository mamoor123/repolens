/**
 * OwnershipAnalyzer — determines who owns which files based on
 * commit history, lines of code, and commit frequency.
 */
class OwnershipAnalyzer {
  constructor(repoData) {
    this.repoData = repoData;
    this.commits = repoData.commits;
    // Derive from commits if Maps are empty (e.g. in tests)
    if (repoData.files.size === 0) {
      const { GitParser } = require('../parser');
      const parser = new GitParser('/tmp');
      repoData.files = parser.buildFileIndex(repoData.commits);
    }
    if (repoData.contributors.size === 0) {
      const { GitParser } = require('../parser');
      const parser = new GitParser('/tmp');
      repoData.contributors = parser.buildContributorIndex(repoData.commits);
    }
    this.files = repoData.files;
    this.contributors = repoData.contributors;
  }

  analyze() {
    const topOwners = this.calculateTopOwners();
    const fileOwnership = this.calculateFileOwnership();
    const busFactor = this.calculateBusFactor(fileOwnership);

    return {
      topOwners,
      fileOwnership,
      busFactor
    };
  }

  /**
   * Rank contributors by total lines of code (added - removed is net impact,
   * but total added shows actual writing volume)
   */
  calculateTopOwners() {
    const owners = [];

    for (const [name, stats] of this.contributors) {
      owners.push({
        name,
        email: stats.email,
        commits: stats.commits,
        linesAdded: stats.linesAdded,
        linesRemoved: stats.linesRemoved,
        netLines: stats.linesAdded - stats.linesRemoved,
        filesTouched: stats.files.size,
        firstCommit: stats.firstCommit,
        lastCommit: stats.lastCommit
      });
    }

    // Sort by lines added (most prolific first)
    owners.sort((a, b) => b.linesAdded - a.linesAdded);

    // Calculate ownership percentage
    const totalLines = owners.reduce((sum, o) => sum + o.linesAdded, 0);
    for (const owner of owners) {
      owner.ownership = totalLines > 0 ? owner.linesAdded / totalLines : 0;
    }

    return owners;
  }

  /**
   * For each file, determine who owns it and by how much
   */
  calculateFileOwnership() {
    const fileOwnership = [];

    for (const [filePath, fileStats] of this.files) {
      const authors = [];

      for (const [authorName, authorStats] of fileStats.authors) {
        const totalChanges = authorStats.added + authorStats.removed;
        authors.push({
          name: authorName,
          commits: authorStats.commits,
          linesAdded: authorStats.added,
          linesRemoved: authorStats.removed,
          totalChanges
        });
      }

      // Sort by total changes
      authors.sort((a, b) => b.totalChanges - a.totalChanges);

      const totalFileChanges = authors.reduce((sum, a) => sum + a.totalChanges, 0);

      for (const author of authors) {
        author.ownership = totalFileChanges > 0 ? author.totalChanges / totalFileChanges : 0;
      }

      fileOwnership.push({
        file: filePath,
        primaryOwner: authors[0] || { name: 'unknown', ownership: 0, commits: 0 },
        authors,
        totalCommits: fileStats.commitCount,
        totalAdded: fileStats.totalAdded,
        totalRemoved: fileStats.totalRemoved,
        firstSeen: fileStats.firstSeen,
        lastSeen: fileStats.lastSeen
      });
    }

    // Sort by total commits (most active first)
    fileOwnership.sort((a, b) => b.totalCommits - a.totalCommits);

    return fileOwnership;
  }

  /**
   * Bus factor: how many people would need to leave before
   * a file has no knowledgeable maintainer.
   * Files with bus factor = 1 are risky.
   */
  calculateBusFactor(fileOwnership) {
    const riskFiles = [];

    for (const file of fileOwnership) {
      // A contributor "owns" the file if they have >50% of changes
      const significantOwners = file.authors.filter(a => a.ownership > 0.5);
      const busFactor = significantOwners.length;

      if (busFactor <= 1) {
        riskFiles.push({
          file: file.file,
          busFactor: Math.max(busFactor, 0),
          primaryOwner: file.primaryOwner.name,
          ownership: file.primaryOwner.ownership,
          risk: busFactor === 0 ? 'critical' : 'high'
        });
      }
    }

    return riskFiles;
  }
}

module.exports = { OwnershipAnalyzer };
