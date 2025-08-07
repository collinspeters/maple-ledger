import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function recategorizeTransactions() {
  console.log('Starting transaction recategorization...');
  
  try {
    // Get all transactions that need recategorization
    const transactions = await sql`
      SELECT id, amount, category, ai_category, description, vendor
      FROM transactions 
      WHERE (
        (amount > 0 AND (category NOT LIKE '%INCOME%' OR ai_category NOT LIKE '%INCOME%'))
        OR
        (amount < 0 AND (category LIKE '%INCOME%' OR ai_category LIKE '%INCOME%'))
      )
    `;
    
    console.log(`Found ${transactions.length} transactions that need recategorization`);
    
    let fixedCount = 0;
    
    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount);
      let newCategory;
      
      if (amount > 0) {
        // Income transaction - should be income category
        if (transaction.description?.toLowerCase().includes('professional') || 
            transaction.vendor?.toLowerCase().includes('consulting') ||
            transaction.description?.toLowerCase().includes('service')) {
          newCategory = 'PROFESSIONAL_INCOME';
        } else {
          newCategory = 'BUSINESS_INCOME';
        }
      } else {
        // Expense transaction - if it's currently an income category, fix it
        if (transaction.category?.includes('INCOME') || transaction.ai_category?.includes('INCOME')) {
          newCategory = 'OTHER_EXPENSES';
        }
      }
      
      if (newCategory) {
        await sql`
          UPDATE transactions 
          SET 
            category = ${newCategory},
            ai_category = ${newCategory},
            is_expense = ${amount < 0},
            needs_review = false,
            user_override = true
          WHERE id = ${transaction.id}
        `;
        
        fixedCount++;
        console.log(`Fixed transaction ${transaction.id}: $${amount} -> ${newCategory}`);
      }
    }
    
    console.log(`✅ Successfully recategorized ${fixedCount} transactions`);
    
    // Show summary of current categorization
    const summary = await sql`
      SELECT 
        CASE 
          WHEN amount > 0 THEN 'Income'
          ELSE 'Expense'
        END as transaction_type,
        category,
        COUNT(*) as count
      FROM transactions 
      GROUP BY 
        CASE WHEN amount > 0 THEN 'Income' ELSE 'Expense' END,
        category
      ORDER BY transaction_type, count DESC
    `;
    
    console.log('\n📊 Current categorization summary:');
    summary.forEach(row => {
      console.log(`${row.transaction_type}: ${row.category} (${row.count} transactions)`);
    });
    
  } catch (error) {
    console.error('Error during recategorization:', error);
  }
}

recategorizeTransactions();