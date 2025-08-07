import puppeteer from 'puppeteer';
import fs from 'fs/promises';

class FinalUIAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.sessionCookies = null;
    this.testResults = new Map();
    this.screenshotCount = 0;
  }

  async init() {
    console.log('🚀 Starting Final UI Automation System...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Set up better error handling
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warn') {
        console.log(`[BROWSER ${type.toUpperCase()}] ${msg.text()}`);
      }
    });
    
    this.page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    
    console.log('✅ UI Automation System initialized');
  }

  async authenticateWithAPI() {
    console.log('🔐 Authenticating via API...');
    
    // First, authenticate via API to get session cookie
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'demo@bookkeepai.com',
        password: 'password123'
      })
    });
    
    if (loginResponse.ok) {
      const setCookieHeader = loginResponse.headers.get('set-cookie');
      if (setCookieHeader) {
        // Extract session cookie
        const sessionMatch = setCookieHeader.match(/connect\.sid=([^;]+)/);
        if (sessionMatch) {
          this.sessionCookies = [{
            name: 'connect.sid',
            value: sessionMatch[1],
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax'
          }];
          
          console.log('✅ API authentication successful');
          return true;
        }
      }
    }
    
    console.log('❌ API authentication failed');
    return false;
  }

  async injectAuthenticationAndNavigate(url) {
    console.log(`🔗 Navigating to ${url} with authentication...`);
    
    // Set the session cookie in the browser
    if (this.sessionCookies) {
      await this.page.setCookie(...this.sessionCookies);
    }
    
    await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    await this.takeScreenshot(`Authenticated navigation to ${url}`);
    
    // Check if authentication worked
    const authStatus = await this.page.evaluate(() => {
      return {
        hasLoginForm: !!document.querySelector('input[type="email"]'),
        hasAuthError: document.body.innerText.includes('401') || document.body.innerText.includes('Unauthorized'),
        hasContent: document.body.innerText.length > 200,
        url: window.location.href,
        bodyPreview: document.body.innerText.substring(0, 200)
      };
    });
    
    console.log('Authentication check:', authStatus);
    return !authStatus.hasLoginForm && !authStatus.hasAuthError;
  }

  async takeScreenshot(description) {
    this.screenshotCount++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `final-automation-${this.screenshotCount.toString().padStart(3, '0')}-${timestamp}.png`;
    
    await this.page.screenshot({ path: filename, fullPage: false });
    console.log(`📸 ${description} → ${filename}`);
  }

  async analyzePageDetailed(pageName, url) {
    console.log(`\n📊 Analyzing ${pageName}...`);
    
    const success = await this.injectAuthenticationAndNavigate(url);
    
    if (!success) {
      console.log(`❌ ${pageName}: Authentication failed`);
      this.testResults.set(pageName, { status: 'auth_failed', reason: 'Could not authenticate' });
      return null;
    }
    
    const analysis = await this.page.evaluate(() => {
      // Helper function to get detailed element info
      const analyzeElements = (selector) => {
        const elements = Array.from(document.querySelectorAll(selector));
        return elements.map((el, index) => ({
          index,
          text: el.textContent.trim().substring(0, 100),
          visible: el.offsetParent !== null,
          testId: el.getAttribute('data-testid'),
          className: el.className,
          tagName: el.tagName,
          disabled: el.disabled,
          hasClickHandler: !!(el.onclick || el.getAttribute('data-testid') || el.type === 'submit')
        })).filter(el => el.visible);
      };
      
      // Comprehensive page analysis
      return {
        meta: {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        },
        content: {
          bodyLength: document.body.innerText.length,
          preview: document.body.innerText.substring(0, 300),
          hasErrors: document.body.innerText.includes('Error') || document.body.innerText.includes('404')
        },
        structure: {
          totalElements: document.querySelectorAll('*').length,
          buttons: analyzeElements('button'),
          inputs: analyzeElements('input'),
          links: analyzeElements('a[href]'),
          forms: document.querySelectorAll('form').length,
          tables: document.querySelectorAll('table').length
        },
        components: {
          quickActions: !!document.querySelector('[data-testid="quick-actions"]'),
          financialCards: !!document.querySelector('[data-testid="financial-cards"]'),
          transactionTable: !!document.querySelector('[data-testid="transaction-table"], table'),
          uploadArea: !!document.querySelector('[data-testid="upload"]'),
          messageInput: !!document.querySelector('#message-input'),
          bankAccounts: document.querySelectorAll('[data-testid*="bank-account"]').length
        },
        interactivity: {
          totalInteractive: document.querySelectorAll('button, input, a[href], [data-testid]').length,
          visibleInteractive: Array.from(document.querySelectorAll('button, input, a[href]')).filter(el => el.offsetParent !== null).length,
          clickableButtons: Array.from(document.querySelectorAll('button')).filter(el => el.offsetParent !== null && !el.disabled).length
        }
      };
    });
    
    // Determine status
    let status = 'working';
    let details = {};
    
    if (analysis.content.hasErrors) {
      status = 'error';
      details.reason = 'Page contains error messages';
    } else if (analysis.interactivity.visibleInteractive === 0) {
      status = 'no_interaction';
      details.reason = 'No interactive elements detected';
    } else if (analysis.interactivity.clickableButtons === 0) {
      status = 'no_buttons';
      details.reason = 'No clickable buttons found';
    }
    
    console.log(`${pageName} Analysis Results:`);
    console.log(`  Status: ${status === 'working' ? '✅ WORKING' : '❌ ' + status.toUpperCase()}`);
    console.log(`  Interactive Elements: ${analysis.interactivity.visibleInteractive}`);
    console.log(`  Clickable Buttons: ${analysis.interactivity.clickableButtons}`);
    console.log(`  Components Found:`);
    console.log(`    Quick Actions: ${analysis.components.quickActions ? '✅' : '❌'}`);
    console.log(`    Financial Cards: ${analysis.components.financialCards ? '✅' : '❌'}`);
    console.log(`    Table: ${analysis.components.transactionTable ? '✅' : '❌'}`);
    console.log(`    Upload: ${analysis.components.uploadArea ? '✅' : '❌'}`);
    console.log(`    Message Input: ${analysis.components.messageInput ? '✅' : '❌'}`);
    
    // Test some interactions if possible
    if (analysis.structure.buttons.length > 0) {
      console.log(`  Testing button interactions...`);
      const testResults = await this.testButtonInteractions(analysis.structure.buttons.slice(0, 3));
      details.buttonTests = testResults;
    }
    
    this.testResults.set(pageName, {
      status,
      analysis,
      details,
      timestamp: new Date().toISOString()
    });
    
    return analysis;
  }

  async testButtonInteractions(buttons) {
    const results = [];
    
    for (const buttonInfo of buttons) {
      try {
        // Try to find and click the button
        const buttonSelector = buttonInfo.testId ? 
          `[data-testid="${buttonInfo.testId}"]` : 
          `button:nth-child(${buttonInfo.index + 1})`;
        
        const button = await this.page.$(buttonSelector);
        if (button) {
          const wasClicked = await this.page.evaluate((btn) => {
            try {
              btn.click();
              return true;
            } catch (e) {
              return false;
            }
          }, button);
          
          results.push({
            text: buttonInfo.text,
            testId: buttonInfo.testId,
            clicked: wasClicked,
            status: wasClicked ? 'success' : 'failed'
          });
          
          // Wait a bit after clicking
          if (wasClicked) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          results.push({
            text: buttonInfo.text,
            testId: buttonInfo.testId,
            clicked: false,
            status: 'not_found'
          });
        }
      } catch (error) {
        results.push({
          text: buttonInfo.text,
          testId: buttonInfo.testId,
          clicked: false,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  async runComprehensiveTest() {
    await this.init();
    
    try {
      console.log('\n🎬 Starting Comprehensive UI Test Suite...\n');
      
      // Step 1: Authenticate via API
      const authSuccess = await this.authenticateWithAPI();
      
      if (!authSuccess) {
        console.log('❌ Cannot proceed without authentication');
        return null;
      }
      
      // Step 2: Test all main pages
      const pages = [
        { name: 'dashboard', url: 'http://localhost:5000/dashboard' },
        { name: 'transactions', url: 'http://localhost:5000/transactions' },
        { name: 'banking', url: 'http://localhost:5000/banking' },
        { name: 'ai-assistant', url: 'http://localhost:5000/ai-assistant' },
        { name: 'receipts', url: 'http://localhost:5000/receipts' },
        { name: 'reports', url: 'http://localhost:5000/reports' }
      ];
      
      for (const page of pages) {
        await this.analyzePageDetailed(page.name, page.url);
      }
      
      // Step 3: Generate final report
      const report = await this.generateFinalReport();
      
      console.log('\n🎉 Comprehensive UI Test Complete!');
      return report;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.browser.close();
    }
  }

  async generateFinalReport() {
    const timestamp = new Date().toISOString();
    const results = Object.fromEntries(this.testResults);
    
    const summary = {
      timestamp,
      totalPages: this.testResults.size,
      workingPages: Array.from(this.testResults.values()).filter(r => r.status === 'working').length,
      failedPages: Array.from(this.testResults.values()).filter(r => r.status !== 'working').length,
      screenshots: this.screenshotCount,
      overallStatus: this.calculateOverallStatus()
    };
    
    const report = {
      summary,
      results,
      recommendations: this.generateActionableRecommendations()
    };
    
    const filename = `final-automation-report-${timestamp.replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Final UI Automation Report:');
    console.log(`  Pages Tested: ${summary.totalPages}`);
    console.log(`  Working: ${summary.workingPages}`);
    console.log(`  Failed: ${summary.failedPages}`);
    console.log(`  Overall Status: ${summary.overallStatus}`);
    console.log(`  Screenshots: ${summary.screenshots}`);
    console.log(`  Report: ${filename}`);
    
    // Print specific page statuses
    console.log('\n📋 Page Status Details:');
    this.testResults.forEach((result, page) => {
      const statusIcon = result.status === 'working' ? '✅' : '❌';
      console.log(`  ${statusIcon} ${page}: ${result.status}`);
      if (result.analysis?.interactivity) {
        console.log(`       Interactive elements: ${result.analysis.interactivity.visibleInteractive}`);
      }
    });
    
    return report;
  }

  calculateOverallStatus() {
    const total = this.testResults.size;
    const working = Array.from(this.testResults.values()).filter(r => r.status === 'working').length;
    const percentage = total > 0 ? (working / total) * 100 : 0;
    
    if (percentage >= 90) return 'EXCELLENT';
    if (percentage >= 70) return 'GOOD';
    if (percentage >= 50) return 'FAIR';
    return 'NEEDS_IMPROVEMENT';
  }

  generateActionableRecommendations() {
    const recommendations = [];
    
    this.testResults.forEach((result, page) => {
      if (result.status !== 'working') {
        if (result.status === 'no_interaction') {
          recommendations.push({
            priority: 'HIGH',
            page,
            issue: 'No interactive elements detected',
            action: 'Add data-testid attributes to buttons and interactive components',
            technical: 'Ensure components are properly mounted and visible in DOM'
          });
        } else if (result.status === 'no_buttons') {
          recommendations.push({
            priority: 'MEDIUM',
            page,
            issue: 'No clickable buttons found',
            action: 'Verify button event handlers are properly attached',
            technical: 'Check button disabled states and onclick handlers'
          });
        } else if (result.status === 'auth_failed') {
          recommendations.push({
            priority: 'CRITICAL',
            page,
            issue: 'Authentication required',
            action: 'Fix session management and authentication flow',
            technical: 'Check session middleware and login endpoint'
          });
        }
      }
    });
    
    return recommendations;
  }
}

// Run the final automation test
async function runFinalAutomation() {
  const automation = new FinalUIAutomation();
  const report = await automation.runComprehensiveTest();
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFinalAutomation();
}

export default FinalUIAutomation;