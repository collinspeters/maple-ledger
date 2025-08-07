import puppeteer from 'puppeteer';

async function identifyAndFixTransactionIssues() {
  console.log('🔧 Identifying and Fixing Transaction Display Issues');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Monitor all console logs for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🔍 Filtering transactions') || text.includes('🎯 After filtering')) {
      console.log(`📊 TRANSACTION DEBUG: ${text}`);
    } else if (msg.type() === 'error') {
      console.log(`❌ ERROR: ${text}`);
    }
  });

  try {
    // Step 1: Login
    console.log('🔐 Logging in...');
    await page.goto('http://localhost:5000/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'demo@bookkeepai.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('✅ Login successful');

    // Step 2: Navigate to transactions and monitor
    console.log('📊 Navigating to transactions page...');
    await page.goto('http://localhost:5000/transactions');
    await page.waitForLoadState('networkidle');
    
    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Step 3: Analyze the current state
    const pageState = await page.evaluate(() => {
      const result = {
        url: window.location.href,
        hasTable: !!document.querySelector('table'),
        tableRows: document.querySelectorAll('tr').length,
        bodyRows: document.querySelectorAll('tbody tr').length,
        hasTransactionData: false,
        hasDebugInfo: false,
        debugText: null,
        transactionCountText: null,
        pageContent: document.body.innerText.substring(0, 800),
        hasFilters: !!document.querySelector('[data-testid="filters"]'),
        filtersVisible: false,
        hasNoTransactionsMessage: false
      };

      // Check transaction count display
      const countElements = document.querySelectorAll('p');
      for (const el of countElements) {
        if (el.innerText.includes('transactions')) {
          result.transactionCountText = el.innerText;
          break;
        }
      }

      // Check for debug info
      const debugEl = document.querySelector('.text-red-500');
      if (debugEl) {
        result.hasDebugInfo = true;
        result.debugText = debugEl.innerText;
      }

      // Check if filters are visible
      const filtersContainer = document.querySelector('[data-testid="filters"]');
      if (filtersContainer) {
        result.filtersVisible = window.getComputedStyle(filtersContainer).display !== 'none';
      }

      // Check for no transactions message
      result.hasNoTransactionsMessage = document.body.innerText.includes('No transactions found');

      // Check if table has actual data
      const tableBody = document.querySelector('tbody');
      if (tableBody) {
        const rows = tableBody.querySelectorAll('tr');
        for (const row of rows) {
          if (row.innerText.includes('$') || row.innerText.includes('CAD') || 
              row.innerText.match(/\d{4}-\d{2}-\d{2}/)) {
            result.hasTransactionData = true;
            break;
          }
        }
      }

      return result;
    });

    console.log('\n📋 TRANSACTION PAGE ANALYSIS:');
    console.log('===============================');
    console.log(`URL: ${pageState.url}`);
    console.log(`Has table: ${pageState.hasTable}`);
    console.log(`Table rows: ${pageState.tableRows}`);
    console.log(`Body rows: ${pageState.bodyRows}`);
    console.log(`Has transaction data: ${pageState.hasTransactionData}`);
    console.log(`Transaction count: ${pageState.transactionCountText}`);
    console.log(`Has debug info: ${pageState.hasDebugInfo}`);
    console.log(`Debug text: ${pageState.debugText}`);
    console.log(`No transactions message: ${pageState.hasNoTransactionsMessage}`);

    // Step 4: Take screenshot
    await page.screenshot({ path: 'transaction-issue-analysis.png', fullPage: true });
    console.log('📸 Screenshot saved: transaction-issue-analysis.png');

    // Step 5: Try clicking filters button to see if that reveals more info
    if (pageState.hasFilters) {
      console.log('🎛️ Testing filters button...');
      await page.click('[data-testid="filters"]');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const afterFilters = await page.evaluate(() => {
        return {
          filtersVisible: !!document.querySelector('.filters') && 
                         window.getComputedStyle(document.querySelector('.filters')).display !== 'none',
          debugInfo: document.querySelector('.text-red-500')?.innerText || 'No debug info'
        };
      });
      
      console.log(`Filters now visible: ${afterFilters.filtersVisible}`);
      console.log(`Debug info: ${afterFilters.debugInfo}`);
    }

    // Step 6: Check browser console for any filtering debug info
    console.log('\n🔍 Waiting for console debug information...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n📊 SUMMARY:');
    if (pageState.hasTable && pageState.bodyRows === 0 && pageState.transactionCountText?.includes('615')) {
      console.log('🎯 ISSUE IDENTIFIED: Data is fetched (615 transactions) but table body is empty');
      console.log('🔧 LIKELY CAUSE: Filtering logic is removing all transactions');
    } else if (!pageState.hasTransactionData && pageState.hasNoTransactionsMessage) {
      console.log('🎯 ISSUE IDENTIFIED: "No transactions found" is showing despite data being available');
    } else {
      console.log('🤔 ISSUE UNCLEAR: Need to investigate further');
    }

  } catch (error) {
    console.error('💥 Analysis failed:', error);
  } finally {
    await browser.close();
  }
}

identifyAndFixTransactionIssues().catch(console.error);