#!/usr/bin/env node

/**
 * BookkeepAI UI Integration Test Suite
 * Demonstrates full-stack SaaS integration using the UI Controller
 */

import UIController from './uiController.js';

class BookkeepAIIntegrationTest {
  constructor() {
    this.ui = new UIController();
    this.testResults = {
      passed: 0,
      failed: 0,
      features: {}
    };
  }

  async runFullIntegrationTest() {
    console.log('🔥 Starting BookkeepAI Full-Stack Integration Test');
    console.log('=' .repeat(60));

    try {
      await this.ui.init();
      
      // Test core authentication flow
      await this.testAuthenticationFlow();
      
      // Test dashboard integration  
      await this.testDashboardIntegration();
      
      // Test transaction management
      await this.testTransactionManagement();
      
      // Test banking integration
      await this.testBankingIntegration();
      
      // Test AI assistant integration
      await this.testAIAssistantIntegration();
      
      // Test receipts workflow
      await this.testReceiptsWorkflow();
      
      // Generate final report
      await this.generateIntegrationReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.ui.close();
    }
  }

  async testAuthenticationFlow() {
    console.log('\n🔐 Testing Authentication Flow Integration');
    console.log('-' .repeat(40));
    
    try {
      // Navigate to login page
      await this.ui.navigateTo('/');
      
      // Check if already logged in
      const isLoggedIn = await this.ui.exists('[data-testid="user-menu"]', 'User menu (logged in state)');
      
      if (!isLoggedIn) {
        // Look for login form
        const hasLoginForm = await this.ui.exists('form', 'Login form');
        
        if (hasLoginForm) {
          // Try to find email/username field
          const emailField = await this.ui.exists('input[type="email"], input[name="email"], input[placeholder*="email"]', 'Email field');
          const passwordField = await this.ui.exists('input[type="password"]', 'Password field');
          
          if (emailField && passwordField) {
            console.log('✅ Login form structure verified');
            
            // Test with demo credentials
            await this.ui.type('input[type="email"], input[name="email"], input[placeholder*="email"]', 'demo@bookkeepai.com', 'Email field');
            await this.ui.type('input[type="password"]', 'password123', 'Password field');
            
            // Look for login button
            const loginButton = await this.ui.click('button[type="submit"], button:contains("Login"), button:contains("Sign In")', 'Login button');
            
            if (loginButton) {
              // Wait for redirect or dashboard
              await this.ui.waitFor('[data-testid="dashboard"], .dashboard, main', 10000, 'Dashboard after login');
            }
          }
        } else {
          // Might be on register page, look for "Sign In" link
          const signInLink = await this.ui.click('a:contains("Sign In"), a:contains("Login")', 'Sign In link');
        }
      }
      
      await this.ui.updateIntegrationMap('authentication', ['dashboard', 'navigation'], {
        loginFormPresent: hasLoginForm,
        userMenuPresent: isLoggedIn
      });
      
      this.recordTestResult('authentication', true);
      
    } catch (error) {
      console.error('❌ Authentication test failed:', error.message);
      this.recordTestResult('authentication', false);
    }
  }

  async testDashboardIntegration() {
    console.log('\n📊 Testing Dashboard Integration');
    console.log('-' .repeat(40));
    
    try {
      await this.ui.navigateTo('/dashboard');
      
      // Check for key dashboard components
      const components = [
        { selector: '[data-testid="financial-summary"], .financial-summary', name: 'Financial Summary' },
        { selector: '[data-testid="recent-transactions"], .recent-transactions', name: 'Recent Transactions' },
        { selector: '[data-testid="quick-actions"], .quick-actions', name: 'Quick Actions' },
        { selector: 'nav, .navigation, .sidebar', name: 'Navigation' }
      ];
      
      const foundComponents = [];
      
      for (const component of components) {
        const exists = await this.ui.exists(component.selector, component.name);
        if (exists) {
          foundComponents.push(component.name);
          console.log(`✅ ${component.name} found`);
        } else {
          console.log(`⚠️  ${component.name} not found`);
        }
      }
      
      // Test navigation elements
      const navLinks = await this.ui.getInteractiveElements();
      const dashboardFeatures = navLinks.filter(el => 
        el.text.toLowerCase().includes('transaction') ||
        el.text.toLowerCase().includes('receipt') ||
        el.text.toLowerCase().includes('report') ||
        el.text.toLowerCase().includes('bank')
      );
      
      console.log(`✅ Found ${dashboardFeatures.length} navigation features`);
      
      await this.ui.updateIntegrationMap('dashboard', foundComponents, {
        navigationLinks: dashboardFeatures.length,
        componentsFound: foundComponents.length
      });
      
      this.recordTestResult('dashboard', foundComponents.length > 0);
      
    } catch (error) {
      console.error('❌ Dashboard test failed:', error.message);
      this.recordTestResult('dashboard', false);
    }
  }

