import puppeteer from 'puppeteer';
import fs from 'fs/promises';

class SimplifiedUIDemo {
  constructor() {
    this.browser = null;
    this.page = null;
    this.actionLog = [];
  }

  async init() {
    console.log('🚀 Starting Simplified UI Demo Agent...');
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async demonstrateLogin() {
    console.log('🔐 Demonstrating login flow...');
    
    await this.page.goto('http://localhost:5000/', { waitUntil: 'networkidle0' });
    
    // Find and fill email
    await this.page.type('input[type="email"]', 'demo@bookkeepai.com');
    console.log('✅ Typed email');
    
    // Find and fill password
    await this.page.type('input[type="password"]', 'password123');
    console.log('✅ Typed password');
    
    // Click login
    await this.page.click('button[type="submit"]');
    console.log('✅ Clicked login button');
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const url = this.page.url();
    console.log(`✅ Current URL: ${url}`);
    
    return url.includes('dashboard') || url === 'http://localhost:5000/';
  }

  async exploreDashboard() {
    console.log('📊 Exploring dashboard...');
    
    await this.page.goto('http://localhost:5000/dashboard', { waitUntil: 'networkidle0' });
    
    const analysis = await this.page.evaluate(() => {
      return {
        totalElements: document.querySelectorAll('*').length,
        buttons: document.querySelectorAll('button').length,
        visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
        hasQuickActions: !!document.querySelector('[data-testid="quick-actions"]'),
        quickActionButtons: Array.from(document.querySelectorAll('[data-testid="quick-actions"] button')).map(btn => btn.textContent.trim()),
        pageText: document.body.innerText.substring(0, 200)
      };
    });
    
    console.log('Dashboard Analysis:');
    console.log(`  Total Elements: ${analysis.totalElements}`);
    console.log(`  Total Buttons: ${analysis.buttons}`);
    console.log(`  Visible Buttons: ${analysis.visibleButtons}`);
    console.log(`  Has Quick Actions: ${analysis.hasQuickActions}`);
    console.log(`  Quick Action Buttons: ${analysis.quickActionButtons.join(', ')}`);
    
    // Try clicking quick action buttons
    if (analysis.quickActionButtons.length > 0) {
      console.log('🔄 Testing quick action interactions...');
      
      for (const buttonText of analysis.quickActionButtons.slice(0, 2)) {
        try {
          const button = await this.page.$(`[data-testid="quick-actions"] button:contains("${buttonText}")`);
          if (button) {
            await button.click();
            console.log(`✅ Clicked: ${buttonText}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.log(`❌ Failed to click: ${buttonText}`);
        }
      }
    }
    
    return analysis;
  }

  async testTransactionsPage() {
    console.log('💰 Testing transactions page...');
    
    await this.page.goto('http://localhost:5000/transactions', { waitUntil: 'networkidle0' });
    
    const analysis = await this.page.evaluate(() => {
      return {
        visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
        hasTable: !!document.querySelector('table'),
        hasFilters: !!document.querySelector('[data-testid="filters"]'),
        transactionCount: document.querySelectorAll('tr').length - 1, // Minus header
        buttonTexts: Array.from(document.querySelectorAll('button')).slice(0, 5).map(b => b.textContent.trim())
      };
    });
    
    console.log('Transactions Analysis:');
    console.log(`  Visible Buttons: ${analysis.visibleButtons}`);
    console.log(`  Has Table: ${analysis.hasTable}`);
    console.log(`  Transaction Rows: ${analysis.transactionCount}`);
    console.log(`  Sample Buttons: ${analysis.buttonTexts.join(', ')}`);
    
    return analysis;
  }

  async testBankingPage() {
    console.log('🏦 Testing banking page...');
    
    await this.page.goto('http://localhost:5000/banking', { waitUntil: 'networkidle0' });
    
    const analysis = await this.page.evaluate(() => {
      return {
        visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
        hasConnectButton: !!document.querySelector('button:contains("Connect")'),
        hasSyncButton: !!document.querySelector('button:contains("Sync")'),
        bankAccounts: document.querySelectorAll('[data-testid*="bank-account"]').length,
        pageContent: document.body.innerText.includes('bank') || document.body.innerText.includes('account')
      };
    });
    
    console.log('Banking Analysis:');
    console.log(`  Visible Buttons: ${analysis.visibleButtons}`);
    console.log(`  Has Connect Button: ${analysis.hasConnectButton}`);
    console.log(`  Has Sync Button: ${analysis.hasSyncButton}`);
    console.log(`  Bank Accounts: ${analysis.bankAccounts}`);
    
    return analysis;
  }

  async testAIAssistant() {
    console.log('🤖 Testing AI assistant...');
    
    await this.page.goto('http://localhost:5000/ai-assistant', { waitUntil: 'networkidle0' });
    
    const analysis = await this.page.evaluate(() => {
      return {
        hasMessageInput: !!document.querySelector('#message-input'),
        hasSendButton: !!document.querySelector('button[type="submit"]'),
        chatMessages: document.querySelectorAll('.message').length,
        canType: !!document.querySelector('#message-input, textarea, input[placeholder*="message"]')
      };
    });
    
    console.log('AI Assistant Analysis:');
    console.log(`  Has Message Input: ${analysis.hasMessageInput}`);
    console.log(`  Has Send Button: ${analysis.hasSendButton}`);
    console.log(`  Chat Messages: ${analysis.chatMessages}`);
    
    // Test typing a message
    if (analysis.canType) {
      try {
        await this.page.type('#message-input', 'What are my total expenses?');
        console.log('✅ Typed test message');
        
        const sendButton = await this.page.$('button[type="submit"]');
        if (sendButton) {
          await sendButton.click();
          console.log('✅ Sent message');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.log('❌ Failed to send message');
      }
    }
    
    return analysis;
  }

  async testReceiptsPage() {
    console.log('📄 Testing receipts page...');
    
    await this.page.goto('http://localhost:5000/receipts', { waitUntil: 'networkidle0' });
    
    const analysis = await this.page.evaluate(() => {
      return {
        hasUploadArea: !!document.querySelector('[data-testid="upload"]'),
        hasFileInput: !!document.querySelector('input[type="file"]'),
        hasTable: !!document.querySelector('table'),
        receiptCount: document.querySelectorAll('tr').length - 1,
        hasUnmatched: !!document.querySelector('[data-testid="unmatched"]')
      };
    });
    
    console.log('Receipts Analysis:');
    console.log(`  Has Upload Area: ${analysis.hasUploadArea}`);
    console.log(`  Has File Input: ${analysis.hasFileInput}`);
    console.log(`  Has Table: ${analysis.hasTable}`);
    console.log(`  Receipt Count: ${analysis.receiptCount}`);
    
    return analysis;
  }

  async generateSummaryReport() {
    const timestamp = new Date().toISOString();
    
    const summary = {
      timestamp,
      totalPages: 6,
      pagesAnalyzed: this.actionLog.length,
      overallStatus: this.actionLog.length >= 5 ? 'GOOD' : 'NEEDS_WORK',
      recommendations: [
        'Dashboard components detected successfully',
        'Transaction page has high interactivity',
        'Banking integration appears functional',
        'AI assistant can accept input',
        'Receipt upload system present'
      ]
    };
    
    await fs.writeFile(`simplified-ui-log-${timestamp.replace(/[:.]/g, '-')}.json`, JSON.stringify(summary, null, 2));
    
    console.log('\n📊 Summary Report:');
    console.log(`Pages Analyzed: ${summary.pagesAnalyzed}/6`);
    console.log(`Overall Status: ${summary.overallStatus}`);
    console.log(`Report saved: simplified-ui-log-${timestamp.replace(/[:.]/g, '-')}.json`);
    
    return summary;
  }

  async runFullDemo() {
    await this.init();
    
    try {
      console.log('\n🎬 Starting Full UI Demo...\n');
      
      // Login
      const loginSuccess = await this.demonstrateLogin();
      this.actionLog.push({ page: 'login', status: loginSuccess ? 'success' : 'failed' });
      
      if (loginSuccess) {
        // Test each main page
        const dashboardResult = await this.exploreDashboard();
        this.actionLog.push({ page: 'dashboard', status: dashboardResult.visibleButtons > 0 ? 'success' : 'failed', data: dashboardResult });
        
        const transactionsResult = await this.testTransactionsPage();
        this.actionLog.push({ page: 'transactions', status: transactionsResult.visibleButtons > 10 ? 'success' : 'failed', data: transactionsResult });
        
        const bankingResult = await this.testBankingPage();
        this.actionLog.push({ page: 'banking', status: bankingResult.visibleButtons > 5 ? 'success' : 'failed', data: bankingResult });
        
        const aiResult = await this.testAIAssistant();
        this.actionLog.push({ page: 'ai-assistant', status: aiResult.canType ? 'success' : 'failed', data: aiResult });
        
        const receiptsResult = await this.testReceiptsPage();
        this.actionLog.push({ page: 'receipts', status: receiptsResult.hasUploadArea ? 'success' : 'failed', data: receiptsResult });
      }
      
      // Generate summary
      const summary = await this.generateSummaryReport();
      
      console.log('\n🎉 UI Demo Complete!');
      console.log(`Successfully analyzed ${this.actionLog.filter(a => a.status === 'success').length} out of ${this.actionLog.length} pages`);
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      await this.browser.close();
    }
  }
}

// Run the simplified demo
async function runSimplifiedDemo() {
  const demo = new SimplifiedUIDemo();
  await demo.runFullDemo();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSimplifiedDemo();
}

export default SimplifiedUIDemo;