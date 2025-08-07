#!/usr/bin/env node

/**
 * Demo UI Automation Script
 * Quick test of the UI Controller functionality
 */

import UIController from './uiController.js';

async function demoUIAutomation() {
  const ui = new UIController();
  
  try {
    console.log('🚀 Starting UI Automation Demo');
    
    // Initialize the controller
    await ui.init();
    
    // Step 1: Navigate to the app
    await ui.navigateTo('/');
    
    // Step 2: Capture initial state
    await ui.captureScreenshot('initial-state');
    
    // Step 3: Get all interactive elements
    const elements = await ui.getInteractiveElements();
    console.log(`📋 Found ${elements.length} interactive elements:`);
    elements.slice(0, 10).forEach((el, i) => {
      console.log(`   ${i + 1}. ${el.tagName} - "${el.text}" (${el.selector})`);
    });
    
    // Step 4: Check feature wiring status
    console.log('\n🔗 Checking feature wiring status:');
    const features = ['authentication', 'dashboard', 'transactions', 'banking'];
    features.forEach(feature => {
      const isWired = ui.isFeatureWired(feature);
      console.log(`   ${feature}: ${isWired ? '✅ Wired' : '❌ Not wired'}`);
    });
    
    // Step 5: Try to identify current page state
    const pageTitle = await ui.getText('title, h1, [data-testid="page-title"]', 'Page title');
    console.log(`\n📄 Current page: ${pageTitle || 'Unknown'}`);
    
    // Step 6: Look for authentication state
    const isLoggedIn = await ui.exists('[data-testid="user-menu"], .user-menu, .logout', 'User menu');
    const hasLoginForm = await ui.exists('form input[type="password"]', 'Login form');
    
    console.log(`\n🔐 Authentication state:`);
    console.log(`   Logged in: ${isLoggedIn ? '✅ Yes' : '❌ No'}`);
    console.log(`   Login form present: ${hasLoginForm ? '✅ Yes' : '❌ No'}`);
    
    // Step 7: Update integration map with current findings
    await ui.updateIntegrationMap('demo-session', ['ui-automation', 'puppeteer-integration'], {
      elementsFound: elements.length,
      pageTitle,
      authenticationState: { isLoggedIn, hasLoginForm },
      timestamp: new Date().toISOString()
    });
    
    console.log('\n✅ Demo completed successfully!');
    console.log('📸 Screenshots saved to ui-automation-screenshots/');
    console.log('📋 Integration map updated');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await ui.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demoUIAutomation().catch(console.error);
}

export default demoUIAutomation;