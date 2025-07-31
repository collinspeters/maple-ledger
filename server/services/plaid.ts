import { PlaidApi, PlaidEnvironments, Configuration, AccountsGetRequest, TransactionsGetRequest, ItemPublicTokenExchangeRequest, LinkTokenCreateRequest, CountryCode, Products } from 'plaid';

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET || !process.env.PLAID_ENVIRONMENT) {
  throw new Error('Missing required Plaid environment variables: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENVIRONMENT');
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENVIRONMENT as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Create link token for Plaid Link initialization
export async function createLinkToken(userId: string): Promise<string> {
  try {
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: "BookkeepAI",
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca], // Canada
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    return response.data.link_token;
  } catch (error) {
    console.error('Error creating link token:', error);
    throw new Error('Failed to create link token');
  }
}

// Exchange public token for access token
export async function exchangePublicToken(publicToken: string): Promise<string> {
  try {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    const response = await plaidClient.itemPublicTokenExchange(request);
    return response.data.access_token;
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw new Error('Failed to exchange public token');
  }
}

// Get account information
export async function getAccounts(accessToken: string) {
  try {
    const request: AccountsGetRequest = {
      access_token: accessToken,
    };

    const response = await plaidClient.accountsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw new Error('Failed to fetch accounts');
  }
}

// Get transactions
export async function getTransactions(accessToken: string, startDate: Date, endDate: Date) {
  try {
    const request: TransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    };

    const response = await plaidClient.transactionsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw new Error('Failed to fetch transactions');
  }
}

// Categorize transaction for Canadian tax purposes
export function categorizePlaidTransaction(transaction: any): {
  category: string;
  isExpense: boolean;
  confidence: number;
} {
  const { category, amount } = transaction;
  const isExpense = amount > 0; // Plaid uses positive for expenses
  
  // Map Plaid categories to Canadian business categories
  const categoryMappings: Record<string, string> = {
    'Food and Drink': 'Meals and Entertainment',
    'Shops': 'Office Supplies',
    'Transportation': 'Vehicle Expenses',
    'Travel': 'Travel Expenses',
    'Professional Services': 'Professional Fees',
    'Bank Fees': 'Bank Charges',
    'Interest': 'Interest Expense',
    'Telecommunication Services': 'Telephone and Internet',
    'Rent': 'Rent',
    'Gas Stations': 'Fuel',
    'Software': 'Software Subscriptions',
    'Hardware Stores': 'Equipment and Supplies',
    'Payment': 'Income',
    'Deposit': 'Income',
    'Transfer': 'Transfer',
  };

  const primaryCategory = category?.[0] || 'Other';
  const mappedCategory = categoryMappings[primaryCategory] || 'Other Business Expenses';
  
  return {
    category: mappedCategory,
    isExpense,
    confidence: 0.85, // High confidence for automated categorization
  };
}

// Sync transactions from Plaid
export async function syncTransactions(accessToken: string, userId: string, lastSyncDate?: Date) {
  try {
    const endDate = new Date();
    const startDate = lastSyncDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days back

    const transactionsData = await getTransactions(accessToken, startDate, endDate);
    
    return transactionsData.transactions.map((transaction: any) => {
      const categorization = categorizePlaidTransaction(transaction);
      
      return {
        userId,
        description: transaction.name,
        amount: Math.abs(transaction.amount).toString(),
        date: new Date(transaction.date),
        category: categorization.category,
        isExpense: categorization.isExpense,
        plaidTransactionId: transaction.transaction_id,
        plaidAccountId: transaction.account_id,
        confidence: categorization.confidence,
        isVerified: false, // Require user verification
      };
    });
  } catch (error) {
    console.error('Error syncing transactions:', error);
    throw new Error('Failed to sync transactions');
  }
}