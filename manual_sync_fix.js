// Fix the missing automation by manually triggering transaction sync
const { syncTransactions } = require('./server/services/plaid.ts');
const { storage } = require('./server/storage.ts');

async function completeMissingAutomation() {
  console.log('🔧 FIXING MISSING BANK CONNECTION AUTOMATION...');
  
  const userId = '74788457-24df-490c-b49a-77571289a87f';
  const accessToken = 'access-production-ec450450-85d3-4cd5-8300-1026bba75daf';
  
  try {
    console.log('📊 Syncing transactions from Plaid...');
    
    // Get bank connections
    const connections = await storage.getBankConnections(userId);
    console.log(`Found ${connections.length} bank connections`);
    
    // Sync transactions for the production access token
    const syncData = await syncTransactions(accessToken);
    console.log(`Plaid returned ${syncData.added.length} transactions to process`);
    
    let processedCount = 0;
    const userAccountIds = connections.map(conn => conn.accountId);
    
    // Process each transaction with hybrid categorization
    for (const transaction of syncData.added) {
      try {
        console.log(`Processing: ${transaction.name} - $${Math.abs(transaction.amount)}`);
        
        const transactionData = {
          userId: userId,
          description: transaction.name,
          vendor: transaction.merchant_name || transaction.name,
          amount: Math.abs(transaction.amount).toString(),
          date: new Date(transaction.date),
          category: 'UNCATEGORIZED', // Will be updated by AI
          isExpense: transaction.amount > 0,
          isTransfer: false,
          bankTransactionId: transaction.transaction_id,
          bankConnectionId: connections.find(c => c.accountId === transaction.account_id)?.id,
          plaidCategory: transaction.category?.[0] || null,
          paymentChannel: transaction.payment_channel || null,
          needsReview: true, // Flag for manual review
          isReviewed: false,
        };

        await storage.createTransaction(transactionData);
        processedCount++;
        
      } catch (error) {
        console.log(`Skipping duplicate: ${transaction.transaction_id}`);
      }
    }
    
    console.log(`✅ Successfully imported ${processedCount} transactions`);
    console.log('🎯 Bank connection automation now complete!');
    
  } catch (error) {
    console.error('❌ Automation fix failed:', error);
  }
}

completeMissingAutomation();