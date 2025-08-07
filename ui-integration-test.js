import puppeteer from 'puppeteer';
import fs from 'fs/promises';

class UIIntegrationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
    this.integrationMap = {
      authentication: { status: 'unknown', details: {} },
      navigation: { status: 'unknown', details: {} },
      transactions: { status: 'unknown', details: {} },
      banking: { status: 'unknown', details: {} },
      aiAssistant: { status: 'unknown', details: {} },
      receipts: { status: 'unknown', details: {} },
      dashboard: { status: 'unknown', details: {} }
    };
  }

  async init() {
    console.log('🚀 Starting UI Integration Test Suite...');
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    this.page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
  }

  async testAuthentication() {
    console.log('🔐 Testing authentication flow...');
    
    try {
      await this.page.goto('http://localhost:5000/', { waitUntil: 'networkidle2' });
      
      // Test login form
      const emailInput = await this.page.$('input[type="email"]');
      const passwordInput = await this.page.$('input[type="password"]');
      const loginButton = await this.page.$('button[type="submit"]');
      
      if (!emailInput || !passwordInput || !loginButton) {
        throw new Error('Login form elements not found');
      }
      
      await emailInput.type('demo@bookkeepai.com');
      await passwordInput.type('password123');
      await loginButton.click();
      
      // Wait for redirect or navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = this.page.url();
      const isLoggedIn = currentUrl.includes('/dashboard') || currentUrl === 'http://localhost:5000/';
      
      this.integrationMap.authentication = {
        status: isLoggedIn ? 'working' : 'failed',
        details: {
          hasLoginForm: true,
          redirectUrl: currentUrl,
          loginSuccessful: isLoggedIn
        }
      };
      
      return isLoggedIn;
    } catch (error) {
      this.integrationMap.authentication = {
        status: 'failed',
        details: { error: error.message }
      };
      return false;
    }
  }

  async testDashboardComponents() {
    console.log('📊 Testing dashboard components...');
    
    try {
      await this.page.goto('http://localhost:5000/dashboard', { waitUntil: 'networkidle2' });
      
      const componentAnalysis = await this.page.evaluate(() => {
        const analysis = {
          financialCards: {
            exists: !!document.querySelector('[data-testid="financial-cards"], .financial-summary'),
            visible: false,
            interactive: false
          },
          quickActions: {
            exists: !!document.querySelector('[data-testid="quick-actions"], .quick-actions'),
            visible: false,
            interactive: false,
            buttons: []
          },
          recentTransactions: {
            exists: !!document.querySelector('[data-testid="recent-transactions"], .recent-transactions'),
            visible: false,
            interactive: false
          },
          totalInteractiveElements: 0,
          pageStructure: {
            totalElements: document.querySelectorAll('*').length,
            buttons: document.querySelectorAll('button').length,
            visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
            inputs: document.querySelectorAll('input').length,
            hasContent: document.body.innerText.length > 100
          }
        };
        
        // Check if quick actions component is visible and interactive
        const quickActionsEl = document.querySelector('[data-testid="quick-actions"], .quick-actions');
        if (quickActionsEl) {
          analysis.quickActions.visible = quickActionsEl.offsetParent !== null;
          analysis.quickActions.buttons = Array.from(quickActionsEl.querySelectorAll('button')).map(btn => ({
            text: btn.textContent.trim(),
            visible: btn.offsetParent !== null,
            testId: btn.getAttribute('data-testid')
          }));
          analysis.quickActions.interactive = analysis.quickActions.buttons.length > 0;
        }
        
        // Check financial cards
        const financialCardsEl = document.querySelector('[data-testid="financial-cards"], .financial-summary');
        if (financialCardsEl) {
          analysis.financialCards.visible = financialCardsEl.offsetParent !== null;
        }
        
        // Count total interactive elements
        analysis.totalInteractiveElements = Array.from(document.querySelectorAll('button, input, a[href]'))
          .filter(el => el.offsetParent !== null).length;
        
        return analysis;
      });
      
      this.integrationMap.dashboard = {
        status: componentAnalysis.totalInteractiveElements > 0 ? 'working' : 'failed',
        details: componentAnalysis
      };
      
      console.log(`Dashboard Analysis:`);
      console.log(`  - Financial Cards: ${componentAnalysis.financialCards.exists ? '✅' : '❌'} (visible: ${componentAnalysis.financialCards.visible})`);
      console.log(`  - Quick Actions: ${componentAnalysis.quickActions.exists ? '✅' : '❌'} (visible: ${componentAnalysis.quickActions.visible})`);
      console.log(`  - Quick Action Buttons: ${componentAnalysis.quickActions.buttons.length}`);
      console.log(`  - Total Interactive Elements: ${componentAnalysis.totalInteractiveElements}`);
      console.log(`  - Page Elements: ${componentAnalysis.pageStructure.totalElements}`);
      
      return componentAnalysis;
    } catch (error) {
      this.integrationMap.dashboard = {
        status: 'failed',
        details: { error: error.message }
      };
      return null;
    }
  }

  async testTransactionsPage() {
    console.log('💰 Testing transactions page...');
    
    try {
      await this.page.goto('http://localhost:5000/transactions', { waitUntil: 'networkidle2' });
      
      const transactionTest = await this.page.evaluate(() => {
        const addButton = document.querySelector('[data-testid="add-transaction"], button:contains("Add Transaction")');
        const filterButton = document.querySelector('[data-testid="filters"], button:contains("Filter")');
        const transactionTable = document.querySelector('table, [data-testid="transactions-table"]');
        
        return {
          hasAddButton: !!addButton,
          hasFilters: !!filterButton,
          hasTransactionTable: !!transactionTable,
          buttonCount: document.querySelectorAll('button').length,
          visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length
        };
      });
      
      this.integrationMap.transactions = {
        status: transactionTest.visibleButtons > 10 ? 'working' : 'failed',
        details: transactionTest
      };
      
      return transactionTest;
    } catch (error) {
      this.integrationMap.transactions = {
        status: 'failed',
        details: { error: error.message }
      };
      return null;
    }
  }

  async testBankingIntegration() {
    console.log('🏦 Testing banking integration...');
    
    try {
      await this.page.goto('http://localhost:5000/banking', { waitUntil: 'networkidle2' });
      
      const bankingTest = await this.page.evaluate(() => {
        const connectButton = document.querySelector('[data-testid="connect-bank"], button:contains("Connect")');
        const syncButton = document.querySelector('[data-testid="sync-transactions"], button:contains("Sync")');
        const bankAccounts = document.querySelectorAll('[data-testid*="bank-account"], .bank-account');
        
        return {
          hasConnectButton: !!connectButton,
          hasSyncButton: !!syncButton,
          bankAccountCount: bankAccounts.length,
          hasPlaidIntegration: document.body.innerText.includes('Plaid') || document.body.innerText.includes('bank'),
          interactiveElements: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length
        };
      });
      
      this.integrationMap.banking = {
        status: bankingTest.interactiveElements > 5 ? 'working' : 'failed',
        details: bankingTest
      };
      
      return bankingTest;
    } catch (error) {
      this.integrationMap.banking = {
        status: 'failed',
        details: { error: error.message }
      };
      return null;
    }
  }

  async testAIAssistant() {
    console.log('🤖 Testing AI assistant...');
    
    try {
      await this.page.goto('http://localhost:5000/ai-assistant', { waitUntil: 'networkidle2' });
      
      const aiTest = await this.page.evaluate(() => {
        const messageInput = document.querySelector('#message-input, input[placeholder*="message"], textarea');
        const sendButton = document.querySelector('button[type="submit"], button:contains("Send")');
        const chatHistory = document.querySelector('[data-testid="chat-history"], .chat-history, .messages');
        
        return {
          hasMessageInput: !!messageInput,
          hasSendButton: !!sendButton,
          hasChatHistory: !!chatHistory,
          inputType: messageInput?.tagName,
          canInteract: !!(messageInput && sendButton)
        };
      });
      
      // Test typing and sending a message
      if (aiTest.hasMessageInput && aiTest.hasSendButton) {
        const messageInput = await this.page.$('#message-input, input[placeholder*="message"], textarea');
        const sendButton = await this.page.$('button[type="submit"], button:contains("Send")');
        
        if (messageInput && sendButton) {
          await messageInput.type('Test message');
          await sendButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      this.integrationMap.aiAssistant = {
        status: aiTest.canInteract ? 'working' : 'failed',
        details: aiTest
      };
      
      return aiTest;
    } catch (error) {
      this.integrationMap.aiAssistant = {
        status: 'failed',
        details: { error: error.message }
      };
      return null;
    }
  }

  async testReceiptsUpload() {
    console.log('📄 Testing receipts upload...');
    
    try {
      await this.page.goto('http://localhost:5000/receipts', { waitUntil: 'networkidle2' });
      
      const receiptsTest = await this.page.evaluate(() => {
        const uploadArea = document.querySelector('[data-testid="upload"], .upload-area, input[type="file"]');
        const receiptsTable = document.querySelector('table, [data-testid="receipts-table"]');
        const unmatchedSection = document.querySelector('[data-testid="unmatched"], .unmatched');
        
        return {
          hasUploadArea: !!uploadArea,
          hasReceiptsTable: !!receiptsTable,
          hasUnmatchedSection: !!unmatchedSection,
          uploadType: uploadArea?.tagName,
          fileInputExists: !!document.querySelector('input[type="file"]')
        };
      });
      
      this.integrationMap.receipts = {
        status: receiptsTest.hasUploadArea ? 'working' : 'failed',
        details: receiptsTest
      };
      
      return receiptsTest;
    } catch (error) {
      this.integrationMap.receipts = {
        status: 'failed',
        details: { error: error.message }
      };
      return null;
    }
  }

  async generateIntegrationReport() {
    console.log('📊 Generating integration report...');
    
    const summary = {
      timestamp: new Date().toISOString(),
      overallStatus: this.calculateOverallStatus(),
      testResults: this.integrationMap,
      recommendations: this.generateRecommendations()
    };
    
    await fs.writeFile('integration-test-report.json', JSON.stringify(summary, null, 2));
    
    console.log('\n🎯 Integration Test Summary:');
    Object.entries(this.integrationMap).forEach(([feature, result]) => {
      const status = result.status === 'working' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
      console.log(`  ${status} ${feature}: ${result.status}`);
    });
    
    console.log(`\n📈 Overall Status: ${summary.overallStatus}`);
    
    return summary;
  }

  calculateOverallStatus() {
    const results = Object.values(this.integrationMap);
    const working = results.filter(r => r.status === 'working').length;
    const total = results.length;
    const percentage = (working / total) * 100;
    
    if (percentage >= 80) return 'EXCELLENT';
    if (percentage >= 60) return 'GOOD';
    if (percentage >= 40) return 'FAIR';
    return 'POOR';
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.integrationMap.dashboard.status === 'failed') {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Dashboard components not interactive',
        action: 'Add data-testid attributes and verify component mounting'
      });
    }
    
    if (this.integrationMap.authentication.status === 'failed') {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'Authentication not working',
        action: 'Check login form and session management'
      });
    }
    
    if (this.integrationMap.banking.status === 'failed') {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Banking integration issues',
        action: 'Verify Plaid connection and bank account components'
      });
    }
    
    return recommendations;
  }

  async runFullTestSuite() {
    await this.init();
    
    // Run all tests
    const authResult = await this.testAuthentication();
    
    if (authResult) {
      await this.testDashboardComponents();
      await this.testTransactionsPage();
      await this.testBankingIntegration();
      await this.testAIAssistant();
      await this.testReceiptsUpload();
    }
    
    const report = await this.generateIntegrationReport();
    
    await this.browser.close();
    
    return report;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the full integration test suite
async function runIntegrationTests() {
  const tester = new UIIntegrationTest();
  const report = await tester.runFullTestSuite();
  
  console.log('\n🎉 Integration testing complete!');
  console.log('📄 Report saved to integration-test-report.json');
  
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests();
}

export default UIIntegrationTest;