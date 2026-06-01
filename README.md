# 🔍 RepoLens — Codebase Intelligence from Git History

[![npm version](https://img.shields.io/npm/v/repolens.svg)](https://www.npmjs.com/package/repolens)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/repolens/repolens/actions/workflows/ci.yml/badge.svg)](https://github.com/repolens/repolens/actions/workflows/ci.yml)

**RepoLens** analyzes any Git repository's history and extracts actionable intelligence that GitHub doesn't show you.

> "GitHub shows you what changed. RepoLens shows you **why it matters**."

## ✨ Features

- **👥 Ownership Maps** — Who actually owns each file (not who committed last)
- **📈 Complexity Timeline** — Watch your codebase get more or less maintainable over time
- **🐛 Bug Archaeology** — Which commits introduced the most bug-fix commits later
- **💀 Dead Code Detection** — Files nobody has touched in years that nothing references
- **🔗 Dependency Risk** — Which files are depended on by everything (change them and you break the world)
- **🤖 AI Codebase Briefing** — Natural language summary of your entire codebase

## 🚀 Quick Start

```bash
# Install globally
npm install -g repolens

# Analyze any local git repository
repolens analyze /path/to/your/repo

# Or analyze the current directory
repolens analyze .
```

## 📖 Usage

### Full Analysis

```bash
repolens analyze /path/to/repo
```

Output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 RepoLens Report: my-project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overview
┌──────────────┬───────────────────┐
│ Repository   │ my-project        │
│ Total Commits│ 1,247             │
│ Total Files  │ 342               │
│ Contributors │ 12                │
│ Timespan     │ 2 years, 3 months │
└──────────────┴───────────────────┘

👥 Top Contributors (by lines of code)
┌──────────┬─────────┬──────────┬──────────┬──────────────┐
│ Author   │ Commits │ Added    │ Removed  │ Ownership %  │
├──────────┼─────────┼──────────┼──────────┼──────────────┤
│ Alice    │ 487     │ +45,230  │ -12,100  │ 42.3%        │
│ Bob      │ 312     │ +28,400  │ -8,900   │ 26.5%        │
│ Charlie  │ 198     │ +15,600  │ -5,200   │ 14.6%        │
└──────────┴─────────┴──────────┴──────────┴──────────────┘

📈 Complexity Trend
  Trend: ↑ increasing (+23.5% over 18 periods)
  Current avg complexity: 4.2
  Most complex file: src/auth/handler.js

🐛 Bug Hotspots
┌──────────────────────┬────────────────┬─────────────┬────────┐
│ File                 │ Bug-fix Commits │ % of Fixes  │ Risk   │
├──────────────────────┼────────────────┼─────────────┼────────┤
│ src/auth/handler.js  │ 23             │ 18.4%       │ 🔴 HIGH │
│ src/db/connection.js │ 11             │ 8.8%        │ 🟡 MED  │
└──────────────────────┴────────────────┴─────────────┴────────┘

💀 Potentially Dead Code
  Files untouched for 12+ months: 14

🔗 Critical Files (highest dependency risk)
┌────────────────────┬────────────┬────────────┐
│ File               │ Dependents │ Risk Score │
├────────────────────┼────────────┼────────────┤
│ src/utils/index.js │ 23         │ 87.3       │
│ src/config.js      │ 18         │ 64.1       │
└────────────────────┴────────────┴────────────┘

🤖 AI Codebase Briefing
────────────────────────────────────────────────────────────
📋 my-project is a TypeScript project with 1,247 commits from
12 contributors over 2 years, 3 months. Alice leads with 42%
ownership. Complexity is ↑ increasing. Top bug hotspot:
src/auth/handler.js with 23 fixes. 14 files are potentially
dead code. Consider refactoring auth handler and cleaning up
unused modules.
────────────────────────────────────────────────────────────
```

### Individual Analyses

```bash
# File ownership only
repolens ownership /path/to/repo

# Complexity timeline only
repolens complexity /path/to/repo

# Bug hotspot analysis only
repolens bugs /path/to/repo

# Dead code detection only
repolens deadcode /path/to/repo
```

### JSON Output

```bash
repolens analyze /path/to/repo --json
repolens analyze /path/to/repo --json --output report.json
```

### Skip AI Briefing

```bash
repolens analyze /path/to/repo --no-ai
```

## 📦 Programmatic API

```javascript
const { analyze } = require('repolens');

const report = await analyze('/path/to/repo', { ai: false });
console.log(report.ownership.topOwners);
console.log(report.bugs.hotspots);
console.log(report.complexity.trend);
```

## 🏗️ Architecture

```
repolens/
├── bin/repolens.js          # CLI entry point
├── src/
│   ├── index.js             # Main module + API
│   ├── parser.js            # Git log parser
│   ├── analyzers/
│   │   ├── ownership.js     # File ownership analysis
│   │   ├── complexity.js    # Complexity timeline
│   │   ├── bugs.js          # Bug archaeology
│   │   ├── deadcode.js      # Dead code detection
│   │   └── dependencies.js  # Dependency risk mapping
│   ├── ai/
│   │   └── briefing.js      # AI codebase briefing
│   └── utils/
│       └── format.js        # Output formatting
└── test/
    ├── parser.test.js       # Parser tests
    ├── ownership.test.js    # Ownership tests
    ├── bugs.test.js         # Bug analysis tests
    └── analyzers.test.js    # Other analyzer tests
```

## 🧪 Testing

```bash
npm test
```

All analyzers have comprehensive test coverage using Node.js built-in test runner.

## 🤖 How GitHub Copilot Was Used

GitHub Copilot was instrumental in building RepoLens:

1. **Git log parser design** — Copilot helped design the NUL-delimited parsing strategy and edge case handling for binary files
2. **Bug detection patterns** — Copilot generated the regex pattern library for identifying bug-fix commits across different commit message styles
3. **Test generation** — Copilot wrote 80% of the test suite, including edge cases for binary file handling and empty commit messages
4. **AI briefing templates** — Copilot engineered the template system that generates natural language summaries from structured data
5. **Complexity algorithm** — Copilot helped design the weighted churn-score algorithm for complexity calculation

## 📋 This is a submission for the GitHub Finish-Up-A-Thon Challenge

### The Comeback Story

**Before (October 2025):** A 200-line Python script that printed git log stats. No tests, no structure, abandoned after a weekend experiment.

**After (June 2026):** A published npm package with 6 analysis engines, comprehensive test coverage, CI/CD pipeline, and a clean CLI interface. From "git log printer" to "codebase intelligence platform."

### My Experience with GitHub Copilot

Copilot was used throughout for:
- Designing the git log parser with proper NUL-delimited format handling
- Generating the bug detection regex pattern library
- Writing comprehensive test suites with edge cases
- Engineering the AI briefing prompt templates
- Building the complexity scoring algorithm
- Creating the CLI interface with Commander.js

The most impactful moment: Copilot suggested using co-change analysis for dependency risk mapping — an approach I hadn't considered that turned out to be the most valuable feature.

## 📄 License

MIT

---

Built with 🔍 by RepoLens Contributors
