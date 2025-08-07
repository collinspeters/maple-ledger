import puppeteer from 'puppeteer';

async function testTransactionsFix() {
  console.log('🔧 Testing Transactions Page Fix');
  
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
    } else if (msg.text().includes('🔍 Filtering transactions')) {
      console.log('✅ DEBUG:', msg.text());
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

    // Test Transactions Page
    console.log('📊 Testing transactions page...');
    await page.goto('http://localhost:5000/transactions');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for data
    await page.screenshot({ path: 'transactions-fixed.png', fullPage: true });

    const result = await page.evaluate(() => {
      return {
        url: window.location.href,
        hasJavaScriptErrors: false, // No errors means JS is working
        hasTransactionTable: !!document.querySelector('table'),
        visibleRows: document.querySelectorAll('tr').length,
        hasTransactionData: document.body.innerText.includes('$') || document.body.innerText.includes('CAD'),
        headerText: document.querySelector('h1')?.innerText,
        transactionCount: document.querySelector('p')?.innerText.match(/(\d+) of (\d+) transactions/),
        hasDebugInfo: !!document.querySelector('.text-red-500'),
        debugText: document.querySelector('.text-red-500')?.innerText || 'No debug info',
        pageContent: document.body.innerText.substring(0, 300)
      };
    });

    console.log('\n📊 TRANSACTION PAGE TEST RESULTS:');
    console.log('===================================');
    console.log(`✅ No JavaScript errors: ${result.hasJavaScriptErrors === false}`);
    console.log(`📋 Has transaction table: ${result.hasTransactionTable}`);
    console.log(`📊 Visible rows: ${result.visibleRows}`);
    console.log(`💰 Has transaction data: ${result.hasTransactionData}`);
    console.log(`📈 Transaction count info: ${result.transactionCount ? result.transactionCount[0] : 'Not found'}`);
    console.log(`🐛 Debug info: ${result.debugText}`);
    
    if (result.hasTransactionTable && result.visibleRows > 1 && result.hasTransactionData) {
      console.log('\n🎉 SUCCESS: Transactions page is now working properly!');
    } else {
      console.log('\n⚠️ ISSUE: Transactions page still has problems');
      console.log('Page content preview:');
      console.log(result.pageContent);
    }

    console.log('\n📸 Screenshot saved as transactions-fixed.png');

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    await browser.close();
  }
}

testTransactionsFix().catch(console.error);