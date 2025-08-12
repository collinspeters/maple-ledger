import puppeteer from 'puppeteer';
import fs from 'fs';

class ReportsAnalysisAgent {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'http://localhost:5000';
    this.issues = [];
    this.screenshots = [];
  }

  async initialize() {
    console.log('🚀 Initializing Reports Analysis Agent...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1200, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Enable request/response logging
    this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    this.page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  }

  async login() {
    console.log('🔐 Logging in...');
    
    await this.page.goto(`${this.baseUrl}/login`);
    await this.page.waitForSelector('input[type="email"]');
    
    await this.page.type('input[type="email"]', 'demo@bookkeepai.com');
    await this.page.type('input[type="password"]', 'password123');
    await this.page.click('button[type="submit"]');
    
    await this.page.waitForNavigation();
    console.log('✅ Login successful');
  }

  async analyzeReportsPage() {
    console.log('📊 Analyzing Reports Page...');
    
    await this.page.goto(`${this.baseUrl}/reports`);
    await this.page.waitForSelector('[data-testid="reports"], .reports, h1', { timeout: 10000 });
    
    // Take initial screenshot
    const screenshot1 = `reports-analysis-${Date.now()}-overview.png`;
    await this.page.screenshot({ path: screenshot1, fullPage: true });
    this.screenshots.push(screenshot1);
    
    // Check for NaN values
    const nanElements = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => el.textContent && el.textContent.includes('NaN'))
        .map(el => ({
          tag: el.tagName,
          text: el.textContent.trim(),
          className: el.className,
          id: el.id
        }));
    });
    
    if (nanElements.length > 0) {
      this.issues.push({
        type: 'NaN Values Found',
        elements: nanElements,
        severity: 'high'
      });
    }
    
    // Test each report tab
    const reportTabs = ['profit-loss', 'balance-sheet', 'tax-summary', 'trial-balance', 'general-ledger'];
    
    for (const tab of reportTabs) {
      console.log(`📋 Testing ${tab} report...`);
      
      try {
        // Click on the tab
        await this.page.click(`[value="${tab}"]`);
        await this.page.waitForTimeout(2000); // Wait for data to load
        
        // Take screenshot of this report
        const screenshot = `reports-analysis-${Date.now()}-${tab}.png`;
        await this.page.screenshot({ path: screenshot, fullPage: true });
        this.screenshots.push(screenshot);
        
        // Check for errors in this tab
        const tabErrors = await this.page.evaluate((tabName) => {
          const errors = [];
          
          // Check for NaN values
          const nanElements = Array.from(document.querySelectorAll('*'))
            .filter(el => el.textContent && el.textContent.includes('NaN'));
          
          if (nanElements.length > 0) {
            errors.push(`NaN values found in ${tabName}: ${nanElements.length} elements`);
          }
          
          // Check for empty tables or missing data
          const tables = document.querySelectorAll('table');
          tables.forEach((table, i) => {
            const rows = table.querySelectorAll('tbody tr');
            if (rows.length === 0) {
              errors.push(`Empty table found in ${tabName} (table ${i + 1})`);
            }
          });
          
          // Check for loading states stuck
          const loadingElements = Array.from(document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="animate-pulse"]'));
          if (loadingElements.length > 0) {
            errors.push(`Stuck loading states in ${tabName}: ${loadingElements.length} elements`);
          }
          
          return errors;
        }, tab);
        
        if (tabErrors.length > 0) {
          this.issues.push({
            type: `${tab} Report Issues`,
            errors: tabErrors,
            severity: 'medium'
          });
        }
        
      } catch (error) {
        this.issues.push({
          type: `${tab} Tab Error`,
          error: error.message,
          severity: 'high'
        });
      }
    }
    
    // Test dropdown functionality
    console.log('🔽 Testing dropdown selections...');
    try {
      // Click on date range dropdown
      await this.page.click('[role="combobox"]');
      await this.page.waitForSelector('[role="option"]');
      
      // Take screenshot of dropdown
      const dropdownScreenshot = `reports-analysis-${Date.now()}-dropdown.png`;
      await this.page.screenshot({ path: dropdownScreenshot, fullPage: true });
      this.screenshots.push(dropdownScreenshot);
      
      // Check if selected options are properly styled
      const dropdownStyling = await this.page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        return options.map(option => ({
          text: option.textContent,
          classes: option.className,
          hasBlueBackground: option.classList.contains('bg-blue-600') || 
                           getComputedStyle(option).backgroundColor.includes('blue'),
          isSelected: option.getAttribute('data-state') === 'checked'
        }));
      });
      
      this.issues.push({
        type: 'Dropdown Styling Analysis',
        styling: dropdownStyling,
        severity: 'low'
      });
      
      // Select a different option to test
      await this.page.click('[data-value="thisMonth"]');
      await this.page.waitForTimeout(1000);
      
    } catch (error) {
      this.issues.push({
        type: 'Dropdown Test Error',
        error: error.message,
        severity: 'medium'
      });
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: this.issues.filter(i => i.severity === 'high').length,
        screenshots: this.screenshots.length
      },
      issues: this.issues,
      screenshots: this.screenshots,
      recommendations: []
    };
    
    // Generate recommendations based on issues found
    if (this.issues.some(i => i.type.includes('NaN'))) {
      report.recommendations.push({
        priority: 'high',
        issue: 'NaN Values in Reports',
        solution: 'Fix calculation logic in balance sheet and tax summary calculations',
        files: ['server/services/reports.ts']
      });
    }
    
    if (this.issues.some(i => i.type.includes('Dropdown'))) {
      report.recommendations.push({
        priority: 'medium',
        issue: 'Dropdown Styling',
        solution: 'Verify blue highlighting for selected options is working',
        files: ['client/src/components/ui/select.tsx']
      });
    }
    
    const reportFile = `reports-analysis-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log('\n📊 REPORTS ANALYSIS COMPLETE');
    console.log('=' .repeat(50));
    console.log(`✅ Total Issues Found: ${report.summary.totalIssues}`);
    console.log(`🔥 Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`📸 Screenshots Taken: ${report.summary.screenshots}`);
    console.log(`📄 Report Saved: ${reportFile}`);
    
    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the analysis
async function runReportsAnalysis() {
  const agent = new ReportsAnalysisAgent();
  
  try {
    await agent.initialize();
    await agent.login();
    await agent.analyzeReportsPage();
    const report = await agent.generateReport();
    
    console.log('\n🎯 KEY FINDINGS:');
    report.issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.type} (${issue.severity})`);
    });
    
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.issue}: ${rec.solution}`);
    });
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await agent.cleanup();
  }
}

runReportsAnalysis();