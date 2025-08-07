import puppeteer from 'puppeteer';
import fs from 'fs/promises';

class UIController {
  constructor() {
    this.browser = null;
    this.page = null;
    this.screenshotCount = 0;
    this.actionLog = [];
    this.integrationMap = new Map();
  }

  async init() {
    console.log('🚀 Initializing UI Controller...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Enable request interception to handle auth cookies
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      request.continue();
    });
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
    
    console.log('✅ UI Controller initialized');
  }

  async takeScreenshot(description = '') {
    this.screenshotCount++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ui-action-log-${timestamp}.png`;
    
    await this.page.screenshot({
      path: filename,
      fullPage: false
    });
    
    console.log(`📸 Screenshot: ${description} (${filename})`);
    this.logAction('screenshot', { filename, description });
  }

  async navigateAndWait(url, description = '') {
    console.log(`🔗 Navigating to: ${url} ${description ? '(' + description + ')' : ''}`);
    
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.takeScreenshot(`Navigate to ${url}`);
      
      this.logAction('navigate', { url, description });
      return true;
    } catch (error) {
      console.log(`❌ Navigation failed: ${error.message}`);
      return false;
    }
  }

  async performCompleteLogin() {
    console.log('🔐 Performing complete login sequence...');
    
    // Start fresh
    await this.navigateAndWait('http://localhost:5000/', 'Login page');
    
    try {
      // Wait for login form to be fully loaded
      await this.page.waitForSelector('input[type="email"]', { timeout: 5000 });
      await this.page.waitForSelector('input[type="password"]', { timeout: 5000 });
      await this.page.waitForSelector('button[type="submit"]', { timeout: 5000 });
      
      // Clear any existing input and type credentials
      await this.page.evaluate(() => {
        const emailInput = document.querySelector('input[type="email"]');
        const passwordInput = document.querySelector('input[type="password"]');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
      });
      
      await this.page.type('input[type="email"]', 'demo@bookkeepai.com');
      await this.page.type('input[type="password"]', 'password123');
      
      console.log('✅ Credentials entered');
      await this.takeScreenshot('Credentials entered');
      
      // Submit form
      await this.page.click('button[type="submit"]');
      console.log('✅ Login button clicked');
      
      // Wait for navigation or response
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const currentUrl = this.page.url();
      console.log(`Current URL after login: ${currentUrl}`);
      
      // Check if we're actually logged in by looking for dashboard content
      const isLoggedIn = await this.page.evaluate(() => {
        // Check for dashboard-specific content or lack of login form
        const hasLoginForm = !!document.querySelector('input[type="email"]');
        const hasDashboardContent = document.body.innerText.includes('Dashboard') || 
                                   document.body.innerText.includes('Quick Actions') ||
                                   document.body.innerText.includes('Financial');
        const hasAuthError = document.body.innerText.includes('Invalid') || 
                           document.body.innerText.includes('Error');
        
        return {
          hasLoginForm,
          hasDashboardContent,
          hasAuthError,
          bodyText: document.body.innerText.substring(0, 300)
        };
      });
      
      console.log('Login status check:', isLoggedIn);
      
      if (!isLoggedIn.hasLoginForm && !isLoggedIn.hasAuthError) {
        console.log('✅ Login appears successful');
        this.integrationMap.set('authentication', { status: 'working', details: isLoggedIn });
        return true;
      } else {
        console.log('❌ Login failed or not complete');
        this.integrationMap.set('authentication', { status: 'failed', details: isLoggedIn });
        return false;
      }
      
    } catch (error) {
      console.log(`❌ Login error: ${error.message}`);
      this.integrationMap.set('authentication', { status: 'failed', error: error.message });
      return false;
    }
  }

  async analyzePage(pageName, url) {
    console.log(`🔍 Analyzing ${pageName}...`);
    
    await this.navigateAndWait(url, pageName);
    
    const analysis = await this.page.evaluate(() => {
      const getElementInfo = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => ({
          text: el.textContent.trim().substring(0, 50),
          visible: el.offsetParent !== null,
          testId: el.getAttribute('data-testid'),
          className: el.className
        }));
      };
      
      return {
        url: window.location.href,
        title: document.title,
        pageContent: document.body.innerText.substring(0, 500),
        structure: {
          totalElements: document.querySelectorAll('*').length,
          buttons: getElementInfo('button'),
          inputs: getElementInfo('input'),
          links: getElementInfo('a[href]'),
          forms: document.querySelectorAll('form').length,
          tables: document.querySelectorAll('table').length
        },
        visibility: {
          visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
          visibleInputs: Array.from(document.querySelectorAll('input')).filter(i => i.offsetParent !== null).length,
          visibleLinks: Array.from(document.querySelectorAll('a[href]')).filter(a => a.offsetParent !== null).length
        },
        specific: {
          hasDataTestIds: document.querySelectorAll('[data-testid]').length,
          hasQuickActions: !!document.querySelector('[data-testid="quick-actions"]'),
          hasFinancialCards: !!document.querySelector('[data-testid="financial-cards"]'),
          hasTable: !!document.querySelector('table'),
          hasUpload: !!document.querySelector('[data-testid="upload"]'),
          hasMessageInput: !!document.querySelector('#message-input')
        }
      };
    });
    
    console.log(`${pageName} Analysis:`);
    console.log(`  Total Elements: ${analysis.structure.totalElements}`);
    console.log(`  Visible Buttons: ${analysis.visibility.visibleButtons}`);
    console.log(`  Visible Inputs: ${analysis.visibility.visibleInputs}`);
    console.log(`  Data Test IDs: ${analysis.specific.hasDataTestIds}`);
    console.log(`  Quick Actions: ${analysis.specific.hasQuickActions ? '✅' : '❌'}`);
    console.log(`  Financial Cards: ${analysis.specific.hasFinancialCards ? '✅' : '❌'}`);
    
    // Test interactive elements
    if (analysis.visibility.visibleButtons > 0) {
      console.log(`🔄 Testing first few buttons on ${pageName}...`);
      
      const buttonTests = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const results = [];
        
        for (let i = 0; i < Math.min(3, buttons.length); i++) {
          const btn = buttons[i];
          results.push({
            text: btn.textContent.trim(),
            testId: btn.getAttribute('data-testid'),
            clickable: !btn.disabled,
            hasHandler: !!(btn.onclick || btn.getAttribute('data-testid'))
          });
        }
        
        return results;
      });
      
      buttonTests.forEach(btn => {
        console.log(`  Button: "${btn.text}" - ${btn.clickable ? '✅' : '❌'} clickable, ${btn.hasHandler ? '✅' : '❌'} has handler`);
      });
    }
    
    this.integrationMap.set(pageName, {
      status: analysis.visibility.visibleButtons > 0 ? 'working' : 'failed',
      details: analysis
    });
    
    this.logAction('analyze', { page: pageName, url, analysis });
    return analysis;
  }

  async testSpecificInteractions() {
    console.log('🧪 Testing specific interactions...');
    
    // Test AI Assistant message sending
    await this.navigateAndWait('http://localhost:5000/ai-assistant', 'AI Assistant');
    
    const aiTest = await this.page.evaluate(() => {
      const messageInput = document.querySelector('#message-input');
      const sendButton = document.querySelector('button[type="submit"]');
      
      if (messageInput && sendButton) {
        messageInput.value = 'What are my total expenses this month?';
        return { canTest: true, inputExists: true, buttonExists: true };
      }
      
      return { canTest: false, inputExists: !!messageInput, buttonExists: !!sendButton };
    });
    
    if (aiTest.canTest) {
      try {
        await this.page.click('button[type="submit"]');
        console.log('✅ AI message sent successfully');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.takeScreenshot('AI message sent');
      } catch (error) {
        console.log('❌ AI message send failed');
      }
    }
    
    // Test banking connection
    await this.navigateAndWait('http://localhost:5000/banking', 'Banking');
    
    const bankingButtons = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent.trim(),
        visible: btn.offsetParent !== null,
        testId: btn.getAttribute('data-testid')
      })).filter(btn => btn.visible);
    });
    
    console.log(`Found ${bankingButtons.length} banking buttons:`, bankingButtons.map(b => b.text));
    
    return { aiTest, bankingButtons };
  }

  async generateComprehensiveReport() {
    const timestamp = new Date().toISOString();
    
    const report = {
      timestamp,
      summary: {
        totalPages: this.integrationMap.size,
        workingPages: Array.from(this.integrationMap.values()).filter(p => p.status === 'working').length,
        failedPages: Array.from(this.integrationMap.values()).filter(p => p.status === 'failed').length,
        screenshots: this.screenshotCount,
        totalActions: this.actionLog.length
      },
      integrationStatus: Object.fromEntries(this.integrationMap),
      actionLog: this.actionLog,
      recommendations: this.generateRecommendations()
    };
    
    const filename = `ui-action-log-${timestamp.replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Comprehensive UI Report Generated');
    console.log(`Working Pages: ${report.summary.workingPages}/${report.summary.totalPages}`);
    console.log(`Screenshots: ${report.summary.screenshots}`);
    console.log(`Total Actions: ${report.summary.totalActions}`);
    console.log(`Report saved: ${filename}`);
    
    // Calculate success rate
    const successRate = (report.summary.workingPages / report.summary.totalPages) * 100;
    const status = successRate >= 80 ? 'EXCELLENT' : 
                  successRate >= 60 ? 'GOOD' : 
                  successRate >= 40 ? 'FAIR' : 'POOR';
    
    console.log(`\n🎯 Overall Integration Status: ${status} (${successRate.toFixed(1)}%)`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    this.integrationMap.forEach((status, pageName) => {
      if (status.status === 'failed') {
        if (pageName === 'dashboard' && status.details?.visibility?.visibleButtons === 0) {
          recommendations.push({
            priority: 'HIGH',
            page: pageName,
            issue: 'Dashboard components not rendering properly',
            action: 'Check component mounting, CSS visibility, and data-testid attributes'
          });
        } else if (status.details?.visibility?.visibleButtons === 0) {
          recommendations.push({
            priority: 'MEDIUM',
            page: pageName,
            issue: 'No interactive elements detected',
            action: 'Verify page routing and component rendering'
          });
        }
      }
    });
    
    return recommendations;
  }

  logAction(type, data) {
    this.actionLog.push({
      timestamp: new Date().toISOString(),
      type,
      data
    });
  }

  async runCompleteAnalysis() {
    await this.init();
    
    try {
      console.log('\n🎬 Starting Complete UI Analysis...\n');
      
      // Login first
      const loginSuccess = await this.performCompleteLogin();
      
      if (loginSuccess) {
        // Analyze all main pages
        await this.analyzePage('dashboard', 'http://localhost:5000/dashboard');
        await this.analyzePage('transactions', 'http://localhost:5000/transactions');
        await this.analyzePage('banking', 'http://localhost:5000/banking');
        await this.analyzePage('ai-assistant', 'http://localhost:5000/ai-assistant');
        await this.analyzePage('receipts', 'http://localhost:5000/receipts');
        await this.analyzePage('reports', 'http://localhost:5000/reports');
        
        // Test specific interactions
        await this.testSpecificInteractions();
      } else {
        console.log('⚠️ Skipping page analysis due to login failure');
      }
      
      // Generate final report
      const report = await this.generateComprehensiveReport();
      
      console.log('\n🎉 Complete UI Analysis finished!');
      
      return report;
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
    } finally {
      await this.browser.close();
    }
  }
}

// Run the complete UI analysis
async function runUIController() {
  const controller = new UIController();
  const report = await controller.runCompleteAnalysis();
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runUIController();
}

export default UIController;