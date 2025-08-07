// Test and Fix Scrolling Issue - Comprehensive Analysis
import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';

class ScrollingTestFixer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.issues = [];
    this.fixes = [];
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1200, height: 800 }
    });
    this.page = await this.browser.newPage();
  }

  async testScrolling() {
    console.log('🔍 Testing Scrolling Issues...');

    try {
      // Navigate to transactions page
      await this.page.goto('http://localhost:5000/transactions', { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      // Take screenshot before scrolling
      await this.page.screenshot({ path: 'before-scroll-test.png', fullPage: true });

      // Check current scroll state
      const initialScroll = await this.page.evaluate(() => {
        const container = document.querySelector('[data-testid="transactions"]');
        const cardContent = container?.querySelector('.overflow-y-auto');
        
        return {
          hasContainer: !!container,
          hasScrollableContent: !!cardContent,
          containerHeight: container?.offsetHeight || 0,
          contentHeight: cardContent?.scrollHeight || 0,
          isScrollable: (cardContent?.scrollHeight || 0) > (cardContent?.offsetHeight || 0),
          currentScrollTop: cardContent?.scrollTop || 0,
          containerClasses: container?.className || '',
          contentClasses: cardContent?.className || ''
        };
      });

      console.log('📊 Initial Scroll Analysis:', initialScroll);

      // Try to scroll in the container
      const scrollTest = await this.page.evaluate(() => {
        const cardContent = document.querySelector('[data-testid="transactions"] .overflow-y-auto');
        if (cardContent) {
          const beforeScroll = cardContent.scrollTop;
          cardContent.scrollTop += 500;
          const afterScroll = cardContent.scrollTop;
          
          return {
            beforeScroll,
            afterScroll,
            scrolled: afterScroll > beforeScroll,
            maxScroll: cardContent.scrollHeight - cardContent.offsetHeight
          };
        }
        return { error: 'No scrollable container found' };
      });

      console.log('📜 Scroll Test Result:', scrollTest);

      // Take screenshot after scroll attempt
      await this.page.screenshot({ path: 'after-scroll-test.png', fullPage: true });

      // Check for CSS issues preventing scrolling
      const cssIssues = await this.page.evaluate(() => {
        const issues = [];
        const container = document.querySelector('[data-testid="transactions"]');
        const cardContent = container?.querySelector('.overflow-y-auto');
        
        if (!container) {
          issues.push('No transactions container found');
          return issues;
        }

        const containerStyles = window.getComputedStyle(container);
        const contentStyles = cardContent ? window.getComputedStyle(cardContent) : null;

        // Check for common scrolling blockers
        if (containerStyles.overflow === 'hidden') issues.push('Container has overflow:hidden');
        if (containerStyles.height === 'auto') issues.push('Container height is auto');
        if (!contentStyles) issues.push('No scrollable content area found');
        if (contentStyles && contentStyles.maxHeight === 'none') issues.push('Content has no max-height');

        // Check parent containers
        let parent = container.parentElement;
        while (parent && parent !== document.body) {
          const parentStyles = window.getComputedStyle(parent);
          if (parentStyles.overflow === 'hidden') {
            issues.push(`Parent ${parent.className} has overflow:hidden`);
          }
          parent = parent.parentElement;
        }

        return issues;
      });

      this.issues = cssIssues;
      console.log('🐛 CSS Issues Found:', cssIssues);

      // Generate fix recommendations
      await this.generateFixes();

    } catch (error) {
      console.error('❌ Scrolling test failed:', error);
    }
  }

  async generateFixes() {
    console.log('🔧 Generating Fixes...');

    const fixRecommendations = [];

    if (this.issues.includes('Container has overflow:hidden')) {
      fixRecommendations.push('Change container overflow from hidden to auto');
    }

    if (this.issues.includes('Container height is auto')) {
      fixRecommendations.push('Set explicit height on container using flex or viewport units');
    }

    if (this.issues.includes('No scrollable content area found')) {
      fixRecommendations.push('Add proper scrollable content wrapper with overflow-y-auto');
    }

    if (this.issues.includes('Content has no max-height')) {
      fixRecommendations.push('Set max-height on scrollable content area');
    }

    // Check if we need to fix the actual CSS
    if (this.issues.length > 0) {
      await this.applyScrollingFixes();
    }

    this.fixes = fixRecommendations;
  }

  async applyScrollingFixes() {
    console.log('🛠️  Applying CSS Fixes...');

    try {
      // Read the current transactions page
      let content = await fs.readFile('client/src/pages/transactions.tsx', 'utf8');
      
      // Apply height and overflow fixes
      if (content.includes('min-h-screen max-h-screen flex flex-col overflow-hidden')) {
        // Already has our fixes
        console.log('✓ Height fixes already applied');
      } else {
        content = content.replace(
          /className="p-6 space-y-6[^"]*"/,
          'className="p-6 space-y-6 h-screen flex flex-col overflow-hidden"'
        );
      }

      // Ensure the card has proper flex layout
      if (content.includes('flex-1 flex flex-col min-h-0')) {
        console.log('✓ Card flex fixes already applied');
      } else {
        content = content.replace(
          /className="flex-1 overflow-hidden"/,
          'className="flex-1 flex flex-col min-h-0"'
        );
      }

      // Ensure CardContent has proper scrolling
      if (content.includes('flex-1 overflow-y-auto min-h-0')) {
        console.log('✓ Content scrolling fixes already applied');
      } else {
        content = content.replace(
          /className="p-0 overflow-auto"/,
          'className="p-0 flex-1 overflow-y-auto min-h-0"'
        );
      }

      await fs.writeFile('client/src/pages/transactions.tsx', content, 'utf8');
      console.log('✅ Applied scrolling fixes to transactions.tsx');

    } catch (error) {
      console.error('❌ Failed to apply fixes:', error);
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    await this.init();
    await this.testScrolling();
    await this.cleanup();

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      issues: this.issues,
      fixes: this.fixes,
      summary: `Found ${this.issues.length} scrolling issues, applied ${this.fixes.length} fixes`
    };

    await fs.writeFile('scrolling-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n📊 SCROLLING TEST REPORT:');
    console.log(`🐛 Issues found: ${this.issues.length}`);
    console.log(`🔧 Fixes applied: ${this.fixes.length}`);
    
    if (this.issues.length > 0) {
      console.log('\n🐛 Issues:');
      this.issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

    if (this.fixes.length > 0) {
      console.log('\n🔧 Fixes:');
      this.fixes.forEach((fix, i) => console.log(`  ${i + 1}. ${fix}`));
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ScrollingTestFixer();
  tester.run().catch(console.error);
}

export default ScrollingTestFixer;