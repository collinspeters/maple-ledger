import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

class InteractiveWebAgent {
  constructor() {
    this.browser = null;
    this.page = null;
    this.actionLog = [];
    this.screenshotIndex = 0;
  }

  async init() {
    console.log('🚀 Initializing Interactive Web Agent...');
    this.browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging
    this.page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });

    // Handle page errors
    this.page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    console.log('✅ Interactive Web Agent initialized');
  }

  async takeScreenshot(description = '') {
    this.screenshotIndex++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `agent-screenshot-${this.screenshotIndex.toString().padStart(3, '0')}-${timestamp}.png`;
    const filepath = path.join('agent-screenshots', filename);
    
    // Ensure directory exists
    await fs.mkdir('agent-screenshots', { recursive: true });
    
    await this.page.screenshot({ 
      path: filepath,
      fullPage: true 
    });
    
    console.log(`📸 Screenshot saved: ${filename} - ${description}`);
    this.logAction('screenshot', { filename, description });
    return filepath;
  }

  async navigateTo(url) {
    console.log(`🔗 Navigating to: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    await this.takeScreenshot(`Navigate to ${url}`);
    this.logAction('navigate', { url });
  }

  async waitForElement(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.log(`⚠️  Element not found: ${selector}`);
      return false;
    }
  }

  async clickElement(selector, description = '') {
    try {
      console.log(`👆 Clicking: ${description || selector}`);
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for any animations
      await this.takeScreenshot(`Click ${description || selector}`);
      this.logAction('click', { selector, description });
      return true;
    } catch (error) {
      console.log(`❌ Failed to click: ${selector} - ${error.message}`);
      return false;
    }
  }

  async typeText(selector, text, description = '') {
    try {
      console.log(`⌨️  Typing "${text}" into: ${description || selector}`);
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector); // Focus the element
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.type(text);
      await this.takeScreenshot(`Type into ${description || selector}`);
      this.logAction('type', { selector, text, description });
      return true;
    } catch (error) {
      console.log(`❌ Failed to type into: ${selector} - ${error.message}`);
      return false;
    }
  }

  async scrollTo(selector, description = '') {
    try {
      console.log(`📜 Scrolling to: ${description || selector}`);
      await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, selector);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.takeScreenshot(`Scroll to ${description || selector}`);
      this.logAction('scroll', { selector, description });
      return true;
    } catch (error) {
      console.log(`❌ Failed to scroll to: ${selector} - ${error.message}`);
      return false;
    }
  }

  async getPageInfo() {
    const info = await this.page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        visibleText: document.body.innerText.substring(0, 500),
        forms: Array.from(document.forms).length,
        buttons: Array.from(document.querySelectorAll('button')).length,
        links: Array.from(document.querySelectorAll('a')).length,
        inputs: Array.from(document.querySelectorAll('input')).length
      };
    });
    
    console.log(`📋 Page Info: ${info.title} | ${info.buttons} buttons | ${info.inputs} inputs`);
    this.logAction('pageInfo', info);
    return info;
  }

  async findClickableElements() {
    const elements = await this.page.evaluate(() => {
      const clickable = [];
      
      // Find buttons
      document.querySelectorAll('button').forEach((btn, index) => {
        if (btn.offsetParent !== null) { // visible
          clickable.push({
            type: 'button',
            text: btn.textContent.trim(),
            selector: `button:nth-of-type(${index + 1})`,
            dataTestId: btn.getAttribute('data-testid')
          });
        }
      });
      
      // Find links
      document.querySelectorAll('a').forEach((link, index) => {
        if (link.offsetParent !== null) {
          clickable.push({
            type: 'link',
            text: link.textContent.trim(),
            href: link.href,
            selector: `a:nth-of-type(${index + 1})`,
            dataTestId: link.getAttribute('data-testid')
          });
        }
      });
      
      // Find form inputs
      document.querySelectorAll('input').forEach((input, index) => {
        if (input.offsetParent !== null) {
          clickable.push({
            type: 'input',
            inputType: input.type,
            placeholder: input.placeholder,
            selector: `input:nth-of-type(${index + 1})`,
            dataTestId: input.getAttribute('data-testid')
          });
        }
      });
      
      return clickable;
    });
    
    console.log(`🔍 Found ${elements.length} interactive elements`);
    return elements;
  }

  async performLogin(email = 'demo@bookkeepai.com', password = 'password123') {
    console.log('🔐 Performing login...');
    
    // Navigate to login page
    await this.navigateTo('http://localhost:5000/');
    
    // Wait for and fill email
    if (await this.waitForElement('input[type="email"]')) {
      await this.typeText('input[type="email"]', email, 'Email field');
    }
    
    // Wait for and fill password
    if (await this.waitForElement('input[type="password"]')) {
      await this.typeText('input[type="password"]', password, 'Password field');
    }
    
    // Click login button
    const loginSelectors = [
      'button[type="submit"]',
      '#login-button',
      '[data-testid="login-button"]',
      'button:contains("Login")',
      'button:contains("Sign In")'
    ];
    
    for (const selector of loginSelectors) {
      if (await this.clickElement(selector, 'Login button')) {
        break;
      }
    }
    
    // Wait for dashboard
    await new Promise(resolve => setTimeout(resolve, 3000));
    await this.takeScreenshot('After login attempt');
    
    const currentUrl = this.page.url();
    if (currentUrl.includes('/dashboard') || currentUrl === 'http://localhost:5000/') {
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login may have failed');
      return false;
    }
  }

  async exploreApp() {
    console.log('🧭 Starting app exploration...');
    
    const pages = [
      { url: '/dashboard', name: 'Dashboard' },
      { url: '/transactions', name: 'Transactions' },
      { url: '/banking', name: 'Banking' },
      { url: '/ai-assistant', name: 'AI Assistant' },
      { url: '/receipts', name: 'Receipts' },
      { url: '/reports', name: 'Reports' },
      { url: '/clients', name: 'Clients' },
      { url: '/invoices', name: 'Invoices' }
    ];
    
    for (const pageInfo of pages) {
      console.log(`\n📄 Exploring ${pageInfo.name}...`);
      await this.navigateTo(`http://localhost:5000${pageInfo.url}`);
      await this.getPageInfo();
      
      const elements = await this.findClickableElements();
      console.log(`Found ${elements.length} interactive elements on ${pageInfo.name}`);
      
      // Test some interactions
      const buttons = elements.filter(el => el.type === 'button' && el.text.length > 0);
      if (buttons.length > 0) {
        console.log(`Testing button interactions on ${pageInfo.name}:`);
        for (let i = 0; i < Math.min(3, buttons.length); i++) {
          const btn = buttons[i];
          console.log(`  - ${btn.text}`);
          if (btn.dataTestId) {
            await this.clickElement(`[data-testid="${btn.dataTestId}"]`, btn.text);
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async testFeatureInteractions() {
    console.log('\n🧪 Testing feature interactions...');
    
    // Test transaction filtering
    await this.navigateTo('http://localhost:5000/transactions');
    if (await this.waitForElement('[data-testid="filters"]')) {
      await this.clickElement('[data-testid="filters"]', 'Transaction filters');
    }
    
    // Test adding a transaction
    if (await this.waitForElement('[data-testid="add-transaction"]')) {
      await this.clickElement('[data-testid="add-transaction"]', 'Add transaction');
    }
    
    // Test AI assistant
    await this.navigateTo('http://localhost:5000/ai-assistant');
    if (await this.waitForElement('#message-input')) {
      await this.typeText('#message-input', 'What are my total expenses this month?', 'AI message input');
      if (await this.waitForElement('button[type="submit"]')) {
        await this.clickElement('button[type="submit"]', 'Send message to AI');
      }
    }
    
    // Test banking connection
    await this.navigateTo('http://localhost:5000/banking');
    if (await this.waitForElement('[data-testid="connect-bank"]')) {
      await this.clickElement('[data-testid="connect-bank"]', 'Connect bank');
    }
    
    // Test receipt upload
    await this.navigateTo('http://localhost:5000/receipts');
    await this.scrollTo('[data-testid="upload"]', 'Receipt upload area');
  }

  async fixDiscoveredIssues() {
    console.log('\n🔧 Identifying and documenting issues...');
    
    const issues = [];
    
    // Check for broken buttons
    const brokenButtons = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.filter(btn => {
        return btn.offsetParent !== null && 
               (!btn.onclick && !btn.getAttribute('data-testid') && 
                !btn.closest('form') && btn.textContent.trim().length > 0);
      }).map(btn => ({
        text: btn.textContent.trim(),
        hasTestId: !!btn.getAttribute('data-testid'),
        hasOnClick: !!btn.onclick
      }));
    });
    
    if (brokenButtons.length > 0) {
      issues.push(`Found ${brokenButtons.length} buttons without proper event handlers`);
    }
    
    // Check for missing navigation
    const hasNavigation = await this.page.evaluate(() => {
      return !!document.querySelector('.sidebar, .navigation, nav');
    });
    
    if (!hasNavigation) {
      issues.push('Navigation sidebar not detected');
    }
    
    console.log(`📋 Issues found: ${issues.length}`);
    issues.forEach(issue => console.log(`  ❌ ${issue}`));
    
    return issues;
  }

  logAction(type, data) {
    this.actionLog.push({
      timestamp: new Date().toISOString(),
      type,
      data
    });
  }

  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalActions: this.actionLog.length,
      screenshots: this.screenshotIndex,
      actions: this.actionLog
    };
    
    await fs.writeFile(
      'agent-exploration-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📊 Exploration Report Saved');
    console.log(`Total Actions: ${this.actionLog.length}`);
    console.log(`Screenshots: ${this.screenshotIndex}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function runInteractiveAgent() {
  const agent = new InteractiveWebAgent();
  
  try {
    await agent.init();
    
    // Login to the app
    await agent.performLogin();
    
    // Explore all pages
    await agent.exploreApp();
    
    // Test specific feature interactions
    await agent.testFeatureInteractions();
    
    // Identify issues
    await agent.fixDiscoveredIssues();
    
    // Save comprehensive report
    await agent.saveReport();
    
    console.log('\n🎉 Interactive exploration complete!');
    
  } catch (error) {
    console.error('❌ Agent exploration failed:', error);
  } finally {
    await agent.close();
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveAgent();
}

export default InteractiveWebAgent;