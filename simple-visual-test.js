import puppeteer from 'puppeteer';

async function visualTest() {
  console.log('🔍 Starting Simple Visual Test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Monitor errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ BROWSER ERROR:', msg.text());
    }
  });

  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto('http://localhost:5000/');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'demo@bookkeepai.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Test Dashboard
    console.log('🏠 Testing Dashboard...');
    await page.goto('http://localhost:5000/dashboard');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'dashboard-test.png', fullPage: true });

    const dashboardCheck = await page.evaluate(() => {
      return {
        hasContent: document.body.innerText.length > 100,
        cardCount: document.querySelectorAll('.card, [class*="card"]').length,
        buttonCount: document.querySelectorAll('button').length,
        visibleText: document.body.innerText.substring(0, 200)
      };
    });
    console.log('Dashboard check:', dashboardCheck);

    // Test Transactions
    console.log('📊 Testing Transactions...');
    await page.goto('http://localhost:5000/transactions');
    await page.waitForTimeout(5000); // Wait for data to load
    await page.screenshot({ path: 'transactions-test.png', fullPage: true });

    const transactionsCheck = await page.evaluate(() => {
      return {
        hasTable: !!document.querySelector('table, [role="table"]'),
        rowCount: document.querySelectorAll('tr, .transaction-row, [class*="transaction"]').length,
        hasFilters: !!document.querySelector('select, .filter'),
        selectCount: document.querySelectorAll('select').length,
        visibleText: document.body.innerText.substring(0, 300),
        hasSelectError: document.body.innerText.includes('Select.Item') || console.error.toString().includes('Select')
      };
    });
    console.log('Transactions check:', transactionsCheck);

    // Test scrolling
    console.log('📜 Testing scrolling...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'transactions-scrolled.png', fullPage: true });

    console.log('✅ Visual test complete!');
    console.log('📸 Screenshots saved: dashboard-test.png, transactions-test.png, transactions-scrolled.png');

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    await browser.close();
  }
}

visualTest().catch(console.error);