import puppeteer from 'puppeteer';
import fs from 'fs';

class VisualDebugSystem {
  constructor() {
    this.browser = null;
    this.page = null;
    this.screenshots = [];
    this.issues = [];
  }

  async initialize() {
    console.log('🔍 Initializing Visual Debug System...');
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    this.page = await this.browser.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        this.issues.push({
          type: 'console_error',
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
      console.log(`[BROWSER ${type.toUpperCase()}]`, msg.text());
    });
    
    this.page.on('pageerror', error => {
      this.issues.push({
        type: 'page_error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.log(`[PAGE ERROR]`, error.message);
    });

    console.log('✅ Visual Debug System ready');
  }

  async login() {
    console.log('🔐 Logging in visually...');
    await this.page.goto('http://localhost:5000/');
    
    // Wait for login form and fill it like a human would
    await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await this.page.type('input[type="email"]', 'demo@bookkeepai.com');
    await this.page.type('input[type="password"]', 'password123');
    
    // Take screenshot before clicking
    await this.takeScreenshot('before_login');
    
    await this.page.click('button[type="submit"]');
    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    await this.takeScreenshot('after_login');
    console.log('✅ Login completed');
  }

  async analyzeTransactionsPage() {
    console.log('📊 Analyzing Transactions Page Visually...');
    
    await this.page.goto('http://localhost:5000/transactions');
    await this.page.waitForTimeout(3000); // Let everything load
    
    await this.takeScreenshot('transactions_initial_load');
    
    // Check what's actually visible
    const pageAnalysis = await this.page.evaluate(() => {
      const analysis = {
        url: window.location.href,
        title: document.title,
        hasTransactionTable: !!document.querySelector('table, [role="table"], .transaction-row'),
        hasFilters: !!document.querySelector('select, .filter, [data-testid*="filter"]'),
        visibleTransactions: document.querySelectorAll('.transaction-row, tr').length,
        selectElements: Array.from(document.querySelectorAll('select')).map(select => ({
          id: select.id,
          hasEmptyOption: Array.from(select.options).some(opt => opt.value === ''),
          optionCount: select.options.length
        })),
        errors: [],
        bodyText: document.body.innerText.substring(0, 500)
      };

      // Check for empty Select items in React components
      const selectItems = document.querySelectorAll('[role="option"]');
      selectItems.forEach((item, index) => {
        const value = item.getAttribute('data-value') || item.value;
        if (value === '' || value === null) {
          analysis.errors.push(`SelectItem ${index} has empty value`);
        }
      });

      return analysis;
    });

    console.log('📋 Visual Analysis Results:', pageAnalysis);
    this.issues.push({
      type: 'page_analysis',
      page: 'transactions',
      analysis: pageAnalysis,
      timestamp: new Date().toISOString()
    });

    // Try scrolling to see if more content loads
    console.log('📜 Scrolling to load content...');
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.page.waitForTimeout(2000);
    await this.takeScreenshot('transactions_after_scroll');

    // Try clicking filters to see what happens
    try {
      console.log('🔍 Testing filter interactions...');
      const filterButton = await this.page.$('button:has-text("Filter"), [data-testid*="filter"], .filter-toggle');
      if (filterButton) {
        await filterButton.click();
        await this.page.waitForTimeout(1000);
        await this.takeScreenshot('filters_opened');
      }
    } catch (error) {
      console.log('⚠️ Could not interact with filters:', error.message);
    }

    return pageAnalysis;
  }

  async analyzeDashboard() {
    console.log('🏠 Analyzing Dashboard Visually...');
    
    await this.page.goto('http://localhost:5000/dashboard');
    await this.page.waitForTimeout(3000);
    
    await this.takeScreenshot('dashboard_loaded');
    
    const dashboardAnalysis = await this.page.evaluate(() => {
      return {
        url: window.location.href,
        hasQuickActions: !!document.querySelector('.quick-actions, [data-testid*="quick"]'),
        hasFinancialSummary: !!document.querySelector('.financial, .summary, .revenue, .expense'),
        hasCharts: !!document.querySelector('svg, canvas, .chart'),
        visibleCards: document.querySelectorAll('.card, [role="card"]').length,
        visibleButtons: document.querySelectorAll('button').length,
        bodyText: document.body.innerText.substring(0, 500)
      };
    });

    console.log('🏠 Dashboard Analysis:', dashboardAnalysis);
    this.issues.push({
      type: 'page_analysis',
      page: 'dashboard',
      analysis: dashboardAnalysis,
      timestamp: new Date().toISOString()
    });

    return dashboardAnalysis;
  }

  async takeScreenshot(name) {
    const filename = `visual-debug-${name}-${Date.now()}.png`;
    await this.page.screenshot({ 
      path: filename, 
      fullPage: true 
    });
    this.screenshots.push(filename);
    console.log(`📸 Screenshot saved: ${filename}`);
    return filename;
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      screenshots: this.screenshots,
      issues: this.issues,
      summary: {
        totalIssues: this.issues.length,
        errorTypes: [...new Set(this.issues.map(i => i.type))],
        screenshotCount: this.screenshots.length
      }
    };

    const reportFile = `visual-debug-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log('📊 Visual Debug Report Generated:');
    console.log(`   📄 Report: ${reportFile}`);
    console.log(`   📸 Screenshots: ${this.screenshots.length}`);
    console.log(`   🚨 Issues Found: ${this.issues.length}`);
    
    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the visual debug system
async function runVisualDebug() {
  const debugger = new VisualDebugSystem();
  
  try {
    await debugger.initialize();
    await debugger.login();
    
    const dashboardAnalysis = await debugger.analyzeDashboard();
    const transactionsAnalysis = await debugger.analyzeTransactionsPage();
    
    const report = await debugger.generateReport();
    
    // Print actionable recommendations
    console.log('\n🔧 ACTIONABLE RECOMMENDATIONS:');
    
    if (transactionsAnalysis.visibleTransactions === 0) {
      console.log('❌ CRITICAL: No transactions visible - check data loading');
    }
    
    if (transactionsAnalysis.errors.length > 0) {
      console.log('❌ CRITICAL: Select component errors found');
      transactionsAnalysis.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (!dashboardAnalysis.hasFinancialSummary) {
      console.log('❌ CRITICAL: Dashboard missing financial summary');
    }
    
    return report;
    
  } catch (error) {
    console.error('💥 Visual Debug Failed:', error);
  } finally {
    await debugger.cleanup();
  }
}

runVisualDebug().catch(console.error);