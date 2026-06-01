/**
 * RepoLens — Codebase Intelligence from Git History
 *
 * Main module exports for programmatic usage.
 */
const { GitParser } = require('./parser');
const { OwnershipAnalyzer } = require('./analyzers/ownership');
const { ComplexityAnalyzer } = require('./analyzers/complexity');
const { BugArchaeology } = require('./analyzers/bugs');
const { DeadCodeDetector } = require('./analyzers/deadcode');
const { DependencyRisk } = require('./analyzers/dependencies');
const { AIBriefing } = require('./ai/briefing');

/**
 * Run a full analysis on a repository
 */
async function analyze(repoPath, options = {}) {
  const parser = new GitParser(repoPath, options);
  const repoData = await parser.parse();

  const ownership = new OwnershipAnalyzer(repoData).analyze();
  const complexity = new ComplexityAnalyzer(repoData).analyze();
  const bugs = new BugArchaeology(repoData).analyze();
  const deadCode = new DeadCodeDetector(repoData).analyze();
  const dependencies = new DependencyRisk(repoData).analyze();

  let aiBriefing = null;
  if (options.ai !== false) {
    const ai = new AIBriefing(options);
    aiBriefing = await ai.generate({
      repo: repoData,
      ownership,
      complexity,
      bugs,
      deadCode,
      dependencies
    });
  }

  return {
    meta: {
      repo: repoData.name,
      url: repoData.url,
      analyzedAt: new Date().toISOString(),
      totalCommits: repoData.commits.length,
      totalFiles: repoData.files.size,
      contributors: repoData.contributors.size,
      timespan: repoData.timespan
    },
    ownership,
    complexity,
    bugs,
    deadCode,
    dependencies,
    aiBriefing
  };
}

module.exports = {
  analyze,
  GitParser,
  OwnershipAnalyzer,
  ComplexityAnalyzer,
  BugArchaeology,
  DeadCodeDetector,
  DependencyRisk,
  AIBriefing
};
