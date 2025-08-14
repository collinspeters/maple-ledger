// Test the hybrid categorization system
import { categorizeTransactionHybrid } from './server/services/hybrid-categorization.js';

// Sample Plaid transaction that should be categorized
const testTransaction = {
  transaction_id: 'test_txn_001',
  name: 'TIM HORTONS #1234',
  merchant_name: 'Tim Hortons',
  amount: -5.47,
  date: '2025-08-12',
  category: ['Food and Drink', 'Restaurants'],
  payment_channel: 'in_store',
  location: {
    city: 'Toronto',
    region: 'ON',
    country: 'CA'
  }
};

const userAccountIds = ['demo_account_1'];

console.log('Testing hybrid categorization system...');
console.log('Input transaction:', JSON.stringify(testTransaction, null, 2));

categorizeTransactionHybrid(testTransaction, userAccountIds)
  .then(result => {
    console.log('\n=== CATEGORIZATION RESULT ===');
    console.log('Category:', result.category);
    console.log('Method:', result.method);
    console.log('Confidence:', Math.round(result.confidence * 100) + '%');
    console.log('Is Expense:', result.isExpense);
    console.log('Is Transfer:', result.isTransfer);
    if (result.explanation) {
      console.log('Explanation:', result.explanation);
    }
    console.log('\n✅ Hybrid categorization system working correctly!');
  })
  .catch(error => {
    console.error('\n❌ Categorization failed:', error.message);
    console.error('Stack:', error.stack);
  });
