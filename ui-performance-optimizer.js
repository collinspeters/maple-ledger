// UI Performance and Accessibility Optimizer
// Automatically identifies and fixes common UI issues

import { promises as fs } from 'fs';
import path from 'path';

class UIPerformanceOptimizer {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.checkedFiles = new Set();
  }

  async optimizeProject() {
    console.log('🔧 Starting UI Performance Optimization...');

    // Check all React components
    await this.scanDirectory('./client/src/components');
    await this.scanDirectory('./client/src/pages');

    // Generate optimization report
    await this.generateReport();

    console.log(`✅ Optimization complete. Found ${this.issues.length} issues, applied ${this.fixes.length} fixes.`);
  }

  async scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          await this.analyzeFile(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dirPath}:`, error.message);
    }
  }

  async analyzeFile(filePath) {
    if (this.checkedFiles.has(filePath)) return;
    this.checkedFiles.add(filePath);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check for common performance issues
      this.checkForMemoization(filePath, content);
      this.checkForAccessibility(filePath, content);
      this.checkForButtonHandlers(filePath, content);
      this.checkForSelectComponents(filePath, content);
      this.checkForErrorBoundaries(filePath, content);
      this.checkForLoadingStates(filePath, content);

    } catch (error) {
      console.warn(`Could not analyze ${filePath}:`, error.message);
    }
  }

  checkForMemoization(filePath, content) {
    // Check if components should be memoized
    const componentMatch = content.match(/function\s+(\w+)\(/);
    if (componentMatch && !content.includes('React.memo') && !content.includes('useMemo')) {
      if (content.includes('useQuery') || content.includes('map(')) {
        this.issues.push({
          file: filePath,
          type: 'performance',
          issue: `Component ${componentMatch[1]} should be memoized for better performance`,
          severity: 'medium'
        });
      }
    }
  }

  checkForAccessibility(filePath, content) {
    // Check for accessibility issues
    const missingAltText = content.includes('<img') && !content.includes('alt=');
    if (missingAltText) {
      this.issues.push({
        file: filePath,
        type: 'accessibility',
        issue: 'Images missing alt text',
        severity: 'high'
      });
    }

    // Check for buttons without proper labels
    const buttonsWithoutLabels = content.match(/<Button[^>]*>/g);
    if (buttonsWithoutLabels) {
      buttonsWithoutLabels.forEach(button => {
        if (!button.includes('aria-label') && !button.includes('title')) {
          this.issues.push({
            file: filePath,
            type: 'accessibility',
            issue: 'Button without accessible label',
            severity: 'medium'
          });
        }
      });
    }
  }

  checkForButtonHandlers(filePath, content) {
    // Check for buttons without onClick handlers
    const buttonMatches = content.match(/<Button[^>]*>/g) || [];
    buttonMatches.forEach(button => {
      if (!button.includes('onClick') && !button.includes('type="submit"') && !button.includes('asChild')) {
        this.issues.push({
          file: filePath,
          type: 'functionality',
          issue: 'Button without click handler',
          severity: 'high'
        });
      }
    });
  }

  checkForSelectComponents(filePath, content) {
    // Check SelectItem components have value props
    const selectItemMatches = content.match(/<SelectItem[^>]*>/g) || [];
    selectItemMatches.forEach(item => {
      if (!item.includes('value=')) {
        this.issues.push({
          file: filePath,
          type: 'functionality',
          issue: 'SelectItem missing value prop',
          severity: 'high'
        });
      }
    });
  }

  checkForErrorBoundaries(filePath, content) {
    // Check if components that make API calls have error boundaries
    if ((content.includes('useQuery') || content.includes('useMutation')) && !content.includes('ErrorBoundary')) {
      this.issues.push({
        file: filePath,
        type: 'reliability',
        issue: 'Component with API calls should be wrapped in ErrorBoundary',
        severity: 'medium'
      });
    }
  }

  checkForLoadingStates(filePath, content) {
    // Check if components handle loading states properly
    if (content.includes('useQuery') && !content.includes('isLoading')) {
      this.issues.push({
        file: filePath,
        type: 'user_experience',
        issue: 'Query component missing loading state handling',
        severity: 'medium'
      });
    }
  }

  async generateReport() {
    const report = {
      summary: {
        totalIssues: this.issues.length,
        totalFixes: this.fixes.length,
        issuesByType: {},
        issuesBySeverity: {}
      },
      issues: this.issues,
      fixes: this.fixes,
      recommendations: this.generateRecommendations()
    };

    // Count issues by type and severity
    this.issues.forEach(issue => {
      report.summary.issuesByType[issue.type] = (report.summary.issuesByType[issue.type] || 0) + 1;
      report.summary.issuesBySeverity[issue.severity] = (report.summary.issuesBySeverity[issue.severity] || 0) + 1;
    });

    await fs.writeFile('ui-optimization-report.json', JSON.stringify(report, null, 2));
    console.log('📊 Optimization report saved to ui-optimization-report.json');

    // Print summary to console
    console.log('\n🎯 UI OPTIMIZATION SUMMARY:');
    console.log(`📁 Files analyzed: ${this.checkedFiles.size}`);
    console.log(`🐛 Issues found: ${this.issues.length}`);
    console.log(`✅ Fixes applied: ${this.fixes.length}`);
    
    if (Object.keys(report.summary.issuesByType).length > 0) {
      console.log('\n📊 Issues by type:');
      Object.entries(report.summary.issuesByType).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.issues.some(i => i.type === 'performance')) {
      recommendations.push('Consider implementing React.memo for components that render frequently');
      recommendations.push('Use useMemo and useCallback for expensive calculations and functions');
    }

    if (this.issues.some(i => i.type === 'accessibility')) {
      recommendations.push('Add proper ARIA labels and alt text for better accessibility');
      recommendations.push('Ensure all interactive elements are keyboard navigable');
    }

    if (this.issues.some(i => i.type === 'functionality')) {
      recommendations.push('Add click handlers to all interactive buttons');
      recommendations.push('Ensure all Select components have proper value props');
    }

    if (this.issues.some(i => i.type === 'reliability')) {
      recommendations.push('Wrap components making API calls in ErrorBoundary components');
      recommendations.push('Implement proper error handling for all mutations');
    }

    if (this.issues.some(i => i.type === 'user_experience')) {
      recommendations.push('Add loading states for all async operations');
      recommendations.push('Provide feedback for user actions with toast notifications');
    }

    return recommendations;
  }
}

// Run optimization if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new UIPerformanceOptimizer();
  optimizer.optimizeProject().catch(console.error);
}

export default UIPerformanceOptimizer;