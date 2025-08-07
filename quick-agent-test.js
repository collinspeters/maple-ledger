import fs from 'fs/promises';

// Simplified test that works without browser automation
class QuickAgentTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      performance: {},
      recommendations: []
    };
  }

  async testAPIEndpoints() {
    console.log('🧪 Testing API endpoints...');
    
    const endpoints = [
      { path: '/api/auth/me', method: 'GET', authenticated: true },
      { path: '/api/transactions', method: 'GET', authenticated: true },
      { path: '/api/bank-connections', method: 'GET', authenticated: true },
      { path: '/api/receipts', method: 'GET', authenticated: true },
      { path: '/api/financial-summary', method: 'GET', authenticated: true }
    ];

    // First authenticate
    let sessionCookie = null;
    try {
      console.log('🔐 Authenticating...');
      const authResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'demo@bookkeepai.com',
          password: 'password123'
        })
      });

      if (authResponse.ok) {
        const setCookieHeader = authResponse.headers.get('set-cookie');
        if (setCookieHeader) {
          const sessionMatch = setCookieHeader.match(/connect\.sid=([^;]+)/);
          if (sessionMatch) {
            sessionCookie = `connect.sid=${sessionMatch[1]}`;
            console.log('✅ Authentication successful');
          }
        }
      } else {
        console.log('❌ Authentication failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Authentication error:', error.message);
      return false;
    }

    // Test each endpoint
    for (const endpoint of endpoints) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (endpoint.authenticated && sessionCookie) {
          headers.Cookie = sessionCookie;
        }

        const startTime = Date.now();
        const response = await fetch(`http://localhost:5000${endpoint.path}`, {
          method: endpoint.method,
          headers
        });
        const responseTime = Date.now() - startTime;

        const testResult = {
          endpoint: endpoint.path,
          method: endpoint.method,
          status: response.status,
          responseTime,
          success: response.ok,
          contentType: response.headers.get('content-type')
        };

        if (response.ok) {
          try {
            const data = await response.json();
            testResult.dataLength = JSON.stringify(data).length;
            testResult.hasData = Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0;
          } catch (e) {
            testResult.dataLength = 0;
            testResult.hasData = false;
          }
        }

        this.results.tests.push(testResult);
        
        const status = testResult.success ? '✅' : '❌';
        console.log(`  ${status} ${endpoint.path} - ${response.status} (${responseTime}ms)`);
        
      } catch (error) {
        console.log(`  ❌ ${endpoint.path} - Error: ${error.message}`);
        this.results.tests.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          success: false,
          error: error.message
        });
      }
    }

    return true;
  }

  analyzeResults() {
    console.log('\n📊 Analyzing results...');
    
    const successfulTests = this.results.tests.filter(test => test.success);
    const failedTests = this.results.tests.filter(test => !test.success);
    const successRate = (successfulTests.length / this.results.tests.length) * 100;
    
    const avgResponseTime = successfulTests.reduce((sum, test) => sum + (test.responseTime || 0), 0) / successfulTests.length || 0;
    
    this.results.performance = {
      successRate,
      averageResponseTime: avgResponseTime,
      totalTests: this.results.tests.length,
      successfulTests: successfulTests.length,
      failedTests: failedTests.length
    };

    // Generate recommendations
    if (successRate < 80) {
      this.results.recommendations.push('Low success rate detected - investigate failed endpoints');
    }
    
    if (avgResponseTime > 1000) {
      this.results.recommendations.push('High response times - consider API optimization');
    }
    
    const dataEndpoints = successfulTests.filter(test => test.hasData);
    if (dataEndpoints.length < successfulTests.length * 0.8) {
      this.results.recommendations.push('Some endpoints returning empty data - verify data population');
    }

    // Check specific issues
    const transactionEndpoint = this.results.tests.find(test => test.endpoint === '/api/transactions');
    if (transactionEndpoint && transactionEndpoint.success && transactionEndpoint.hasData) {
      this.results.recommendations.push('✅ Transaction data is properly accessible via API');
    }
    
    const authEndpoint = this.results.tests.find(test => test.endpoint === '/api/auth/me');
    if (authEndpoint && authEndpoint.success) {
      this.results.recommendations.push('✅ Authentication system working correctly');
    }
  }

  displaySummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 QUICK AGENT TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`📈 Success Rate: ${this.results.performance.successRate.toFixed(1)}%`);
    console.log(`⚡ Average Response Time: ${this.results.performance.averageResponseTime.toFixed(0)}ms`);
    console.log(`✅ Successful Tests: ${this.results.performance.successfulTests}`);
    console.log(`❌ Failed Tests: ${this.results.performance.failedTests}`);
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    if (this.results.performance.failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      const failedTests = this.results.tests.filter(test => !test.success);
      failedTests.forEach(test => {
        console.log(`  - ${test.endpoint}: ${test.error || test.status}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }

  async saveReport() {
    const filename = `quick-agent-report-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
    console.log(`📊 Report saved: ${filename}`);
    return filename;
  }

  async run() {
    console.log('🚀 Starting Quick Agent Test...\n');
    
    try {
      await this.testAPIEndpoints();
      this.analyzeResults();
      this.displaySummary();
      await this.saveReport();
      
      return {
        success: this.results.performance.successRate >= 80,
        results: this.results
      };
    } catch (error) {
      console.error('❌ Quick test failed:', error.message);
      throw error;
    }
  }
}

// Run the test
async function runQuickTest() {
  const test = new QuickAgentTest();
  try {
    const result = await test.run();
    
    if (result.success) {
      console.log('\n🎉 Quick test PASSED!');
      return result;
    } else {
      console.log('\n⚠️ Quick test completed with issues');
      return result;
    }
  } catch (error) {
    console.error('\n💥 Quick test FAILED');
    throw error;
  }
}

export default QuickAgentTest;
export { runQuickTest };

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runQuickTest()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(() => {
      process.exit(1);
    });
}