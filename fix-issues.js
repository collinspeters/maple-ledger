const InteractiveWebAgent = require('./interactive-agent');

class IssueFixerAgent extends InteractiveWebAgent {
  constructor() {
    super();
    this.issuesFound = [];
    this.fixesApplied = [];
  }

  async analyzeAndFix() {
    console.log('🔍 Starting comprehensive issue analysis and fixing...');
    
    await this.init();
    await this.performLogin();
    
    // Analyze each page systematically
    const pages = [
      { url: '/dashboard', name: 'Dashboard' },
      { url: '/transactions', name: 'Transactions' },
      { url: '/banking', name: 'Banking' },
      { url: '/ai-assistant', name: 'AI Assistant' },
      { url: '/receipts', name: 'Receipts' }
    ];
    
    for (const page of pages) {
      await this.analyzePage(page);
    }
    
    // Generate fix recommendations
    await this.generateFixRecommendations();
    
    await this.saveReport();
    await this.close();
  }

  async analyzePage(pageInfo) {
    console.log(`\n🔍 Analyzing ${pageInfo.name}...`);
    await this.navigateTo(`http://localhost:5000${pageInfo.url}`);
    
    // Check for errors in console
    const consoleErrors = await this.page.evaluate(() => {
      const errors = [];
      // This would capture any JavaScript errors on the page
      return errors;
    });
    
    // Check for broken interactive elements
    const brokenElements = await this.findBrokenElements();
    
    // Check for missing data-testid attributes
    const missingTestIds = await this.findMissingTestIds();
    
    // Check for accessibility issues
    const a11yIssues = await this.findAccessibilityIssues();
    
    this.issuesFound.push({
      page: pageInfo.name,
      url: pageInfo.url,
      brokenElements,
      missingTestIds,
      a11yIssues,
      consoleErrors
    });
    
    console.log(`  Found ${brokenElements.length} broken elements`);
    console.log(`  Found ${missingTestIds.length} missing test IDs`);
    console.log(`  Found ${a11yIssues.length} accessibility issues`);
  }

  async findBrokenElements() {
    return await this.page.evaluate(() => {
      const issues = [];
      
      // Check buttons without proper handlers
      document.querySelectorAll('button').forEach((btn, index) => {
        if (btn.offsetParent !== null) { // visible
          const hasHandler = btn.onclick || 
                           btn.getAttribute('data-testid') || 
                           btn.closest('form') ||
                           btn.type === 'submit';
          
          if (!hasHandler && btn.textContent.trim()) {
            issues.push({
              type: 'button',
              text: btn.textContent.trim(),
              issue: 'No click handler',
              selector: `button:nth-child(${index + 1})`
            });
          }
        }
      });
      
      // Check links without href
      document.querySelectorAll('a').forEach((link, index) => {
        if (link.offsetParent !== null && !link.href.includes('javascript:void')) {
          if (!link.href || link.href === window.location.href + '#') {
            issues.push({
              type: 'link',
              text: link.textContent.trim(),
              issue: 'Missing or invalid href',
              selector: `a:nth-child(${index + 1})`
            });
          }
        }
      });
      
      // Check forms without submit handlers
      document.querySelectorAll('form').forEach((form, index) => {
        if (!form.onsubmit && !form.action) {
          issues.push({
            type: 'form',
            issue: 'No submit handler or action',
            selector: `form:nth-child(${index + 1})`
          });
        }
      });
      
      return issues;
    });
  }

