import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

class OptimizedInteractiveAgent {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.config = {
      headless: options.headless || false,
      timeout: options.timeout || 10000,
      retryAttempts: options.retryAttempts || 3,
      viewport: { width: 1920, height: 1080 },
      baseUrl: options.baseUrl || 'http://localhost:5000',
      credentials: options.credentials || {
        email: 'demo@bookkeepai.com',
        password: 'password123'
      },
      ...options
    };
    
    this.sessionData = {
      cookies: null,
      authenticated: false,
      sessionId: null
    };
    
    this.metrics = {
      startTime: Date.now(),
      pageLoadTimes: [],
      actionCounts: {},
      errors: [],
      screenshots: []
    };
    
    this.cache = new Map();
  }

  async init() {
    console.log('🚀 Initializing Optimized Interactive Agent...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        defaultViewport: this.config.viewport,
        executablePath: process.env.CHROME_BIN || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport(this.config.viewport);
      
      // Optimize page settings
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        // Block unnecessary resources for faster loading
        const resourceType = req.resourceType();
        if (['font', 'media', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Enhanced error handling
      this.page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        
        if (type === 'error') {
          this.metrics.errors.push({ type: 'console', message: text, timestamp: Date.now() });
          console.log(`🔴 [BROWSER ERROR] ${text}`);
        } else if (type === 'warn') {
          console.log(`🟡 [BROWSER WARN] ${text}`);
        }
      });

      this.page.on('pageerror', error => {
        this.metrics.errors.push({ type: 'page', message: error.message, timestamp: Date.now() });
        console.log(`🔴 [PAGE ERROR] ${error.message}`);
      });

      this.page.on('response', response => {
        const loadTime = response.timing()?.receiveHeadersEnd || 0;
        if (loadTime > 0) {
          this.metrics.pageLoadTimes.push(loadTime);
        }
      });

      console.log('✅ Optimized Interactive Agent initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize agent:', error.message);
      throw error;
    }
  }

  async authenticateAPI() {
    console.log('🔐 Authenticating via optimized API flow...');
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OptimizedAgent/1.0'
        },
        body: JSON.stringify(this.config.credentials)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        const sessionMatch = setCookieHeader.match(/connect\.sid=([^;]+)/);
        if (sessionMatch) {
          this.sessionData.cookies = [{
            name: 'connect.sid',
            value: sessionMatch[1],
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax'
          }];
          
          this.sessionData.authenticated = true;
          this.sessionData.sessionId = sessionMatch[1];
          console.log('✅ API authentication successful');
          return true;
        }
      }
      
      throw new Error('No session cookie received');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      this.metrics.errors.push({ type: 'auth', message: error.message, timestamp: Date.now() });
      return false;
    }
  }

  async injectSession() {
    if (!this.sessionData.cookies) {
      throw new Error('No session data available for injection');
    }

    try {
      await this.page.setCookie(...this.sessionData.cookies);
      console.log('✅ Session injected successfully');
      return true;
    } catch (error) {
      console.error('❌ Session injection failed:', error.message);
      return false;
    }
  }

  async navigateWithRetry(url, retries = 3) {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔗 Navigate attempt ${attempt}/${retries}: ${fullUrl}`);
        
        const startTime = Date.now();
        await this.page.goto(fullUrl, { 
          waitUntil: 'networkidle0',
          timeout: this.config.timeout 
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`✅ Page loaded in ${loadTime}ms`);
        
        this.incrementMetric('navigation');
        return true;
      } catch (error) {
        console.log(`⚠️ Navigation attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === retries) {
          this.metrics.errors.push({ type: 'navigation', message: error.message, timestamp: Date.now() });
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  async takeOptimizedScreenshot(description = '', options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `optimized-agent-${timestamp}.png`;
      const filepath = path.join('agent-screenshots', filename);
      
      await fs.mkdir('agent-screenshots', { recursive: true });
      
      const screenshotOptions = {
        path: filepath,
        fullPage: options.fullPage || false,
        quality: options.quality || 80,
        type: 'png',
        ...options
      };
      
      await this.page.screenshot(screenshotOptions);
      
      this.metrics.screenshots.push({ filename, description, timestamp: Date.now() });
      console.log(`📸 Optimized screenshot: ${filename} - ${description}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Screenshot failed:', error.message);
      return null;
    }
  }

  async waitForElementOptimized(selector, options = {}) {
    const timeout = options.timeout || this.config.timeout;
    const visible = options.visible !== false;
    
    try {
      if (visible) {
        await this.page.waitForSelector(selector, { visible: true, timeout });
      } else {
        await this.page.waitForSelector(selector, { timeout });
      }
      
      this.incrementMetric('element_wait_success');
      return true;
    } catch (error) {
      this.incrementMetric('element_wait_failure');
      console.log(`⚠️ Element not found: ${selector} (timeout: ${timeout}ms)`);
      return false;
    }
  }

  async analyzePagePerformance() {
    try {
      const metrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        return {
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
          loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
          domElements: document.querySelectorAll('*').length,
          interactiveElements: document.querySelectorAll('button, input, select, textarea, [onclick], [role="button"]').length
        };
      });
      
      console.log('📊 Page Performance Metrics:', metrics);
      return metrics;
    } catch (error) {
      console.error('❌ Performance analysis failed:', error.message);
      return null;
    }
  }

  async getPageInfo() {
    const cacheKey = this.page.url();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const info = await this.page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          readyState: document.readyState,
          elementsCount: document.querySelectorAll('*').length,
          interactiveElements: Array.from(document.querySelectorAll('button, input, select, textarea, [onclick], [role="button"]')).length,
          forms: document.forms.length,
          links: document.links.length,
          errors: window.console?.errors || []
        };
      });
      
      this.cache.set(cacheKey, info);
      return info;
    } catch (error) {
      console.error('❌ Failed to get page info:', error.message);
      return null;
    }
  }

  async runComprehensiveTest() {
    console.log('🔍 Starting comprehensive optimized test...');
    
    const testResults = {
      startTime: Date.now(),
      pages: [],
      totalErrors: 0,
      performance: {},
      recommendations: []
    };

    try {
      // Step 1: Authentication
      const authSuccess = await this.authenticateAPI();
      if (!authSuccess) {
        testResults.recommendations.push('Fix authentication issues before proceeding');
        return testResults;
      }

      // Step 2: Test key pages
      const pagesToTest = [
        { path: '/', name: 'Landing Page' },
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/transactions', name: 'Transactions' },
        { path: '/banking', name: 'Banking' },
        { path: '/assistant', name: 'AI Assistant' },
        { path: '/receipts', name: 'Receipts' },
        { path: '/reports', name: 'Reports' }
      ];

      await this.injectSession();

      for (const pageTest of pagesToTest) {
        console.log(`🧪 Testing ${pageTest.name}...`);
        
        try {
          await this.navigateWithRetry(pageTest.path);
          await this.waitForElementOptimized('body', { timeout: 5000 });
          
          const pageInfo = await this.getPageInfo();
          const performance = await this.analyzePagePerformance();
          const screenshot = await this.takeOptimizedScreenshot(`Test ${pageTest.name}`);
          
          const pageResult = {
            name: pageTest.name,
            path: pageTest.path,
            success: true,
            info: pageInfo,
            performance,
            screenshot,
            errors: this.metrics.errors.filter(e => e.timestamp > testResults.startTime).length
          };
          
          testResults.pages.push(pageResult);
          console.log(`✅ ${pageTest.name} test completed`);
          
        } catch (error) {
          console.log(`❌ ${pageTest.name} test failed: ${error.message}`);
          testResults.pages.push({
            name: pageTest.name,
            path: pageTest.path,
            success: false,
            error: error.message
          });
        }
      }

      // Step 3: Generate performance report
      testResults.performance = {
        averageLoadTime: this.metrics.pageLoadTimes.reduce((a, b) => a + b, 0) / this.metrics.pageLoadTimes.length || 0,
        totalErrors: this.metrics.errors.length,
        totalScreenshots: this.metrics.screenshots.length,
        testDuration: Date.now() - testResults.startTime
      };

      // Step 4: Generate recommendations
      if (testResults.performance.averageLoadTime > 3000) {
        testResults.recommendations.push('Page load times are slow (>3s) - consider optimizing bundle size');
      }
      
      if (testResults.performance.totalErrors > 5) {
        testResults.recommendations.push('High error count detected - review console errors');
      }
      
      const successfulPages = testResults.pages.filter(p => p.success).length;
      const successRate = (successfulPages / testResults.pages.length) * 100;
      
      if (successRate < 90) {
        testResults.recommendations.push('Page success rate below 90% - investigate navigation issues');
      }

      testResults.endTime = Date.now();
      console.log(`🎯 Comprehensive test completed: ${successRate.toFixed(1)}% success rate`);
      
      return testResults;
      
    } catch (error) {
      console.error('❌ Comprehensive test failed:', error.message);
      testResults.error = error.message;
      testResults.endTime = Date.now();
      return testResults;
    }
  }

  incrementMetric(key) {
    this.metrics.actionCounts[key] = (this.metrics.actionCounts[key] || 0) + 1;
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      sessionInfo: this.sessionData,
      performance: {
        totalDuration: Date.now() - this.metrics.startTime,
        averageLoadTime: this.metrics.pageLoadTimes.reduce((a, b) => a + b, 0) / this.metrics.pageLoadTimes.length || 0,
        totalActions: Object.values(this.metrics.actionCounts).reduce((a, b) => a + b, 0),
        errorRate: this.metrics.errors.length / (Object.values(this.metrics.actionCounts).reduce((a, b) => a + b, 0) || 1)
      },
      errors: this.metrics.errors,
      screenshots: this.metrics.screenshots,
      recommendations: []
    };

    // Generate performance recommendations
    if (report.performance.averageLoadTime > 2000) {
      report.recommendations.push('Optimize page load times (currently >2s)');
    }
    
    if (report.performance.errorRate > 0.1) {
      report.recommendations.push('High error rate detected - review error handling');
    }

    const reportPath = `optimized-agent-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Performance report saved: ${reportPath}`);
    
    return report;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Optimized agent closed successfully');
    }
  }
}

// Usage function
async function runOptimizedAgentTest() {
  const agent = new OptimizedInteractiveAgent({
    headless: false,
    timeout: 8000,
    retryAttempts: 2
  });

  try {
    await agent.init();
    const testResults = await agent.runComprehensiveTest();
    const report = await agent.generateReport();
    
    console.log('\n🎯 OPTIMIZED AGENT TEST SUMMARY:');
    console.log(`✅ Pages tested: ${testResults.pages?.length || 0}`);
    console.log(`✅ Success rate: ${testResults.pages ? (testResults.pages.filter(p => p.success).length / testResults.pages.length * 100).toFixed(1) : 0}%`);
    console.log(`⚡ Average load time: ${report.performance.averageLoadTime.toFixed(0)}ms`);
    console.log(`🔥 Total errors: ${report.errors.length}`);
    console.log(`📸 Screenshots taken: ${report.screenshots.length}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
    
    return testResults;
  } catch (error) {
    console.error('❌ Optimized agent test failed:', error);
    throw error;
  } finally {
    await agent.close();
  }
}

export default OptimizedInteractiveAgent;
export { runOptimizedAgentTest };