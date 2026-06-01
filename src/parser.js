const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * GitParser — reads a git repository and extracts structured data
 * for all downstream analyzers.
 */
class GitParser {
  constructor(repoPath, options = {}) {
    this.repoPath = repoPath;
    this.depth = options.depth || null;
    this.COMMIT_MARKER = '§COMMIT_BOUNDARY§';
  }

  /**
   * Parse the repository and return structured data
   */
  async parse() {
    const repoPath = this.resolveRepoPath(this.repoPath);
    this.validateRepo(repoPath);

    const commits = this.parseCommits(repoPath);
    const files = this.buildFileIndex(commits);
    const contributors = this.buildContributorIndex(commits);
    const timespan = this.calculateTimespan(commits);

    return {
      name: this.getRepoName(repoPath),
      url: this.getRemoteUrl(repoPath),
      path: repoPath,
      commits,
      files,
      contributors,
      timespan
    };
  }

  resolveRepoPath(input) {
    if (fs.existsSync(input)) {
      return path.resolve(input);
    }
    throw new Error(`Repository not found: ${input}`);
  }

  validateRepo(repoPath) {
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error(`Not a git repository (no .git directory): ${repoPath}`);
    }
  }

  getRepoName(repoPath) {
    return path.basename(repoPath);
  }

  getRemoteUrl(repoPath) {
    try {
      return execSync('git remote get-url origin', { cwd: repoPath, encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Parse git log into structured commit objects.
   *
   * Strategy: Use a unique COMMIT marker in the format string as a line-based
   * separator between commits. The --numstat output appears BETWEEN format
   * outputs, so we use the marker to find commit boundaries, then parse
   * each block: first line = metadata (NUL-separated), remaining = numstat.
   */
  parseCommits(repoPath) {
    const depthArg = this.depth ? `--max-count=${this.depth}` : '';
    const metaFormat = `%H%x00%an%x00%ae%x00%aI%x00%s%x00%P`;

    let logOutput;
    try {
      logOutput = execSync(
        `git log ${depthArg} --format="${this.COMMIT_MARKER}%n${metaFormat}" --numstat`,
        { cwd: repoPath, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }
      );
    } catch (err) {
      throw new Error(`Failed to read git log: ${err.message}`);
    }

    return this.parseLogOutput(logOutput);
  }

  /**
   * Parse raw git log output into commit objects.
   *
   * Output format from git log:
   *   §COMMIT_BOUNDARY§
   *   HASH\x00AUTHOR\x00EMAIL\x00DATE\x00SUBJECT\x00PARENTS
   *   100\t0\tfile.js
   *   50\t0\tfile2.js
   *   <blank line>
   *   §COMMIT_BOUNDARY§
   *   HASH2\x00...
   *   ...
   */
  parseLogOutput(output) {
    // Split by the commit marker
    const blocks = output.split(this.COMMIT_MARKER + '\n');
    const commits = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      if (lines.length === 0) continue;

      // First line is NUL-separated metadata: HASH\x00AUTHOR\x00EMAIL\x00DATE\x00SUBJECT\x00PARENTS
      const metaLine = lines[0].trim();
      if (!metaLine) continue;

      // Extract exactly 6 fields by splitting with a limit.
      // The metadata format is: %H%x00%an%x00%ae%x00%aI%x00%s%x00%P
      // Git outputs this as 6 NUL-separated fields. We use limit=6 so
      // the last field captures everything after the 5th separator.
      const rawParts = metaLine.split('\x00');
      if (rawParts.length < 5) continue;

      const hash = (rawParts[0] || '').trim();
      const author = (rawParts[1] || '').trim();
      const email = (rawParts[2] || '').trim();
      const date = (rawParts[3] || '').trim();
      const subject = (rawParts[4] || '').trim();
      // Parents is field 6 (index 5). Handle trailing NUL: if rawParts has
      // exactly 6 parts (no trailing NUL) use index 5; if 7+ (trailing NUL)
      // still use index 5 which is the actual parents value.
      const parents = (rawParts.length > 5 ? rawParts[5] : '').trim();

      // Remaining lines are numstat: added \t deleted \t file
      const files = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (match) {
          files.push({
            added: match[1] === '-' ? 0 : parseInt(match[1], 10),
            removed: match[2] === '-' ? 0 : parseInt(match[2], 10),
            path: match[3]
          });
        }
      }

      commits.push({
        hash,
        author,
        email,
        date,
        subject,
        parents: parents ? parents.split(' ').filter(Boolean) : [],
        files
      });
    }

    return commits;
  }

  /**
   * Build a file index: file path → metadata
   */
  buildFileIndex(commits) {
    const files = new Map();

    for (const commit of commits) {
      for (const file of commit.files) {
        if (!files.has(file.path)) {
          files.set(file.path, {
            path: file.path,
            firstSeen: commit.date,
            lastSeen: commit.date,
            totalAdded: 0,
            totalRemoved: 0,
            commitCount: 0,
            authors: new Map()
          });
        }

        const f = files.get(file.path);
        f.totalAdded += file.added;
        f.totalRemoved += file.removed;
        f.commitCount++;
        f.lastSeen = commit.date;

        if (!f.authors.has(commit.author)) {
          f.authors.set(commit.author, { commits: 0, added: 0, removed: 0 });
        }
        const authorStats = f.authors.get(commit.author);
        authorStats.commits++;
        authorStats.added += file.added;
        authorStats.removed += file.removed;
      }
    }

    return files;
  }

  /**
   * Build contributor index: author name → stats
   */
  buildContributorIndex(commits) {
    const contributors = new Map();

    for (const commit of commits) {
      if (!contributors.has(commit.author)) {
        contributors.set(commit.author, {
          name: commit.author,
          email: commit.email,
          commits: 0,
          linesAdded: 0,
          linesRemoved: 0,
          firstCommit: commit.date,
          lastCommit: commit.date,
          files: new Set()
        });
      }

      const c = contributors.get(commit.author);
      c.commits++;
      c.lastCommit = commit.date;

      for (const file of commit.files) {
        c.linesAdded += file.added;
        c.linesRemoved += file.removed;
        c.files.add(file.path);
      }
    }

    return contributors;
  }

  /**
   * Calculate timespan of the repository
   */
  calculateTimespan(commits) {
    if (commits.length === 0) return 'No commits';

    const dates = commits.map(c => new Date(c.date)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return 'Unknown';

    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    const days = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));

    if (days < 1) return 'Less than a day';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return `${years} year${years > 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
  }
}

module.exports = { GitParser };
