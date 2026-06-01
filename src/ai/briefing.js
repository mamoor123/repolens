/**
 * AIBriefing — generates a natural language summary of the codebase
 * using all analysis results. This is the "wow" feature.
 *
 * NOTE: This module generates a briefing from the analysis data.
 * In a full deployment, this would call an LLM API. For the hackathon
 * submission, we use a template-based approach that produces high-quality
 * summaries from the structured data.
 */
class AIBriefing {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GITHUB_TOKEN || process.env.GROQ_API_KEY;
  }

  /**
   * Generate a natural language briefing from all analysis results
   */
  async generate(data) {
    const { repo, ownership, complexity, bugs, deadCode, dependencies } = data;

    // Try LLM-based briefing if API key is available
    if (this.apiKey) {
      try {
        return await this.generateLLMBriefing(data);
      } catch (err) {
        // Fall back to template-based briefing
        console.error(`AI briefing fallback: ${err.message}`);
      }
    }

    // Template-based briefing (always works, no API needed)
    return this.generateTemplateBriefing(data);
  }

  /**
   * Template-based briefing — generates a high-quality summary
   * purely from the analysis data using templates
   */
  generateTemplateBriefing(data) {
    const { repo, ownership, complexity, bugs, deadCode, dependencies } = data;
    const sections = [];

    // Repository overview
    const topLang = this.detectPrimaryLanguage(repo.files);
    sections.push(this.buildOverview(repo, topLang));

    // Ownership insights
    sections.push(this.buildOwnershipInsight(ownership));

    // Complexity assessment
    sections.push(this.buildComplexityInsight(complexity));

    // Bug analysis
    sections.push(this.buildBugInsight(bugs));

    // Dead code
    if (deadCode.suspects.length > 0) {
      sections.push(this.buildDeadCodeInsight(deadCode));
    }

    // Dependency risk
    sections.push(this.buildDependencyInsight(dependencies));

    // Recommendations
    sections.push(this.buildRecommendations(data));

    const summary = sections.filter(Boolean).join('\n\n');

    return {
      summary,
      generatedAt: new Date().toISOString(),
      method: 'template',
      sections: sections.length
    };
  }

  /**
   * LLM-based briefing using GitHub Models or Groq
   */
  async generateLLMBriefing(data) {
    const prompt = this.buildPrompt(data);
    const https = require('https');
    const url = require('url');

    // Try GitHub Models first, then Groq
    const endpoints = [
      {
        url: 'https://models.inference.ai.azure.com/chat/completions',
        model: 'gpt-4o-mini',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      },
      {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama3-8b-8192',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await this.callLLM(endpoint, prompt);
        if (result) {
          return {
            summary: result,
            generatedAt: new Date().toISOString(),
            method: 'llm',
            model: endpoint.model
          };
        }
      } catch {
        continue;
      }
    }

    throw new Error('No LLM endpoint available');
  }

  callLLM(endpoint, prompt) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(endpoint.url);
      const body = JSON.stringify({
        model: endpoint.model,
        messages: [
          { role: 'system', content: 'You are a code analyst. Write a concise, insightful briefing about this codebase based on the analysis data. Be specific and actionable. Use bullet points. Keep it under 300 words.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname,
        method: 'POST',
        headers: { ...endpoint.headers, 'Content-Length': Buffer.byteLength(body) },
        timeout: 10000
      };

      const req = require('https').request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0]) {
              resolve(json.choices[0].message.content);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  }

  buildPrompt(data) {
    const { repo, ownership, complexity, bugs, deadCode, dependencies } = data;

    return `Analyze this codebase:
- Repository: ${repo.name}
- Total commits: ${repo.commits.length}
- Total files: ${repo.files.size}
- Contributors: ${repo.contributors.size}
- Timespan: ${repo.timespan}

Top contributors: ${ownership.topOwners.slice(0, 3).map(o => `${o.name} (${(o.ownership * 100).toFixed(0)}% ownership)`).join(', ')}

Complexity trend: ${complexity.trend.direction} (${complexity.trend.percentChange}% change)
Most complex file: ${complexity.trend.mostComplexFile}

Bug hotspots: ${bugs.hotspots.slice(0, 3).map(h => `${h.file} (${h.bugFixCommits} fixes)`).join(', ')}
Bug fix percentage: ${(bugs.bugFixPercent * 100).toFixed(1)}% of all commits

Dead code suspects: ${deadCode.suspects.length} files idle 12+ months
Most critical file: ${dependencies.criticalFiles[0]?.file || 'N/A'} (${dependencies.criticalFiles[0]?.dependents || 0} dependents)

Write a concise codebase briefing for a developer joining this project.`;
  }

  // ─── Template sections ──────────────────────────────────────────

  buildOverview(repo, topLang) {
    const commitRate = this.calculateCommitRate(repo.commits);
    return `📋 **Repository Overview**: ${repo.name} is a ${topLang} project with ${repo.commits.length} commits from ${repo.contributors.size} contributors over ${repo.timespan}. The project averages ${commitRate} commits per month.`;
  }

  buildOwnershipInsight(ownership) {
    const top = ownership.topOwners[0];
    if (!top) return '👥 **Ownership**: No contributor data available.';

    const concentration = ownership.topOwners.slice(0, 3).reduce((s, o) => s + o.ownership, 0) * 100;
    const busFactorRisk = ownership.busFactor.length;
    const parts = [`👥 **Ownership**: ${top.name} leads with ${(top.ownership * 100).toFixed(0)}% of all code changes (${top.commits} commits).`];

    if (concentration > 70) {
      parts.push(`⚠️ Top 3 contributors own ${concentration.toFixed(0)}% of code — high concentration risk.`);
    }

    if (busFactorRisk > 0) {
      parts.push(`${busFactorRisk} files have bus factor = 1 (single owner).`);
    }

    return parts.join(' ');
  }

  buildComplexityInsight(complexity) {
    const { trend } = complexity;
    const direction = trend.direction === 'increasing' ? '📈 increasing' :
                     trend.direction === 'decreasing' ? '📉 decreasing' : '→ stable';
    return `📈 **Complexity**: Trend is ${direction} (${trend.percentChange}% change). Most complex file: ${trend.mostComplexFile}. Average churn: ${complexity.stats.avgChurn} commits per file.`;
  }

  buildBugInsight(bugs) {
    if (bugs.hotspots.length === 0) {
      return '🐛 **Bug History**: No bug-fix commits detected (or insufficient commit message patterns).';
    }

    const top = bugs.hotspots[0];
    const parts = [`🐛 **Bug History**: ${bugs.totalBugFixes} bug-fix commits (${(bugs.bugFixPercent * 100).toFixed(1)}% of all commits).`];
    parts.push(`Top hotspot: ${top.file} (${top.bugFixCommits} fixes, ${top.dominantBugType} type).`);

    if (bugs.stats.byType.security) {
      parts.push(`🔒 ${bugs.stats.byType.security} security-related commits detected.`);
    }

    return parts.join(' ');
  }

  buildDeadCodeInsight(deadCode) {
    return `💀 **Dead Code**: ${deadCode.suspects.length} files potentially unused (idle 12+ months). ${deadCode.stats.highConfidence} high-confidence dead code candidates totaling ~${deadCode.stats.totalDeadLines} lines.`;
  }

  buildDependencyInsight(dependencies) {
    const top = dependencies.criticalFiles[0];
    if (!top) return '🔗 **Dependencies**: No coupling data available.';

    return `🔗 **Critical Files**: ${top.file} has the highest risk score (${top.riskScore.toFixed(0)}) with ${top.dependents} co-change dependents. ${dependencies.couplingClusters.length} tightly-coupled clusters detected.`;
  }

  buildRecommendations(data) {
    const recs = [];

    if (data.ownership.busFactor.length > 5) {
      recs.push('• Improve knowledge sharing — many files have single owners');
    }
    if (data.complexity.trend.direction === 'increasing') {
      recs.push('• Address rising complexity before it impacts velocity');
    }
    if (data.bugs.hotspots.length > 0 && data.bugs.hotspots[0].riskLevel === 'critical') {
      recs.push(`• Add tests for ${data.bugs.hotspots[0].file} — highest bug density`);
    }
    if (data.deadCode.suspects.length > 10) {
      recs.push('• Clean up dead code to reduce maintenance burden');
    }
    if (data.dependencies.criticalFiles.length > 0 && data.dependencies.criticalFiles[0].riskScore > 50) {
      recs.push('• Consider decoupling critical files to reduce blast radius');
    }

    return recs.length > 0
      ? `💡 **Recommendations**:\n${recs.join('\n')}`
      : '💡 **Recommendations**: Codebase looks healthy! Keep up the good practices.';
  }

  detectPrimaryLanguage(files) {
    const extMap = new Map();
    for (const [filePath] of files) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext) {
        extMap.set(ext, (extMap.get(ext) || 0) + 1);
      }
    }

    const langMap = {
      'js': 'JavaScript', 'jsx': 'JavaScript (React)', 'ts': 'TypeScript',
      'tsx': 'TypeScript (React)', 'py': 'Python', 'go': 'Go',
      'rs': 'Rust', 'java': 'Java', 'rb': 'Ruby', 'php': 'PHP',
      'cs': 'C#', 'cpp': 'C++', 'c': 'C', 'swift': 'Swift',
      'kt': 'Kotlin', 'dart': 'Dart', 'vue': 'Vue.js', 'svelte': 'Svelte'
    };

    let topExt = 'unknown';
    let topCount = 0;
    for (const [ext, count] of extMap) {
      if (count > topCount) {
        topCount = count;
        topExt = ext;
      }
    }

    return langMap[topExt] || topExt;
  }

  calculateCommitRate(commits) {
    if (commits.length < 2) return 'N/A';
    const dates = commits.map(c => new Date(c.date)).filter(d => !isNaN(d));
    if (dates.length < 2) return 'N/A';
    const days = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
    const months = Math.max(days / 30, 1);
    return (commits.length / months).toFixed(1);
  }
}

module.exports = { AIBriefing };
