// Direct debugging of transaction data flow
console.log('🔍 Debugging Transaction Data Flow');

// Check API response directly
async function testAPI() {
  try {
    console.log('Testing API endpoints...');
    
    // Test auth endpoint
    const authResponse = await fetch('http://localhost:5000/api/auth/me');
    console.log('Auth endpoint:', authResponse.status, authResponse.statusText);
    
    // Test transactions endpoint (will be 401 without auth)
    const transResponse = await fetch('http://localhost:5000/api/transactions');
    console.log('Transactions endpoint:', transResponse.status, transResponse.statusText);
    
  } catch (error) {
    console.error('API test failed:', error);
  }
}

testAPI();