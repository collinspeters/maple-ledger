#!/usr/bin/env node

/**
 * Simplified UI Automation Demo for Replit
 * Uses curl to test API endpoints and simulates UI interactions
 */

import { promises as fs } from 'fs';

class SimplifiedUIController {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.actionLog = [];
    this.integrationMap = {};
  }

  async init() {
    console.log('🚀 Initializing Simplified UI Controller...');
    await this.loadIntegrationMap();
    console.log('✅ Controller initialized');
  }

  async testAPIEndpoints() {
    console.log('\n🔗 Testing API Integration Points');
    console.log('-' .repeat(40));
    
    const endpoints = [
      { path: '/api/auth/me', method: 'GET', description: 'Authentication status' },
      { path: '/api/transactions', method: 'GET', description: 'Transactions endpoint' },
      { path: '/api/receipts', method: 'GET', description: 'Receipts endpoint' },
      { path: '/api/bank-connections', method: 'GET', description: 'Banking integration' },
      { path: '/api/chat/history', method: 'GET', description: 'AI chat history' }
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const exec = promisify(spawn);
        
        const response = await this.makeAPIRequest(endpoint.path, endpoint.method);
        const isWorking = response.status < 500; // Accept 401/403 as "working" but unauthorized
        
        results.push({
          ...endpoint,
          status: response.status,
          working: isWorking,
          message: response.status === 401 ? 'Requires auth (expected)' : 
                  response.status === 200 ? 'Working' : 
                  response.status === 404 ? 'Not found' : 'Error'
        });
        
        console.log(`${isWorking ? '✅' : '❌'} ${endpoint.description}: ${response.status} - ${results[results.length - 1].message}`);
        
      } catch (error) {
        results.push({
          ...endpoint,
          status: 'error',
          working: false,
          message: error.message
        });
        console.log(`❌ ${endpoint.description}: Error - ${error.message}`);
      }
    }

    return results;
  }

  async makeAPIRequest(path, method = 'GET') {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const url = `${this.baseUrl}${path}`;
      const { stdout, stderr } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" -X ${method} "${url}"`);
      
      return {
        status: parseInt(stdout.trim()),
        url
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async simulateUIInteractions() {
    console.log('\n👆 Simulating UI Interactions');
    console.log('-' .repeat(40));
    
    const interactions = [
      { action: 'navigate', target: '/', description: 'Landing page' },
      { action: 'navigate', target: '/dashboard', description: 'Dashboard' },
      { action: 'navigate', target: '/transactions', description: 'Transactions page' },
      { action: 'navigate', target: '/banking', description: 'Banking page' },
      { action: 'navigate', target: '/receipts', description: 'Receipts page' },
      { action: 'navigate', target: '/ai-assistant', description: 'AI Assistant' }
    ];

    const results = [];

    for (const interaction of interactions) {
      try {
        const response = await this.makeAPIRequest(interaction.target, 'GET');
        const isAccessible = response.status < 500;
        
        results.push({
          ...interaction,
          status: response.status,
          accessible: isAccessible
        });
        
        this.logAction(interaction.action, {
          target: interaction.target,
          description: interaction.description,
          status: response.status,
          accessible: isAccessible
        });
        
        console.log(`${isAccessible ? '✅' : '❌'} ${interaction.description}: ${response.status === 200 ? 'Accessible' : response.status === 401 ? 'Requires auth' : 'Error'}`);
        
      } catch (error) {
        console.log(`❌ ${interaction.description}: Error - ${error.message}`);
        results.push({
          ...interaction,
          status: 'error',
          accessible: false
        });
      }
    }

    return results;
  }

  async checkFeatureIntegration() {
    console.log('\n🔗 Checking Feature Integration');
    console.log('-' .repeat(40));
    
    const features = [
      'authentication',
      'dashboard', 
      'transactions',
      'banking',
      'ai-assistant',
      'receipts',
      'reporting'
    ];

    features.forEach(feature => {
      const isWired = this.isFeatureWired(feature);
      const connections = this.integrationMap.features[feature]?.connectedFeatures?.length || 0;
      console.log(`${isWired ? '✅' : '❌'} ${feature}: ${connections} connections`);
    });
  }

  async updateIntegrationMap(feature, connectedFeatures = [], metadata = {}) {
    this.integrationMap.features = this.integrationMap.features || {};
    this.integrationMap.connections = this.integrationMap.connections || [];
    
    this.integrationMap.features[feature] = {
      connectedFeatures,
      metadata,
      lastTested: new Date().toISOString()
    };
    
    // Add connections
    connectedFeatures.forEach(connected => {
      const connection = { from: feature, to: connected, verified: true };
      if (!this.integrationMap.connections.find(c => c.from === feature && c.to === connected)) {
        this.integrationMap.connections.push(connection);
      }
    });
    
    this.integrationMap.lastUpdated = new Date().toISOString();
    await this.saveIntegrationMap();
  }

  isFeatureWired(feature) {
    if (!this.integrationMap.features || !this.integrationMap.features[feature]) {
      return false;
    }
    return this.integrationMap.features[feature].connectedFeatures.length > 0;
  }

  async loadIntegrationMap() {
    try {
      const data = await fs.readFile('integrationMap.json', 'utf8');
      this.integrationMap = JSON.parse(data);
      console.log('📋 Integration map loaded');
    } catch (error) {
      console.log('📋 Creating new integration map');
      this.integrationMap = {
        features: {},
        connections: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async saveIntegrationMap() {
    await fs.writeFile('integrationMap.json', JSON.stringify(this.integrationMap, null, 2));
    console.log('💾 Integration map updated');
  }

  logAction(action, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      ...details
    };
    
    this.actionLog.push(logEntry);
  }

  async saveActionLog() {
    const filename = `simplified-ui-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(filename, JSON.stringify(this.actionLog, null, 2));
    console.log(`💾 Action log saved: ${filename}`);
  }

  async generateReport(apiResults, uiResults) {
    console.log('\n📋 Integration Report Summary');
    console.log('=' .repeat(60));
    
    const workingAPIs = apiResults.filter(r => r.working).length;
    const accessiblePages = uiResults.filter(r => r.accessible).length;
    
    console.log(`\n🎯 API Integration Status:`);
    console.log(`   Working endpoints: ${workingAPIs}/${apiResults.length}`);
    console.log(`   Success rate: ${(workingAPIs/apiResults.length*100).toFixed(1)}%`);
    
    console.log(`\n📱 UI Accessibility Status:`);
    console.log(`   Accessible pages: ${accessiblePages}/${uiResults.length}`);
    console.log(`   Success rate: ${(accessiblePages/uiResults.length*100).toFixed(1)}%`);
    
    // Update integration map with test results
    await this.updateIntegrationMap('ui-automation-test', ['api-testing', 'endpoint-validation'], {
      apiResults,
      uiResults,
      workingAPIs,
      accessiblePages,
      testTimestamp: new Date().toISOString()
    });
    
    console.log(`\n🏆 Overall System Health: ${workingAPIs >= 3 && accessiblePages >= 4 ? '✅ GOOD' : '⚠️ NEEDS ATTENTION'}`);
  }
}

async function runSimplifiedDemo() {
  console.log('🚀 Starting Simplified UI Integration Demo');
  console.log('=' .repeat(60));

  const controller = new SimplifiedUIController();
  
  try {
    await controller.init();
    
    // Test API endpoints
    const apiResults = await controller.testAPIEndpoints();
    
    // Simulate UI interactions
    const uiResults = await controller.simulateUIInteractions();
    
    // Check feature wiring
    await controller.checkFeatureIntegration();
    
    // Generate report
    await controller.generateReport(apiResults, uiResults);
    
    // Save logs
    await controller.saveActionLog();
    
    console.log('\n✅ Simplified demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimplifiedDemo().catch(console.error);
}

export default SimplifiedUIController;