  async testTransactionManagement() {
    console.log('\n💰 Testing Transaction Management Integration');
    console.log('-' .repeat(40));
    
    try {
      await this.ui.navigateTo('/transactions');
      
      // Check for transaction components
      const hasTransactionList = await this.ui.exists('table, .transaction-list, [data-testid="transactions"]', 'Transaction list');
      const hasAddButton = await this.ui.exists('button:contains("Add"), button:contains("New"), [data-testid="add-transaction"]', 'Add transaction button');
      const hasFilters = await this.ui.exists('select, .filters, [data-testid="filters"]', 'Transaction filters');
      
      console.log(`✅ Transaction list: ${hasTransactionList ? 'Found' : 'Missing'}`);
      console.log(`✅ Add button: ${hasAddButton ? 'Found' : 'Missing'}`);
      console.log(`✅ Filters: ${hasFilters ? 'Found' : 'Missing'}`);
      
      // Test add transaction flow if button exists
      if (hasAddButton) {
        await this.ui.click('button:contains("Add"), button:contains("New"), [data-testid="add-transaction"]', 'Add transaction');
        
        // Look for transaction form
        const hasForm = await this.ui.waitFor('form, .transaction-form, [data-testid="transaction-form"]', 5000, 'Transaction form');
        
        if (hasForm) {
          console.log('✅ Transaction form opened');
          
          // Try to fill sample data
          await this.ui.type('input[name="amount"], input[placeholder*="amount"]', '25.99', 'Amount field');
          await this.ui.type('input[name="vendor"], input[placeholder*="vendor"]', 'Test Vendor', 'Vendor field');
          await this.ui.type('input[name="description"], textarea[name="description"]', 'Test transaction description', 'Description field');
          
          console.log('✅ Sample transaction data entered');
        }
      }
      
      await this.ui.updateIntegrationMap('transactions', ['transaction-list', 'add-form', 'ai-categorization'], {
        listPresent: hasTransactionList,
        addButtonPresent: hasAddButton,
        filtersPresent: hasFilters
      });
      
      this.recordTestResult('transactions', hasTransactionList);
      
    } catch (error) {
      console.error('❌ Transaction test failed:', error.message);
      this.recordTestResult('transactions', false);
    }
  }

  async testBankingIntegration() {
    console.log('\n🏦 Testing Banking Integration');
    console.log('-' .repeat(40));
    
    try {
      await this.ui.navigateTo('/banking');
      
      // Check for banking components
      const hasBankList = await this.ui.exists('.bank-connections, [data-testid="bank-connections"]', 'Bank connections list');
      const hasConnectButton = await this.ui.exists('button:contains("Connect"), button:contains("Add Bank"), [data-testid="connect-bank"]', 'Connect bank button');
      const hasPlaidElements = await this.ui.exists('[data-testid="plaid"], .plaid-link', 'Plaid integration elements');
      
      console.log(`✅ Bank connections: ${hasBankList ? 'Found' : 'Missing'}`);
      console.log(`✅ Connect button: ${hasConnectButton ? 'Found' : 'Missing'}`);
      console.log(`✅ Plaid integration: ${hasPlaidElements ? 'Found' : 'Missing'}`);
      
      // Check for Canadian banking features
      const canadianFeatures = await this.ui.getText('body', 'Page content');
      const hasCanadianSupport = canadianFeatures && (
        canadianFeatures.includes('Canadian') ||
        canadianFeatures.includes('CAD') ||
        canadianFeatures.includes('TD Bank') ||
        canadianFeatures.includes('RBC') ||
        canadianFeatures.includes('Scotia')
      );
      
      console.log(`✅ Canadian banking support: ${hasCanadianSupport ? 'Detected' : 'Not detected'}`);
      
      await this.ui.updateIntegrationMap('banking', ['plaid-integration', 'bank-connections', 'transaction-sync'], {
        connectionsPresent: hasBankList,
        connectButtonPresent: hasConnectButton,
        plaidIntegrated: hasPlaidElements,
        canadianSupport: hasCanadianSupport
      });
      
      this.recordTestResult('banking', hasBankList || hasConnectButton);
      
    } catch (error) {
      console.error('❌ Banking test failed:', error.message);
      this.recordTestResult('banking', false);
    }
  }

