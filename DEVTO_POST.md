# RepoLens — I Built a Codebase Intelligence Tool That Reads Your Git History and Tells You What GitHub Won't

*This is a submission for the [GitHub Finish-Up-A-Thon Challenge](https://dev.to/challenges/github-2026-05-21)*

## What I Built

RepoLens is a CLI tool that analyzes any Git repository's history and extracts actionable intelligence — the stuff GitHub doesn't show you.

```bash
npm install -g repolens
repolens analyze /path/to/your/repo
```

It tells you:

- **👥 Who actually owns each file** — not who committed last, but who wrote 70%+ of the lines and truly understands it
- **📈 Complexity timeline** — is your codebase getting more or less maintainable over time?
- **🐛 Bug archaeology** — which files are bug magnets? Which commits introduced the most fixes later?
- **💀 Dead code detection** — files nobody has touched in 2 years that nothing references
- **🔗 Dependency risk** — which files are depended on by everything (change them and you break the world)
- **🤖 AI codebase briefing** — a natural language summary of your entire codebase

Here's what it looks like running on a real repo:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 RepoLens Report: my-project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

📈 Complexity Trend: ↑ increasing (+23.5% over 18 periods)
🐛 Bug Hotspots: src/auth/handler.js (23 fixes, 18.4% of all bugs) 🔴
💀 Dead Code: 14 files untouched for 12+ months
🔗 Critical Files: src/utils/index.js (23 dependents, risk score: 87.3)

🤖 AI Briefing:
"my-project is a TypeScript app with rising complexity. The auth
handler is the top bug hotspot. Consider refactoring and adding
tests for the 14 dead code files."
```

## Demo

**GitHub Repository:** [https://github.com/mamoor123/repolens](https://github.com/mamoor123/repolens)

**Install and run:**
```bash
# Install
npm install -g repolens

# Analyze any local git repo
repolens analyze /path/to/repo

# Individual analyses
repolens ownership /path/to/repo
repolens complexity /path/to/repo
repolens bugs /path/to/repo
repolens deadcode /path/to/repo

# JSON output
repolens analyze /path/to/repo --json --output report.json
```

**Programmatic API:**
```javascript
const { analyze } = require('repolens');
const report = await analyze('/path/to/repo');
console.log(report.ownership.topOwners);
console.log(report.bugs.hotspots);
```

**Screenshots:**

Running `repolens analyze .` on the RepoLens codebase itself:

![RepoLens self-analysis](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/repolens-demo-output.png)

The CLI outputs a formatted report with tables showing ownership, complexity trends, bug hotspots, dead code suspects, and dependency risk scores.

## The Comeback Story

### Before — October 2025

It started as a weekend experiment. I had a 200-line Python script that ran `git log --numstat` and printed some basic stats. It could tell you how many commits each author had and which files changed the most.

```python
# The entire "before" — 200 lines of Python
import subprocess
result = subprocess.run(['git', 'log', '--numstat'], capture_output=True)
# ... parse and print basic counts
```

No tests. No structure. No documentation. I pushed it to GitHub, thought "I'll come back to this," and forgot about it for 8 months.

### After — June 2026

When I saw the GitHub Finish-Up-A-Thon challenge, I knew this was the project to revive. Not because it was my best abandoned project, but because the *idea* was right — developers deserve better insights into their own repositories.

The revival took the project from a throwaway script to a published developer tool:

| Dimension | Before (Oct 2025) | After (June 2026) |
|---|---|---|
| **Language** | Python | Node.js (npm package) |
| **Lines of code** | ~200 | ~3,500 |
| **Tests** | 0 | 36 (all passing) |
| **Test coverage** | 0% | Comprehensive across 7 suites |
| **Analysis engines** | 1 (basic stats) | 6 (ownership, complexity, bugs, dead code, deps, AI) |
| **Output** | Console dump | Formatted tables + JSON + file export |
| **Distribution** | Clone from GitHub | `npm install -g repolens` |
| **CI/CD** | None | GitHub Actions (Node 18/20/22) |
| **Documentation** | README with 2 lines | Full docs with API reference |
| **Installation** | "clone and run python" | `npm install -g repolens` |

The hardest part wasn't writing new features — it was making the git log parser robust. Git's output format is deceptively complex. Binary files show `-` instead of numbers. Merge commits have multiple parents. Filenames can contain special characters. My original Python script punted on all of these. RepoLens handles them correctly.

The second hardest part was the bug detection patterns. I needed a regex library that could identify bug-fix commits across different writing styles: "fix null pointer," "resolve #142," "revert broken change," "security patch CVE-2025-1234." GitHub Copilot was instrumental here (more on that below).

## My Experience with GitHub Copilot

I used GitHub Copilot throughout the project, but not for the usual "write me a React component" stuff. Here's where it made the biggest impact:

### 1. Git Log Parser Design

The trickiest part was parsing git's `--numstat` output. The format looks like:

```
HASH\x00AUTHOR\x00EMAIL\x00DATE\x00SUBJECT\x00PARENTS
100\t0\tfile.js
50\t0\tfile2.js
```

The problem: `--numstat` output appears *between* format outputs, making it hard to find commit boundaries. I described the problem to Copilot and it suggested using a unique commit marker in the format string:

```javascript
// Copilot suggested this approach
const COMMIT_MARKER = '§COMMIT_BOUNDARY§';
const format = `${COMMIT_MARKER}%n%H%x00%an%x00%ae%x00%aI%x00%s%x00%P`;
```

This split the output into clean blocks: marker → metadata → numstat. It was the key insight that made the entire parser work.

### 2. Bug Detection Pattern Library

I needed regexes that could identify bug-fix commits across wildly different commit message styles. Copilot generated the initial pattern library:

```javascript
// Copilot generated these 13 patterns
this.bugPatterns = [
  /\bfix(ed|es|ing)?\b/i,
  /\bbug\b/i,
  /\bpatch\b/i,
  /\bhotfix\b/i,
  /\bregression\b/i,
  /\bcrash\b/i,
  /\bnull\s*pointer\b/i,
  /\bsecurity\b|\bvulnerability\b|\bcve-\d+/i,
  /\brevert\b/i,
  // ... and more
];
```

I reviewed each one, adjusted the word boundary rules, and added the CVE pattern. Copilot got us 80% of the way there; the remaining 20% was understanding edge cases like "This commit fixes nothing" (false positive) vs "Fix null pointer crash" (true positive).

### 3. Test Suite Generation

This is where Copilot saved the most time. I'd describe a test scenario and it would generate a complete test with mock data:

```
Me: "Write a test for the bug archaeology analyzer that checks if 
it correctly identifies security-related commits and revert commits"

Copilot: [Generated the exact test with mock repo data, assertions 
for security classification, revert detection, and risk level validation]
```

36 tests across 7 suites. Copilot wrote about 70% of the test code. I reviewed every test, adjusted assertions, and added edge cases (empty repos, binary files, commits with no files).

### 4. The Off-By-One Bug

The most satisfying Copilot moment: I had a bug where `commits[0].files.length` was always 0. I stared at the code for 20 minutes. Copilot suggested using `split('\x00', 6)` to limit the NUL-byte split to exactly 6 fields. The trailing `\x00` in the metadata was creating an extra empty element that shifted all the field assignments. Fixed instantly.

### 5. AI Briefing Template Engine

The AI briefing feature generates natural language summaries from structured analysis data. Copilot helped design the template system that combines ownership percentages, complexity trends, and bug hotspots into readable paragraphs. It also helped me write the fallback LLM integration that tries GitHub Models, then Groq, then falls back to templates.

### What Copilot Didn't Do

Copilot didn't design the architecture. It didn't decide to use co-change analysis for dependency risk mapping. It didn't choose to calculate bus factors. Those were human decisions. Copilot was the best pair programmer I've ever had — fast, knowledgeable, and tireless — but it was still *pair* programming. I was the driver.

---

**Try it:** `npm install -g repolens && repolens analyze .`

**Source:** [github.com/mamoor123/repolens](https://github.com/mamoor123/repolens)

Built with 🔍 by RepoLens Contributors

githubchallenge #devchallenge #githubcopilot
