// Manual trigger for transaction sync to complete the automation flow
const fetch = require('node-fetch');

async function triggerTransactionSync() {
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'jason@test.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login status:', loginResponse.status);
    
    if (loginResponse.status === 200) {
      // Extract session cookie
      const cookies = loginResponse.headers.get('set-cookie');
      console.log('Session established');
      
      // Trigger transaction sync
      const syncResponse = await fetch('http://localhost:5000/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': cookies
        }
      });
      
      const syncData = await syncResponse.json();
      console.log('Sync response:', syncData);
    } else {
      console.log('Login failed:', loginData);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

triggerTransactionSync();