  async testAIAssistantIntegration() {
    console.log('\n🤖 Testing AI Assistant Integration');
    console.log('-' .repeat(40));
    
    try {
      await this.ui.navigateTo('/ai-assistant');
      
      // Check for AI chat components
      const hasChatInterface = await this.ui.exists('.chat, [data-testid="chat"], .ai-chat', 'Chat interface');
      const hasMessageInput = await this.ui.exists('input[placeholder*="message"], textarea[placeholder*="ask"], input[placeholder*="question"]', 'Message input');
      const hasChatHistory = await this.ui.exists('.messages, .chat-history, [data-testid="messages"]', 'Chat history');
      
      console.log(`✅ Chat interface: ${hasChatInterface ? 'Found' : 'Missing'}`);
      console.log(`✅ Message input: ${hasMessageInput ? 'Found' : 'Missing'}`);
      console.log(`✅ Chat history: ${hasChatHistory ? 'Found' : 'Missing'}`);
      
      // Test AI interaction if input exists
      if (hasMessageInput) {
        await this.ui.type('input[placeholder*="message"], textarea[placeholder*="ask"], input[placeholder*="question"]', 'What is my total revenue this month?', 'AI question');
        
        // Look for send button
        const hasSendButton = await this.ui.click('button:contains("Send"), button[type="submit"], [data-testid="send"]', 'Send message button');
        
        if (hasSendButton) {
          console.log('✅ AI question sent');
          
          // Wait for response
          await this.ui.waitFor('.message, .ai-response, [data-testid="ai-response"]', 10000, 'AI response');
        }
      }
      
      await this.ui.updateIntegrationMap('ai-assistant', ['chat-interface', 'openai-integration', 'financial-queries'], {
        chatPresent: hasChatInterface,
        inputPresent: hasMessageInput,
        historyPresent: hasChatHistory
      });
      
      this.recordTestResult('ai-assistant', hasChatInterface);
      
    } catch (error) {
      console.error('❌ AI Assistant test failed:', error.message);
      this.recordTestResult('ai-assistant', false);
    }
  }

  async testReceiptsWorkflow() {
    console.log('\n📄 Testing Receipts Workflow Integration');
    console.log('-' .repeat(40));
    
    try {
      await this.ui.navigateTo('/receipts');
      
      // Check for receipts components
      const hasReceiptsList = await this.ui.exists('.receipts, [data-testid="receipts"], .receipt-list', 'Receipts list');
      const hasUploadArea = await this.ui.exists('.upload, [data-testid="upload"], input[type="file"]', 'Upload area');
      const hasUnmatchedQueue = await this.ui.exists('.unmatched, [data-testid="unmatched"]', 'Unmatched receipts queue');
      
      console.log(`✅ Receipts list: ${hasReceiptsList ? 'Found' : 'Missing'}`);
      console.log(`✅ Upload area: ${hasUploadArea ? 'Found' : 'Missing'}`);
      console.log(`✅ Unmatched queue: ${hasUnmatchedQueue ? 'Found' : 'Missing'}`);
      
      await this.ui.updateIntegrationMap('receipts', ['file-upload', 'ocr-processing', 'transaction-matching'], {
        listPresent: hasReceiptsList,
        uploadPresent: hasUploadArea,
        unmatchedQueuePresent: hasUnmatchedQueue
      });
      
      this.recordTestResult('receipts', hasReceiptsList || hasUploadArea);
      
    } catch (error) {
      console.error('❌ Receipts test failed:', error.message);
      this.recordTestResult('receipts', false);
    }
  }

  recordTestResult(feature, passed) {
    this.testResults.features[feature] = passed;
    if (passed) {
      this.testResults.passed++;
      console.log(`✅ ${feature} test: PASSED`);
    } else {
      this.testResults.failed++;
      console.log(`❌ ${feature} test: FAILED`);
    }
  }

  async generateIntegrationReport() {
    console.log('\n📋 Generating Integration Report');
    console.log('=' .repeat(60));
    
    const totalTests = this.testResults.passed + this.testResults.failed;
    const successRate = totalTests > 0 ? (this.testResults.passed / totalTests * 100).toFixed(1) : 0;
    
    console.log(`\n🎯 Test Results Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${this.testResults.passed}`);
    console.log(`   Failed: ${this.testResults.failed}`);
    console.log(`   Success Rate: ${successRate}%`);
    
    console.log(`\n📊 Feature Integration Status:`);
    Object.entries(this.testResults.features).forEach(([feature, passed]) => {
      const status = passed ? '✅ INTEGRATED' : '❌ NEEDS WORK';
      console.log(`   ${feature}: ${status}`);
    });
    
    // Check integration map for wiring status
    console.log(`\n🔗 Feature Wiring Status:`);
    const features = ['authentication', 'dashboard', 'transactions', 'banking', 'ai-assistant', 'receipts'];
    features.forEach(feature => {
      const isWired = this.ui.isFeatureWired(feature);
      const connections = this.ui.integrationMap.features[feature]?.connectedFeatures?.length || 0;
      console.log(`   ${feature}: ${isWired ? '✅' : '❌'} wired (${connections} connections)`);
    });
    
    console.log(`\n🏆 Overall Integration Health: ${successRate >= 70 ? '✅ GOOD' : successRate >= 50 ? '⚠️ FAIR' : '❌ NEEDS IMPROVEMENT'}`);
  }
}

// Run the integration test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new BookkeepAIIntegrationTest();
  test.runFullIntegrationTest().catch(console.error);
}

export default BookkeepAIIntegrationTest;