  async findMissingTestIds() {
    return await this.page.evaluate(() => {
      const issues = [];
      
      // Important interactive elements that should have test IDs
      const importantSelectors = [
        'button',
        'input[type="submit"]',
        'input[type="button"]',
        'a[role="button"]',
        '.upload',
        '.filter',
        '.add-button',
        '.connect-button'
      ];
      
      importantSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
          if (el.offsetParent !== null && !el.getAttribute('data-testid')) {
            issues.push({
              selector: `${selector}:nth-child(${index + 1})`,
              text: el.textContent.trim(),
              recommendation: `Add data-testid attribute`
            });
          }
        });
      });
      
      return issues;
    });
  }

  async findAccessibilityIssues() {
    return await this.page.evaluate(() => {
      const issues = [];
      
      // Check for images without alt text
      document.querySelectorAll('img').forEach((img, index) => {
        if (!img.alt) {
          issues.push({
            type: 'img',
            issue: 'Missing alt text',
            selector: `img:nth-child(${index + 1})`
          });
        }
      });
      
      // Check for buttons without accessible names
      document.querySelectorAll('button').forEach((btn, index) => {
        const hasAccessibleName = btn.textContent.trim() || 
                                btn.getAttribute('aria-label') || 
                                btn.getAttribute('title');
        if (!hasAccessibleName) {
          issues.push({
            type: 'button',
            issue: 'Missing accessible name',
            selector: `button:nth-child(${index + 1})`
          });
        }
      });
      
      // Check for form inputs without labels
      document.querySelectorAll('input').forEach((input, index) => {
        if (input.type !== 'hidden') {
          const hasLabel = input.labels?.length > 0 || 
                         input.getAttribute('aria-label') || 
                         input.getAttribute('placeholder');
          if (!hasLabel) {
            issues.push({
              type: 'input',
              issue: 'Missing label',
              selector: `input:nth-child(${index + 1})`
            });
          }
        }
      });
      
      return issues;
    });
  }

  async generateFixRecommendations() {
    console.log('\n🔧 Generating fix recommendations...');
    
    const recommendations = [];
    
    this.issuesFound.forEach(pageIssues => {
      pageIssues.brokenElements.forEach(issue => {
        recommendations.push({
          page: pageIssues.page,
          priority: 'HIGH',
          type: 'Functionality',
          issue: `${issue.type} "${issue.text}" has ${issue.issue}`,
          fix: `Add proper event handler or data-testid to ${issue.selector}`,
          code: this.generateFixCode(issue)
        });
      });
      
      pageIssues.missingTestIds.forEach(issue => {
        recommendations.push({
          page: pageIssues.page,
          priority: 'MEDIUM',
          type: 'Testing',
          issue: `Element missing test ID: ${issue.text}`,
          fix: `Add data-testid="${this.generateTestId(issue.text)}"`,
          code: `<element data-testid="${this.generateTestId(issue.text)}">`
        });
      });
      
      pageIssues.a11yIssues.forEach(issue => {
        recommendations.push({
          page: pageIssues.page,
          priority: 'MEDIUM',
          type: 'Accessibility',
          issue: `${issue.type} has ${issue.issue}`,
          fix: this.generateA11yFix(issue)
        });
      });
    });
    
    this.fixesApplied = recommendations;
    
    console.log(`📋 Generated ${recommendations.length} fix recommendations`);
    recommendations.forEach(rec => {
      console.log(`  ${rec.priority}: ${rec.issue}`);
    });
  }

  generateFixCode(issue) {
    switch (issue.type) {
      case 'button':
        return `<Button onClick={handleClick} data-testid="${this.generateTestId(issue.text)}">${issue.text}</Button>`;
      case 'link':
        return `<Link href="/target-page" data-testid="${this.generateTestId(issue.text)}">${issue.text}</Link>`;
      case 'form':
        return `<form onSubmit={handleSubmit} data-testid="form">`;
      default:
        return `Add appropriate handler for ${issue.type}`;
    }
  }

  generateTestId(text) {
    return text.toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, '-')
              .substring(0, 30);
  }

  generateA11yFix(issue) {
    switch (issue.issue) {
      case 'Missing alt text':
        return 'Add descriptive alt attribute to image';
      case 'Missing accessible name':
        return 'Add aria-label or visible text to button';
      case 'Missing label':
        return 'Add label element or aria-label to input';
      default:
        return 'Follow accessibility best practices';
    }
  }

  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        pagesAnalyzed: this.issuesFound.length,
        totalIssues: this.issuesFound.reduce((sum, page) => 
          sum + page.brokenElements.length + page.missingTestIds.length + page.a11yIssues.length, 0),
        fixesRecommended: this.fixesApplied.length
      },
      detailedAnalysis: this.issuesFound,
      recommendations: this.fixesApplied,
      actionLog: this.actionLog
    };
    
    await require('fs').promises.writeFile(
      'issue-analysis-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📊 Issue Analysis Report Saved');
    console.log(`Pages Analyzed: ${report.summary.pagesAnalyzed}`);
    console.log(`Total Issues: ${report.summary.totalIssues}`);
    console.log(`Fixes Recommended: ${report.summary.fixesRecommended}`);
  }
}

// Run the issue fixer
async function runIssueFixer() {
  const fixer = new IssueFixerAgent();
  await fixer.analyzeAndFix();
}

if (require.main === module) {
  runIssueFixer();
}

module.exports = IssueFixerAgent;