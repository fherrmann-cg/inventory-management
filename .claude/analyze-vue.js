#!/usr/bin/env node

/**
 * Vue Component Performance Analyzer
 * Analyzes Vue 3 components for performance optimization opportunities
 * Usage: node analyze-vue.js [directory]
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const issues = {
  INFO: 'ℹ',
  WARN: '⚠',
  ERROR: '✗',
  SUCCESS: '✓',
};

function log(type, message, color = 'blue') {
  const icon = issues[type] || type;
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

function getVueFiles(directory) {
  const vueFiles = [];

  function walkDir(dir) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.')) {
          walkDir(fullPath);
        } else if (file.endsWith('.vue')) {
          vueFiles.push(fullPath);
        }
      });
    } catch (err) {
      // Ignore read errors
    }
  }

  walkDir(directory);
  return vueFiles;
}

function analyzeComponent(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const findings = {
    path: filePath,
    issues: [],
    warnings: [],
    recommendations: [],
  };

  // Extract script section
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  const scriptContent = scriptMatch ? scriptMatch[1] : '';

  // Extract template section
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  const templateContent = templateMatch ? templateMatch[1] : '';

  // 1. Check for v-if that should be v-show
  const vIfMatches = templateContent.match(/v-if="[^"]*"/g) || [];
  const vShowMatches = templateContent.match(/v-show="[^"]*"/g) || [];

  if (vIfMatches.length > 0 && vShowMatches.length === 0) {
    findings.recommendations.push({
      type: 'PERF',
      message: `Uses ${vIfMatches.length} v-if directives - consider v-show for frequently toggled elements`,
      severity: 'warning',
    });
  }

  // 2. Check for methods that might be computed properties
  const methodMatches = scriptContent.match(/const\s+(\w+)\s*=\s*\(\s*\)\s*=>\s*\{/g) || [];
  const computedMatches = scriptContent.match(/computed\(/g) || [];

  if (methodMatches.length > computedMatches.length) {
    findings.recommendations.push({
      type: 'PERF',
      message: `Has ${methodMatches.length} methods but only ${computedMatches.length} computed properties - consider computed for derived data`,
      severity: 'info',
    });
  }

  // 3. Check for missing v-for keys
  const vForNoKeyPattern = /v-for="[^"]*"\s+(?!:key)/g;
  const vForNoKeyMatches = templateContent.match(vForNoKeyPattern) || [];

  if (vForNoKeyMatches.length > 0) {
    findings.issues.push({
      type: 'CRITICAL',
      message: `Found ${vForNoKeyMatches.length} v-for loops without :key - can cause rendering issues`,
      severity: 'error',
    });
  }

  // 4. Check for prop destructuring (reactivity issue)
  const propDestructPattern = /const\s*\{\s*[^}]+\s*\}\s*=\s*props/;
  if (propDestructPattern.test(scriptContent)) {
    findings.warnings.push({
      type: 'REACTIVITY',
      message: 'Props are destructured - this breaks reactivity. Use toRefs() or access props directly',
      severity: 'warning',
    });
  }

  // 5. Check for onMounted without cleanup
  const onMountedMatches = scriptContent.match(/onMounted\(/g) || [];
  const onUnmountedMatches = scriptContent.match(/onUnmounted\(/g) || [];

  if (onMountedMatches.length > onUnmountedMatches.length && onMountedMatches.length > 0) {
    findings.recommendations.push({
      type: 'MEMORY',
      message: 'Has lifecycle hooks but may be missing cleanup - ensure onMounted subscriptions are cleaned up',
      severity: 'info',
    });
  }

  // 6. Check for large template (potential for component extraction)
  const templateLines = templateContent.split('\n').length;
  if (templateLines > 100) {
    findings.recommendations.push({
      type: 'STRUCTURE',
      message: `Template has ${templateLines} lines - consider extracting into smaller components`,
      severity: 'info',
    });
  }

  // 7. Check for large script (potential for composable extraction)
  const scriptLines = scriptContent.split('\n').length;
  if (scriptLines > 150) {
    findings.recommendations.push({
      type: 'STRUCTURE',
      message: `Script has ${scriptLines} lines - consider extracting logic into a composable`,
      severity: 'info',
    });
  }

  // 8. Check for watch without cleanup
  const watchMatches = scriptContent.match(/watch\(/g) || [];
  const unwatchPatterns = scriptContent.match(/const\s+unwatch|return\s+{[^}]*unwatch/g) || [];

  if (watchMatches.length > 0 && unwatchPatterns.length === 0) {
    findings.recommendations.push({
      type: 'MEMORY',
      message: `Has ${watchMatches.length} watch() calls - ensure to unwatch or stop() them`,
      severity: 'info',
    });
  }

  // 9. Check for async operations in computed
  if (/computed\([^)]*async/.test(scriptContent)) {
    findings.warnings.push({
      type: 'PERF',
      message: 'Computed property is async - computed properties should be synchronous',
      severity: 'error',
    });
  }

  // 10. Check for expensive DOM queries
  const domQueryMatches = scriptContent.match(/document\.(querySelector|getElementById|getElementsBy)/g) || [];
  if (domQueryMatches.length > 0) {
    findings.recommendations.push({
      type: 'PERF',
      message: `Uses ${domQueryMatches.length} DOM queries directly - prefer Vue refs or template refs`,
      severity: 'warning',
    });
  }

  return findings;
}

function formatPath(filePath) {
  return filePath.replace(/\\/g, '/').split('/').slice(-2).join('/');
}

function main() {
  const baseDir = process.argv[2] || 'client/src';
  const fullPath = path.join(process.cwd(), baseDir);

  console.log('\n');
  log('INFO', '🔍 Vue Component Performance Analyzer', 'cyan');
  log('INFO', `Scanning: ${baseDir}`, 'gray');
  console.log();

  const vueFiles = getVueFiles(fullPath);

  if (vueFiles.length === 0) {
    log('WARN', 'No Vue files found', 'yellow');
    process.exit(0);
  }

  let totalIssues = 0;
  let totalWarnings = 0;
  let totalRecommendations = 0;

  const allFindings = vueFiles.map(file => analyzeComponent(file)).sort((a, b) => {
    // Sort by severity: errors first, then warnings, then info
    const severityOrder = { error: 0, warning: 1, info: 2 };
    const aSeverity = Math.min(...a.issues.map(i => severityOrder[i.severity] ?? 2));
    const bSeverity = Math.min(...b.issues.map(i => severityOrder[i.severity] ?? 2));
    return aSeverity - bSeverity;
  });

  allFindings.forEach(findings => {
    if (findings.issues.length + findings.warnings.length + findings.recommendations.length === 0) {
      return; // Skip components with no findings
    }

    console.log(`${colors.blue}${formatPath(findings.path)}${colors.reset}`);

    findings.issues.forEach(issue => {
      log('ERROR', `  ${issue.message}`, 'red');
      totalIssues++;
    });

    findings.warnings.forEach(warning => {
      log('WARN', `  ${warning.message}`, 'yellow');
      totalWarnings++;
    });

    findings.recommendations.forEach(rec => {
      log('INFO', `  ${rec.message}`, 'gray');
      totalRecommendations++;
    });

    console.log();
  });

  // Summary
  console.log(`${colors.gray}─────────────────────────────────────${colors.reset}`);
  log('INFO', `Analyzed ${vueFiles.length} components`, 'gray');

  if (totalIssues > 0) {
    log('ERROR', `${totalIssues} critical issues`, 'red');
  } else {
    log('SUCCESS', 'No critical issues found', 'green');
  }

  if (totalWarnings > 0) {
    log('WARN', `${totalWarnings} warnings`, 'yellow');
  }

  if (totalRecommendations > 0) {
    log('INFO', `${totalRecommendations} optimization recommendations`, 'blue');
  }

  console.log();

  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
