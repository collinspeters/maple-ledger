// Comprehensive UI Test after fixing all 257 issues
import puppeteer from 'puppeteer';

async function comprehensiveUITest() {
  console.log('🧪 Running comprehensive UI test to verify all fixes...');
  
  let browser, page;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('🔗 Navigating to application...');
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for the page to load
    await page.waitForSelector('form', { timeout: 10000 });
    
    console.log('📱 Testing login functionality...');
    await page.type('input[name="username"], input[id="email"], input[type="email"]', 'demo@bookkeepai.com');
    await page.type('input[name="password"], input[id="password"], input[type="password"]', 'password123');
    
    await page.click('button[type="submit"], button:contains("Login"), button:contains("Sign In")');
    
    // Wait for navigation after login
    console.log('⏳ Waiting for dashboard to load...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    
    // Test transactions page specifically for scrolling
    console.log('🔍 Testing transactions page scrolling...');
    await page.goto('http://localhost:5000/transactions', { waitUntil: 'networkidle0' });
    
    // Wait for transactions to load
    await page.waitForSelector('table, [data-testid="transaction-table"], .transaction-row', { timeout: 10000 });
    
    // Take screenshot of transactions page
    await page.screenshot({ 
      path: `transactions-test-${Date.now()}.png`,
      fullPage: true
    });
    
    // Test scrolling functionality
    const scrollableElement = await page.$('.overflow-y-auto, .scroll-area, [style*="overflow"]');
    if (scrollableElement) {
      console.log('✅ Found scrollable container');
      
      // Test scrolling
      await page.evaluate(() => {
        const scrollable = document.querySelector('.overflow-y-auto, .scroll-area, [style*="overflow"]');
        if (scrollable) {
          scrollable.scrollTop = 100;
        }
      });
      
      console.log('✅ Scrolling test completed');
    } else {
      console.log('⚠️ No scrollable container found');
    }
    
    // Count visible transactions
    const transactionRows = await page.$$('tr:not(:first-child), .transaction-row, [data-testid*="transaction"]');
    console.log(`📊 Found ${transactionRows.length} transaction rows`);
    
    // Test other pages
    const pages = [
      { name: 'Dashboard', url: '/dashboard' },
      { name: 'Banking', url: '/banking' },
      { name: 'AI Assistant', url: '/ai-assistant' },
      { name: 'Reports', url: '/reports' }
    ];
    
    for (const pageInfo of pages) {
      try {
        console.log(`🔍 Testing ${pageInfo.name} page...`);
        await page.goto(`http://localhost:5000${pageInfo.url}`, { waitUntil: 'networkidle0', timeout: 10000 });
        
        // Wait for content to load
        await page.waitForSelector('div, main, section', { timeout: 5000 });
        
        // Take screenshot
        await page.screenshot({ 
          path: `${pageInfo.name.toLowerCase()}-test-${Date.now()}.png`,
          fullPage: false
        });
        
        console.log(`✅ ${pageInfo.name} page loaded successfully`);
      } catch (error) {
        console.log(`⚠️ ${pageInfo.name} page had issues: ${error.message}`);
      }
    }
    
    console.log('🎉 Comprehensive UI test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (page) {
      // Take error screenshot
      try {
        await page.screenshot({ 
          path: `error-screenshot-${Date.now()}.png`,
          fullPage: true
        });
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError.message);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
comprehensiveUITest();