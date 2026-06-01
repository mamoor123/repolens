#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const path = require('path');
const { GitParser } = require('../src/parser');
const { OwnershipAnalyzer } = require('../src/analyzers/ownership');
const { ComplexityAnalyzer } = require('../src/analyzers/complexity');
const { BugArchaeology } = require('../src/analyzers/bugs');
const { DeadCodeDetector } = require('../src/analyzers/deadcode');
const { DependencyRisk } = require('../src/analyzers/dependencies');
const { AIBriefing } = require('../src/ai/briefing');
const { formatNumber, formatPercent, formatDuration } = require('../src/utils/format');

const program = new Command();

program
  .name('repolens')
  .description('🔍 Codebase intelligence from Git history')
  .version('1.0.0');

program
  .command('analyze <repo>')
  .description('Run full analysis on a local git repository or clone a remote URL')
  .option('-j, --json', 'Output as JSON')
  .option('-o, --output <file>', 'Write report to file')
  .option('--no-ai', 'Skip AI briefing generation')
  .option('--depth <n>', 'Limit commit history depth', parseInt)
  .action(async (repo, options) => {
    const spinner = ora('Initializing RepoLens...').start();
    const startTime = Date.now();

    try {
      // Parse git history
      spinner.text = 'Parsing git history...';
      const parser = new GitParser(repo, { depth: options.depth });
      const repoData = await parser.parse();

      spinner.text = 'Analyzing file ownership...';
      const ownership = new OwnershipAnalyzer(repoData);
      const ownershipReport = ownership.analyze();

      spinner.text = 'Calculating complexity timeline...';
      const complexity = new ComplexityAnalyzer(repoData);
      const complexityReport = complexity.analyze();

      spinner.text = 'Excavating bug history...';
      const bugs = new BugArchaeology(repoData);
      const bugReport = bugs.analyze();

      spinner.text = 'Detecting dead code...';
      const deadCode = new DeadCodeDetector(repoData);
      const deadCodeReport = deadCode.analyze();

      spinner.text = 'Mapping dependency risks...';
      const deps = new DependencyRisk(repoData);
      const depReport = deps.analyze();

      let aiReport = null;
      if (options.ai !== false) {
        spinner.text = 'Generating AI codebase briefing...';
        const ai = new AIBriefing();
        aiReport = await ai.generate({
          repo: repoData,
          ownership: ownershipReport,
          complexity: complexityReport,
          bugs: bugReport,
          deadCode: deadCodeReport,
          dependencies: depReport
        });
      }

      spinner.succeed(`Analysis complete in ${formatDuration(Date.now() - startTime)}`);

      const report = {
        meta: {
          repo: repoData.name,
          url: repoData.url,
          analyzedAt: new Date().toISOString(),
          totalCommits: repoData.commits.length,
          totalFiles: repoData.files.size,
          contributors: repoData.contributors.size,
          timespan: repoData.timespan
        },
        ownership: ownershipReport,
        complexity: complexityReport,
        bugs: bugReport,
        deadCode: deadCodeReport,
        dependencies: depReport,
        aiBriefing: aiReport
      };

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printReport(report);
      }

      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
        console.log(chalk.green(`\n📁 Report saved to ${options.output}`));
      }

    } catch (err) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(`\n❌ ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('ownership <repo>')
  .description('Show file ownership map')
  .option('-n, --top <n>', 'Show top N owners per file', parseInt, 3)
  .action(async (repo, options) => {
    const spinner = ora('Parsing git history...').start();
    try {
      const parser = new GitParser(repo);
      const repoData = await parser.parse();
      const ownership = new OwnershipAnalyzer(repoData);
      const report = ownership.analyze();

      spinner.succeed('Ownership analysis complete');
      printOwnership(report, options.top);
    } catch (err) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program
  .command('complexity <repo>')
  .description('Show complexity timeline')
  .action(async (repo) => {
    const spinner = ora('Parsing git history...').start();
    try {
      const parser = new GitParser(repo);
      const repoData = await parser.parse();
      const complexity = new ComplexityAnalyzer(repoData);
      const report = complexity.analyze();

      spinner.succeed('Complexity analysis complete');
      printComplexity(report);
    } catch (err) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program
  .command('bugs <repo>')
  .description('Show bug hotspot analysis')
  .action(async (repo) => {
    const spinner = ora('Excavating bug history...').start();
    try {
      const parser = new GitParser(repo);
      const repoData = await parser.parse();
      const bugs = new BugArchaeology(repoData);
      const report = bugs.analyze();

      spinner.succeed('Bug analysis complete');
      printBugs(report);
    } catch (err) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program
  .command('deadcode <repo>')
  .description('Detect potentially dead code files')
  .action(async (repo) => {
    const spinner = ora('Scanning for dead code...').start();
    try {
      const parser = new GitParser(repo);
      const repoData = await parser.parse();
      const deadCode = new DeadCodeDetector(repoData);
      const report = deadCode.analyze();

      spinner.succeed('Dead code analysis complete');
      printDeadCode(report);
    } catch (err) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ─── Pretty Printers ────────────────────────────────────────────────

function printReport(report) {
  const { meta, ownership, complexity, bugs, deadCode, dependencies, aiBriefing } = report;

  console.log('');
  console.log(chalk.cyan.bold('━'.repeat(60)));
  console.log(chalk.cyan.bold(`  🔍 RepoLens Report: ${meta.repo}`));
  console.log(chalk.cyan.bold('━'.repeat(60)));

  // Meta
  console.log('');
  console.log(chalk.white.bold('📊 Overview'));
  const metaTable = new Table({ style: { head: [], border: [] } });
  metaTable.push(
    ['Repository', chalk.white(meta.repo)],
    ['Total Commits', chalk.yellow(formatNumber(meta.totalCommits))],
    ['Total Files', chalk.yellow(formatNumber(meta.totalFiles))],
    ['Contributors', chalk.yellow(formatNumber(meta.contributors))],
    ['Timespan', chalk.white(meta.timespan)]
  );
  console.log(metaTable.toString());

  // Top Owners
  console.log('');
  console.log(chalk.white.bold('👥 Top Contributors (by lines of code)'));
  const ownerTable = new Table({ head: ['Author', 'Commits', 'Lines Added', 'Lines Removed', 'Ownership %'], style: { head: ['cyan'] } });
  ownership.topOwners.slice(0, 8).forEach(o => {
    ownerTable.push([o.name, formatNumber(o.commits), `+${formatNumber(o.linesAdded)}`, `-${formatNumber(o.linesRemoved)}`, formatPercent(o.ownership)]);
  });
  console.log(ownerTable.toString());

  // Complexity
  console.log('');
  console.log(chalk.white.bold('📈 Complexity Trend'));
  const trend = complexity.trend;
  const trendIcon = trend.direction === 'increasing' ? '↑' : trend.direction === 'decreasing' ? '↓' : '→';
  const trendColor = trend.direction === 'increasing' ? 'red' : trend.direction === 'decreasing' ? 'green' : 'yellow';
  console.log(`  Trend: ${chalk[trendColor](trendIcon + ' ' + trend.direction)} (${trend.percentChange}% over ${trend.periods} periods)`);
  console.log(`  Current avg complexity: ${chalk.white(trend.currentAvg.toFixed(1))}`);
  console.log(`  Most complex file: ${chalk.yellow(trend.mostComplexFile)}`);

  // Bug Hotspots
  console.log('');
  console.log(chalk.white.bold('🐛 Bug Hotspots'));
  const bugTable = new Table({ head: ['File', 'Bug-fix Commits', '% of All Fixes', 'Risk'], style: { head: ['cyan'] } });
  bugs.hotspots.slice(0, 10).forEach(b => {
    const risk = b.riskLevel === 'critical' ? chalk.red('🔴 CRITICAL') :
                 b.riskLevel === 'high' ? chalk.yellow('🟡 HIGH') :
                 b.riskLevel === 'medium' ? chalk.blue('🔵 MEDIUM') : chalk.green('🟢 LOW');
    bugTable.push([truncate(b.file, 50), b.bugFixCommits, formatPercent(b.percentOfFixes), risk]);
  });
  console.log(bugTable.toString());

  // Dead Code
  console.log('');
  console.log(chalk.white.bold('💀 Potentially Dead Code'));
  console.log(`  Files untouched for 12+ months: ${chalk.yellow(deadCode.suspects.length)}`);
  if (deadCode.suspects.length > 0) {
    const deadTable = new Table({ head: ['File', 'Last Modified', 'Days Idle', 'Lines'], style: { head: ['cyan'] } });
    deadCode.suspects.slice(0, 10).forEach(d => {
      deadTable.push([truncate(d.file, 50), d.lastModified, d.daysIdle, d.lines]);
    });
    console.log(deadTable.toString());
  }

  // Dependency Risk
  console.log('');
  console.log(chalk.white.bold('🔗 Critical Files (highest dependency risk)'));
  const depTable = new Table({ head: ['File', 'Dependents', 'Risk Score'], style: { head: ['cyan'] } });
  dependencies.criticalFiles.slice(0, 10).forEach(d => {
    depTable.push([truncate(d.file, 50), d.dependents, chalk.red(d.riskScore.toFixed(1))]);
  });
  console.log(depTable.toString());

  // AI Briefing
  if (aiBriefing) {
    console.log('');
    console.log(chalk.white.bold('🤖 AI Codebase Briefing'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(aiBriefing.summary);
    console.log(chalk.gray('─'.repeat(60)));
  }

  console.log('');
  console.log(chalk.cyan('━'.repeat(60)));
  console.log(chalk.gray(`  Generated by RepoLens v1.0.0`));
  console.log(chalk.gray(`  ${meta.analyzedAt}`));
  console.log(chalk.cyan('━'.repeat(60)));
  console.log('');
}

function printOwnership(report, topN) {
  console.log('');
  console.log(chalk.cyan.bold('👥 File Ownership Map'));
  const table = new Table({ head: ['File', 'Primary Owner', 'Ownership %', 'Commits'], style: { head: ['cyan'] } });
  report.fileOwnership.forEach(f => {
    table.push([truncate(f.file, 55), f.primaryOwner.name, formatPercent(f.primaryOwner.ownership), f.primaryOwner.commits]);
  });
  console.log(table.toString());
}

function printComplexity(report) {
  console.log('');
  console.log(chalk.cyan.bold('📈 Complexity Timeline'));
  const table = new Table({ head: ['Period', 'Avg Complexity', 'Max Complexity', 'Files Analyzed'], style: { head: ['cyan'] } });
  report.timeline.forEach(t => {
    table.push([t.period, t.avgComplexity.toFixed(1), t.maxComplexity, t.filesAnalyzed]);
  });
  console.log(table.toString());
}

function printBugs(report) {
  console.log('');
  console.log(chalk.cyan.bold('🐛 Bug Archaeology'));
  console.log(`  Total bug-fix commits: ${chalk.yellow(report.totalBugFixes)}`);
  console.log(`  Percentage of all commits: ${chalk.yellow(formatPercent(report.bugFixPercent))}`);
  printReport(report);
}

function printDeadCode(report) {
  console.log('');
  console.log(chalk.cyan.bold('💀 Dead Code Report'));
  console.log(`  Total suspects: ${chalk.yellow(report.suspects.length)}`);
  report.suspects.forEach(d => {
    console.log(`  ${chalk.gray('○')} ${d.file} — last touched ${d.lastModified} (${d.daysIdle} days ago)`);
  });
}

function truncate(str, len) {
  return str.length > len ? '...' + str.slice(str.length - len + 3) : str;
}

program.parse();
