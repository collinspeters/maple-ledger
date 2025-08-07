import puppeteer from 'puppeteer';

async function debugTransactionDisplay() {
  console.log('🔍 Debug Transaction Display - Direct Visual Inspection');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Capture all console output for debugging
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
  });

  try {
    // Login
    console.log('🔐 Logging in to inspect transactions...');
    await page.goto('http://localhost:5000/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'demo@bookkeepai.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect and dashboard to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Navigate to transactions page
    console.log('📊 Navigating to transactions page...');
    await page.goto('http://localhost:5000/transactions');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for everything to load

    // Take screenshot
    await page.screenshot({ path: 'debug-transactions.png', fullPage: true });

    // Analyze what's actually on the page
    const pageAnalysis = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        pageTitle: document.title,
        hasMainContent: !!document.querySelector('main, .main, [role="main"]'),
        hasTransactionTable: !!document.querySelector('table'),
        hasTransactionRows: document.querySelectorAll('tr, .transaction-row').length,
        hasErrorMessage: document.body.innerText.includes('Error') || document.body.innerText.includes('error'),
        hasNoTransactionsMessage: document.body.innerText.includes('No transactions found'),
        hasLoginRequired: document.body.innerText.includes('Authentication required') || document.body.innerText.includes('Login'),
        transactionCount: document.querySelectorAll('[data-testid="transaction-row"], tr').length,
        debugInfo: document.querySelector('.text-red-500')?.innerText || 'No debug info found',
        visibleText: document.body.innerText.substring(0, 500),
        allHeadings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText),
        hasFilters: !!document.querySelector('[data-testid="filters"]'),
        selectCount: document.querySelectorAll('select').length,
        buttonCount: document.querySelectorAll('button').length
      };
      
      // Check for specific elements
      const transactionCard = document.querySelector('[data-testid="transactions"]');
      if (transactionCard) {
        results.transactionCardContent = transactionCard.innerText.substring(0, 200);
      }
      
      return results;
    });

    console.log('\n📊 TRANSACTION PAGE ANALYSIS:');
    console.log('================================');
    console.log(`URL: ${pageAnalysis.url}`);
    console.log(`Page Title: ${pageAnalysis.pageTitle}`);
    console.log(`Has Transaction Table: ${pageAnalysis.hasTransactionTable}`);
    console.log(`Transaction Rows: ${pageAnalysis.hasTransactionRows}`);
    console.log(`Debug Info: ${pageAnalysis.debugInfo}`);
    console.log(`Error Message: ${pageAnalysis.hasErrorMessage}`);
    console.log(`No Transactions Message: ${pageAnalysis.hasNoTransactionsMessage}`);
    console.log(`Login Required: ${pageAnalysis.hasLoginRequired}`);
    console.log('\nVisible Text Preview:');
    console.log('--------------------');
    console.log(pageAnalysis.visibleText);
    
    if (pageAnalysis.transactionCardContent) {
      console.log('\nTransaction Card Content:');
      console.log('-------------------------');
      console.log(pageAnalysis.transactionCardContent);
    }

    // Check if there are console errors about Select components
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n✅ Debug complete. Screenshot saved as debug-transactions.png');
    return pageAnalysis;

  } catch (error) {
    console.error('💥 Debug failed:', error);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debugTransactionDisplay().catch(console.error);