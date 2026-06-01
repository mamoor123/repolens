/**
 * Utility functions for formatting output
 */

function formatNumber(n) {
  if (n === undefined || n === null) return '0';
  return n.toLocaleString('en-US');
}

function formatPercent(n) {
  if (n === undefined || n === null) return '0%';
  return (n * 100).toFixed(1) + '%';
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

module.exports = { formatNumber, formatPercent, formatDuration, formatBytes };
