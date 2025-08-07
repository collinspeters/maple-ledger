const puppeteer = require('puppeteer');
const fs = require('fs');

async function comprehensiveUIErrorAnalysis() {
  console.log('🔍 Starting Comprehensive UI Error Analysis...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
  });
  
  page.on('pageerror', error => {
    console.log(`[BROWSER ERROR]`, error.message);
  });

  const errors = [];
  const screenshots = [];

  try {
    // Login first
    console.log('🔐 Logging in...');
    await page.goto('http://localhost:5000/login');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'demo@bookkeepai.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    const pages = [
      { name: 'dashboard', url: '/dashboard' },
      { name: 'transactions', url: '/transactions' },
      { name: 'banking', url: '/banking' },
      { name: 'ai-assistant', url: '/ai-assistant' },
      { name: 'receipts', url: '/receipts' },
      { name: 'reports', url: '/reports' }
    ];

    for (const testPage of pages) {
      console.log(`📊 Analyzing ${testPage.name}...`);
      
      try {
        await page.goto(`http://localhost:5000${testPage.url}`);
        await page.waitForTimeout(3000);

        // Take screenshot
        const screenshotPath = `ui-error-${testPage.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshots.push(screenshotPath);

        // Check for UI errors
        const pageErrors = await page.evaluate(() => {
          const errors = [];
          
          // Check for missing elements
          const missingElements = [];
          if (!document.querySelector('h1, h2, .title')) missingElements.push('Page title');
          if (!document.querySelector('nav, .navigation')) missingElements.push('Navigation');
          
          // Check for layout issues
          const layoutIssues = [];
          const overflowElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.overflow === 'visible' && el.scrollWidth > el.clientWidth;
          });
          if (overflowElements.length > 0) layoutIssues.push(`${overflowElements.length} elements with overflow`);
          
          // Check for console errors in page
          const consoleErrors = window.console._errors || [];
          
          // Check for broken buttons
          const brokenButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            return !btn.onclick && !btn.getAttribute('onclick') && 
                   !btn.closest('form') && !btn.getAttribute('type');
          });
          
          // Check for empty states
          const emptyElements = Array.from(document.querySelectorAll('.empty, .no-data, .placeholder')).length;
          
          return {
            missingElements,
            layoutIssues,
            brokenButtons: brokenButtons.length,
            emptyElements,
            consoleErrors: consoleErrors.length,
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 200)
          };
        });

        // Check for React errors
        const reactErrors = await page.evaluate(() => {
          return window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__?.errors || [];
        });

        errors.push({
          page: testPage.name,
          url: testPage.url,
          ...pageErrors,
          reactErrors: reactErrors.length,
          screenshot: screenshotPath
        });

        console.log(`${testPage.name} analysis complete:`, {
          layoutIssues: pageErrors.layoutIssues.length,
          brokenButtons: pageErrors.brokenButtons,
          missingElements: pageErrors.missingElements.length
        });

      } catch (error) {
        console.error(`Error analyzing ${testPage.name}:`, error.message);
        errors.push({
          page: testPage.name,
          url: testPage.url,
          criticalError: error.message
        });
      }
    }

    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        pagesAnalyzed: pages.length,
        totalErrors: errors.reduce((sum, err) => sum + (err.layoutIssues?.length || 0) + err.brokenButtons + (err.missingElements?.length || 0), 0),
        screenshotsTaken: screenshots.length
      },
      detailedErrors: errors,
      screenshots: screenshots,
      recommendations: []
    };

    // Generate recommendations
    errors.forEach(error => {
      if (error.layoutIssues?.length > 0) {
        report.recommendations.push(`Fix overflow issues on ${error.page}: ${error.layoutIssues.join(', ')}`);
      }
      if (error.brokenButtons > 0) {
        report.recommendations.push(`Fix ${error.brokenButtons} broken buttons on ${error.page}`);
      }
      if (error.missingElements?.length > 0) {
        report.recommendations.push(`Add missing elements on ${error.page}: ${error.missingElements.join(', ')}`);
      }
    });

    const reportPath = `ui-error-analysis-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📋 UI Error Analysis Complete!');
    console.log(`📊 Report saved: ${reportPath}`);
    console.log(`📸 Screenshots: ${screenshots.length}`);
    console.log(`🚨 Total UI Issues: ${report.summary.totalErrors}`);

    return report;

  } finally {
    await browser.close();
  }
}

// Run the analysis
comprehensiveUIErrorAnalysis().catch(console.error);