// Quick test to verify login functionality works despite console errors
import puppeteer from 'puppeteer';

async function testLogin() {
  console.log('Testing login functionality...');
  
  let browser, page;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Suppress console errors to focus on functionality
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('DOMException')) {
        console.log('Page error:', msg.text());
      }
    });
    
    console.log('Navigating to application...');
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 10000 });
    
    console.log('Filling login form...');
    await page.type('input[type="email"], input[name="username"]', 'demo@bookkeepai.com');
    await page.type('input[type="password"], input[name="password"]', 'password123');
    
    // Find and click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation or page change
    await page.waitForTimeout(3000);
    
    // Check if we're redirected (successful login)
    const currentUrl = page.url();
    console.log('Current URL after login attempt:', currentUrl);
    
    // Take screenshot of result
    await page.screenshot({ 
      path: 'login-test-result.png',
      fullPage: false
    });
    
    // Check for success indicators
    const dashboardElements = await page.$('.dashboard, [data-testid="dashboard"], main');
    const loginError = await page.$('.error, .alert-error, [role="alert"]');
    
    if (dashboardElements && !loginError) {
      console.log('✅ Login successful - application is working!');
    } else if (loginError) {
      const errorText = await loginError.evaluate(el => el.textContent);
      console.log('⚠️ Login error:', errorText);
    } else {
      console.log('📝 Login form still visible - checking page state...');
    }
    
    console.log('✅ Test completed - check login-test-result.png for visual confirmation');
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testLogin();