import puppeteer from 'puppeteer';
import fs from 'fs/promises';

class BookkeepAISystemAnalyzer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.issues = [];
    this.screenshots = [];
    this.testResults = {};
  }

  async initialize() {
    console.log('🚀 Initializing BookkeepAI System Analyzer...');
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    this.page = await this.browser.newPage();
    
    // Comprehensive error monitoring
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error' || text.includes('ERROR') || text.includes('Failed')) {
        this.issues.push({
          type: 'console_error',
          severity: 'high',
          message: text,
          page: this.page.url(),
          timestamp: new Date().toISOString()
        });
        console.log(`❌ CONSOLE ERROR: ${text}`);
      } else if (text.includes('🔍 Filtering transactions')) {
        console.log(`🔍 FILTERING DEBUG: ${text}`);
      } else if (text.includes('🎯 After filtering')) {
        console.log(`🎯 FILTER RESULT: ${text}`);
      }
    });

    this.page.on('pageerror', error => {
      this.issues.push({
        type: 'page_error',
        severity: 'critical',
        message: error.message,
        stack: error.stack,
        page: this.page.url(),
        timestamp: new Date().toISOString()
      });
      console.log(`💥 PAGE ERROR: ${error.message}`);
    });

    this.page.on('requestfailed', request => {
      this.issues.push({
        type: 'network_error',
        severity: 'medium',
        message: `Failed to load: ${request.url()}`,
        page: this.page.url(),
        timestamp: new Date().toISOString()
      });
      console.log(`🌐 NETWORK FAILED: ${request.url()}`);
    });

    console.log('✅ System Analyzer initialized');
  }

  async takeScreenshot(description) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `system-analysis-${timestamp}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    this.screenshots.push({ filename, description, timestamp });
    console.log(`📸 Screenshot: ${description} -> ${filename}`);
    return filename;
  }

  async performLogin() {
    console.log('🔐 Testing authentication system...');
    
    try {
      await this.page.goto('http://localhost:5000/', { waitUntil: 'networkidle2' });
      await this.takeScreenshot('Login page loaded');

      // Check if login form exists
      const hasLoginForm = await this.page.$('input[type="email"]') !== null;
      if (!hasLoginForm) {
        this.issues.push({
          type: 'ui_missing',
          severity: 'critical',
          message: 'Login form not found on homepage',
          page: this.page.url()
        });
        return false;
      }

      // Perform login
      await this.page.type('input[type="email"]', 'demo@bookkeepai.com');
      await this.page.type('input[type="password"]', 'password123');
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation or error
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.takeScreenshot('After login attempt');

      // Check if login was successful
      const currentUrl = this.page.url();
      const isLoggedIn = currentUrl.includes('/dashboard') || 
                        await this.page.$('[data-testid="user-menu"]') !== null ||
                        await this.page.$('text=Dashboard') !== null;

      this.testResults.authentication = {
        success: isLoggedIn,
        currentUrl,
        hasLoginForm,
        timestamp: new Date().toISOString()
      };

      if (!isLoggedIn) {
        this.issues.push({
          type: 'auth_failure',
          severity: 'critical',
          message: 'Login failed - user not redirected or authenticated',
          page: currentUrl
        });
      }

      console.log(`🔐 Authentication: ${isLoggedIn ? 'SUCCESS' : 'FAILED'}`);
      return isLoggedIn;

    } catch (error) {
      this.issues.push({
        type: 'auth_error',
        severity: 'critical',
        message: `Login process failed: ${error.message}`,
        stack: error.stack
      });
      console.log(`💥 Login error: ${error.message}`);
      return false;
    }
  }

  async analyzeTransactionsPage() {
    console.log('📊 Analyzing Transactions Page...');
    
    try {
      await this.page.goto('http://localhost:5000/transactions', { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for data loading
      await this.takeScreenshot('Transactions page loaded');

      const analysis = await this.page.evaluate(() => {
        const result = {
          url: window.location.href,
          title: document.title,
          hasTable: !!document.querySelector('table'),
          tableRows: document.querySelectorAll('tr').length,
          hasTransactionData: false,
          transactionCount: 0,
          hasFilters: !!document.querySelector('[data-testid="filters"]'),
          hasAddButton: !!document.querySelector('[data-testid="add-transaction"]'),
          hasErrorMessages: false,
          hasLoadingState: false,
          debugInfo: null,
          pageText: document.body.innerText.substring(0, 500),
          consoleErrors: [],
          actualDataVisible: false
        };

        // Check for transaction count display
        const countElement = document.querySelector('p');
        if (countElement && countElement.innerText.includes('transactions')) {
          const match = countElement.innerText.match(/(\d+) of (\d+) transactions/);
          if (match) {
            result.transactionCount = parseInt(match[2]);
            result.visibleCount = parseInt(match[1]);
          }
        }

        // Check for actual transaction data in table
        const tableBody = document.querySelector('tbody');
        if (tableBody) {
          const dataRows = tableBody.querySelectorAll('tr');
          result.actualDataVisible = dataRows.length > 0;
          
          // Check if rows contain actual transaction data (amounts, dates, etc.)
          for (const row of dataRows) {
            if (row.innerText.includes('$') || row.innerText.includes('CAD') || 
                row.innerText.match(/\d{4}-\d{2}-\d{2}/)) {
              result.hasTransactionData = true;
              break;
            }
          }
        }

        // Check for error states
        result.hasErrorMessages = document.body.innerText.includes('No transactions found') ||
                                 document.body.innerText.includes('Error') ||
                                 document.body.innerText.includes('Failed');

        // Check for loading states
        result.hasLoadingState = document.body.innerText.includes('Loading') ||
                                !!document.querySelector('.loading') ||
                                !!document.querySelector('.spinner');

        // Get debug info if available
        const debugElement = document.querySelector('.text-red-500');
        if (debugElement) {
          result.debugInfo = debugElement.innerText;
        }

        return result;
      });

      this.testResults.transactions = analysis;

      // Analyze issues
      if (!analysis.hasTable) {
        this.issues.push({
          type: 'ui_missing',
          severity: 'high',
          message: 'Transactions table not found',
          page: 'transactions'
        });
      }

      if (analysis.transactionCount > 0 && !analysis.hasTransactionData) {
        this.issues.push({
          type: 'data_display',
          severity: 'critical',
          message: `API returns ${analysis.transactionCount} transactions but none are visible in UI`,
          page: 'transactions'
        });
      }

      if (analysis.hasErrorMessages) {
        this.issues.push({
          type: 'error_state',
          severity: 'medium',
          message: 'Error messages found on transactions page',
          details: analysis.pageText,
          page: 'transactions'
        });
      }

      console.log(`📊 Transactions Analysis:`);
      console.log(`   - Has table: ${analysis.hasTable}`);
      console.log(`   - Table rows: ${analysis.tableRows}`);
      console.log(`   - Transaction count: ${analysis.transactionCount}`);
      console.log(`   - Actual data visible: ${analysis.actualDataVisible}`);
      console.log(`   - Has transaction data: ${analysis.hasTransactionData}`);
      console.log(`   - Debug info: ${analysis.debugInfo || 'None'}`);

    } catch (error) {
      this.issues.push({
        type: 'page_analysis_error',
        severity: 'high',
        message: `Failed to analyze transactions page: ${error.message}`,
        stack: error.stack
      });
      console.log(`💥 Transactions analysis error: ${error.message}`);
    }
  }

  async testAllPages() {
    console.log('🧭 Testing all application pages...');
    
    const pages = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/banking', name: 'Banking' },
      { path: '/ai-assistant', name: 'AI Assistant' },
      { path: '/receipts', name: 'Receipts' },
      { path: '/reports', name: 'Reports' },
      { path: '/settings', name: 'Settings' }
    ];

    for (const pageInfo of pages) {
      try {
        console.log(`   Testing ${pageInfo.name}...`);
        await this.page.goto(`http://localhost:5000${pageInfo.path}`, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.takeScreenshot(`${pageInfo.name} page`);

        const pageAnalysis = await this.page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          hasContent: document.body.innerText.length > 100,
          hasErrors: document.body.innerText.includes('Error') || 
                    document.body.innerText.includes('404') ||
                    document.body.innerText.includes('Not Found'),
          interactiveElements: document.querySelectorAll('button, input, select, a').length,
          isWorking: !document.body.innerText.includes('Something went wrong')
        }));

        this.testResults[pageInfo.name.toLowerCase()] = pageAnalysis;

        if (pageAnalysis.hasErrors) {
          this.issues.push({
            type: 'page_error',
            severity: 'medium',
            message: `${pageInfo.name} page shows error content`,
            page: pageInfo.path
          });
        }

        if (!pageAnalysis.isWorking) {
          this.issues.push({
            type: 'page_broken',
            severity: 'high',
            message: `${pageInfo.name} page appears to be broken`,
            page: pageInfo.path
          });
        }

      } catch (error) {
        this.issues.push({
          type: 'page_load_error',
          severity: 'high',
          message: `Failed to load ${pageInfo.name}: ${error.message}`,
          page: pageInfo.path
        });
        console.log(`💥 ${pageInfo.name} error: ${error.message}`);
      }
    }
  }

  async testApiEndpoints() {
    console.log('🌐 Testing API endpoints...');
    
    const endpoints = [
      '/api/auth/me',
      '/api/transactions',
      '/api/bank-connections',
      '/api/financial-summary',
      '/api/receipts',
      '/api/chat/history'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.page.evaluate(async (url) => {
          const res = await fetch(url, { credentials: 'include' });
          return {
            status: res.status,
            ok: res.ok,
            statusText: res.statusText,
            url: res.url
          };
        }, `http://localhost:5000${endpoint}`);

        this.testResults[`api_${endpoint.replace(/[/]/g, '_')}`] = response;

        if (!response.ok && response.status !== 401) { // 401 is expected for unauth endpoints
          this.issues.push({
            type: 'api_error',
            severity: 'medium',
            message: `API endpoint ${endpoint} returned ${response.status}: ${response.statusText}`,
            endpoint
          });
        }

      } catch (error) {
        this.issues.push({
          type: 'api_failure',
          severity: 'high',
          message: `API endpoint ${endpoint} failed: ${error.message}`,
          endpoint
        });
      }
    }
  }

  async generateReport() {
    console.log('📋 Generating comprehensive system report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: this.issues.filter(i => i.severity === 'critical').length,
        highIssues: this.issues.filter(i => i.severity === 'high').length,
        mediumIssues: this.issues.filter(i => i.severity === 'medium').length,
        screenshotsTaken: this.screenshots.length
      },
      issues: this.issues,
      testResults: this.testResults,
      screenshots: this.screenshots,
      recommendations: this.generateRecommendations()
    };

    await fs.writeFile('comprehensive-system-analysis.json', JSON.stringify(report, null, 2));
    
    console.log('\n📊 SYSTEM ANALYSIS COMPLETE');
    console.log('================================');
    console.log(`Total Issues Found: ${report.summary.totalIssues}`);
    console.log(`  Critical: ${report.summary.criticalIssues}`);
    console.log(`  High: ${report.summary.highIssues}`);
    console.log(`  Medium: ${report.summary.mediumIssues}`);
    console.log(`Screenshots: ${report.summary.screenshotsTaken}`);
    console.log('\nTop Issues:');
    
    this.issues
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 5)
      .forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      });

    console.log('\nRecommendations:');
    report.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Critical issues first
    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('CRITICAL: Fix authentication and data display issues immediately');
    }

    // Data display issues
    const dataIssues = this.issues.filter(i => i.type === 'data_display');
    if (dataIssues.length > 0) {
      recommendations.push('Fix transaction filtering logic - data is fetched but not displayed');
    }

    // Console errors
    const consoleErrors = this.issues.filter(i => i.type === 'console_error');
    if (consoleErrors.length > 3) {
      recommendations.push('Address multiple JavaScript console errors affecting user experience');
    }

    // UI missing elements
    const uiIssues = this.issues.filter(i => i.type === 'ui_missing');
    if (uiIssues.length > 0) {
      recommendations.push('Restore missing UI components and interactive elements');
    }

    // API issues
    const apiIssues = this.issues.filter(i => i.type.includes('api'));
    if (apiIssues.length > 2) {
      recommendations.push('Investigate API connectivity and response handling');
    }

    return recommendations;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the comprehensive analysis
async function runSystemAnalysis() {
  const analyzer = new BookkeepAISystemAnalyzer();
  
  try {
    await analyzer.initialize();
    
    // Step 1: Test authentication
    const loginSuccess = await analyzer.performLogin();
    
    if (loginSuccess) {
      // Step 2: Deep dive into transactions (main issue)
      await analyzer.analyzeTransactionsPage();
      
      // Step 3: Test all other pages
      await analyzer.testAllPages();
      
      // Step 4: Test API endpoints
      await analyzer.testApiEndpoints();
    }
    
    // Step 5: Generate comprehensive report
    const report = await analyzer.generateReport();
    
    return report;
    
  } catch (error) {
    console.error('💥 System analysis failed:', error);
    throw error;
  } finally {
    await analyzer.cleanup();
  }
}

runSystemAnalysis().catch(console.error);