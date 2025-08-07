/**
 * UI Controller for BookkeepAI - Full-stack SaaS Integration
 * Automates UI interactions, captures screenshots, and maps feature integrations
 */

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';

class UIController {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'http://localhost:5000';
    this.screenshotCounter = 1;
    this.actionLog = [];
    this.integrationMap = {};
  }

  /**
   * Initialize browser and page
   */
  async init() {
    console.log('🚀 Initializing UI Controller...');
    
    this.browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      defaultViewport: { width: 1280, height: 720 },
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set user agent to mimic real browser
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('✅ UI Controller initialized');
    await this.loadIntegrationMap();
  }

  /**
   * Navigate to a specific route
   */
  async navigateTo(route = '/') {
    const url = `${this.baseUrl}${route}`;
    console.log(`🔗 Navigating to: ${url}`);
    
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    await this.captureScreenshot(`navigate-to-${route.replace(/\//g, '-')}`);
    
    this.logAction('navigate', { route, url });
  }

  /**
   * Click on an element
   */
  async click(selector, description = '') {
    console.log(`👆 Clicking: ${description || selector}`);
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for animations
      
      await this.captureScreenshot(`click-${this.sanitizeFilename(description || selector)}`);
      this.logAction('click', { selector, description });
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to click ${selector}:`, error.message);
      await this.captureScreenshot(`error-click-${this.sanitizeFilename(selector)}`);
      return false;
    }
  }

  /**
   * Type text into an input field
   */
  async type(selector, text, description = '') {
    console.log(`⌨️  Typing into: ${description || selector}`);
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector); // Focus the input
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a'); // Select all
      await this.page.keyboard.up('Control');
      await this.page.type(selector, text);
      
      await this.captureScreenshot(`type-${this.sanitizeFilename(description || selector)}`);
      this.logAction('type', { selector, text: text.length > 20 ? text.substring(0, 20) + '...' : text, description });
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to type into ${selector}:`, error.message);
      await this.captureScreenshot(`error-type-${this.sanitizeFilename(selector)}`);
      return false;
    }
  }

  /**
   * Scroll to an element
   */
  async scrollTo(selector, description = '') {
    console.log(`📜 Scrolling to: ${description || selector}`);
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, selector);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.captureScreenshot(`scroll-${this.sanitizeFilename(description || selector)}`);
      this.logAction('scroll', { selector, description });
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to scroll to ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Wait for an element to appear
   */
  async waitFor(selector, timeout = 5000, description = '') {
    console.log(`⏳ Waiting for: ${description || selector}`);
    
    try {
      await this.page.waitForSelector(selector, { timeout });
      await this.captureScreenshot(`wait-${this.sanitizeFilename(description || selector)}`);
      this.logAction('wait', { selector, description });
      return true;
    } catch (error) {
      console.error(`❌ Timeout waiting for ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Extract text from an element
   */
  async getText(selector, description = '') {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      const text = await this.page.$eval(selector, el => el.textContent.trim());
      
      this.logAction('getText', { selector, text: text.substring(0, 50) + '...', description });
      return text;
    } catch (error) {
      console.error(`❌ Failed to get text from ${selector}:`, error.message);
      return null;
    }
  }

  /**
   * Check if element exists
   */
  async exists(selector, description = '') {
    try {
      await this.page.waitForSelector(selector, { timeout: 2000 });
      this.logAction('exists', { selector, exists: true, description });
      return true;
    } catch (error) {
      this.logAction('exists', { selector, exists: false, description });
      return false;
    }
  }

  /**
   * Capture screenshot with automatic naming
   */
  async captureScreenshot(name = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${this.screenshotCounter.toString().padStart(3, '0')}-${name || 'capture'}-${timestamp}.png`;
    const filepath = path.join('ui-automation-screenshots', filename);
    
    // Ensure screenshots directory exists
    await fs.mkdir('ui-automation-screenshots', { recursive: true });
    
    await this.page.screenshot({ 
      path: filepath,
      fullPage: true
    });
    
    console.log(`📸 Screenshot saved: ${filename}`);
    this.screenshotCounter++;
    
    return filepath;
  }

  /**
   * Log an action with details
   */
  logAction(action, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      ...details
    };
    
    this.actionLog.push(logEntry);
    console.log(`📝 Action logged: ${action} - ${JSON.stringify(details)}`);
  }

  /**
   * Save action log to file
   */
  async saveActionLog() {
    const filename = `ui-action-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(filename, JSON.stringify(this.actionLog, null, 2));
    console.log(`💾 Action log saved: ${filename}`);
  }

  /**
   * Load integration map from file
   */
  async loadIntegrationMap() {
    try {
      const data = await fs.readFile('integrationMap.json', 'utf8');
      this.integrationMap = JSON.parse(data);
      console.log('📋 Integration map loaded');
    } catch (error) {
      console.log('📋 Creating new integration map');
      this.integrationMap = {
        features: {},
        connections: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Update integration map with feature connections
   */
  async updateIntegrationMap(feature, connectedFeatures = [], metadata = {}) {
    this.integrationMap.features[feature] = {
      connectedFeatures,
      metadata,
      lastTested: new Date().toISOString()
    };
    
    // Add connections
    connectedFeatures.forEach(connected => {
      const connection = { from: feature, to: connected, verified: true };
      if (!this.integrationMap.connections.find(c => c.from === feature && c.to === connected)) {
        this.integrationMap.connections.push(connection);
      }
    });
    
    this.integrationMap.lastUpdated = new Date().toISOString();
    await this.saveIntegrationMap();
  }

  /**
   * Save integration map to file
   */
  async saveIntegrationMap() {
    await fs.writeFile('integrationMap.json', JSON.stringify(this.integrationMap, null, 2));
    console.log('💾 Integration map saved');
  }

  /**
   * Check if features are already wired
   */
  isFeatureWired(feature, targetFeature = null) {
    if (!this.integrationMap.features[feature]) {
      return false;
    }
    
    if (targetFeature) {
      return this.integrationMap.features[feature].connectedFeatures.includes(targetFeature);
    }
    
    return this.integrationMap.features[feature].connectedFeatures.length > 0;
  }

  /**
   * Get page HTML context for debugging
   */
  async getPageContext() {
    return await this.page.content();
  }

  /**
   * Get all interactive elements on current page
   */
  async getInteractiveElements() {
    return await this.page.evaluate(() => {
      const elements = [];
      const selectors = ['button', 'input', 'select', 'textarea', 'a[href]', '[onclick]', '[role="button"]'];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { // Only visible elements
            elements.push({
              tagName: el.tagName.toLowerCase(),
              id: el.id,
              className: el.className,
              text: el.textContent?.trim().substring(0, 50) || '',
              selector: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`,
              position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
          }
        });
      });
      
      return elements;
    });
  }

  /**
   * Utility function to sanitize filename
   */
  sanitizeFilename(str) {
    return str.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    if (this.browser) {
      await this.saveActionLog();
      await this.saveIntegrationMap();
      await this.browser.close();
      console.log('🏁 UI Controller closed');
    }
  }
}

export default UIController;