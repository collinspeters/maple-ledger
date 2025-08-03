import { 
  PlaidApi, 
  PlaidEnvironments, 
  Configuration, 
  AccountsGetRequest, 
  TransactionsGetRequest, 
  ItemPublicTokenExchangeRequest, 
  LinkTokenCreateRequest, 
  CountryCode, 
  Products,
  RemovedTransaction,
  Transaction,
  DepositoryAccountSubtype,
  CreditAccountSubtype
} from 'plaid';

// Validate required environment variables
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENVIRONMENT || 'sandbox';

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error('Missing required Plaid environment variables: PLAID_CLIENT_ID, PLAID_SECRET');
  throw new Error('Missing required Plaid environment variables: PLAID_CLIENT_ID, PLAID_SECRET');
}

// Determine the correct Plaid environment
let PLAID_ENV_URL;
switch (PLAID_ENV) {
  case 'production':
    PLAID_ENV_URL = PlaidEnvironments.production;
    break;
  case 'development':
    PLAID_ENV_URL = PlaidEnvironments.development;
    break;
  case 'sandbox':
  default:
    PLAID_ENV_URL = PlaidEnvironments.sandbox;
    break;
}

// Initialize Plaid client following official quickstart pattern
const configuration = new Configuration({
  basePath: PLAID_ENV_URL,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14', // Latest API version
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

console.log('Plaid Configuration:', {
  clientId: PLAID_CLIENT_ID?.substring(0, 10) + '...',
  secret: PLAID_SECRET?.substring(0, 10) + '...',
  environment: PLAID_ENV
});

// Create link token for Plaid Link initialization - following official quickstart pattern
export async function createLinkToken(userId: string): Promise<string> {
  try {
    // Based on Plaid's official quickstart implementation
    const configs: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: "BookkeepAI - Canadian Bookkeeping",
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca], // Canada-specific
      language: 'en',
      // Optional: Include webhook for real-time updates
      // webhook: 'https://your-domain.com/plaid/webhook',
      // Optional: Account filters for Canadian institutions
      account_filters: {
        depository: {
          account_subtypes: [
            DepositoryAccountSubtype.Checking, 
            DepositoryAccountSubtype.Savings, 
            DepositoryAccountSubtype.MoneyMarket
          ]
        },
        credit: {
          account_subtypes: [
            CreditAccountSubtype.CreditCard

          ]
        }
      }
    };

    // Handle OAuth redirect URIs if needed
    if (PLAID_ENV !== 'sandbox') {
      configs.redirect_uri = process.env.PLAID_REDIRECT_URI;
    }

    const createTokenResponse = await plaidClient.linkTokenCreate(configs);
    return createTokenResponse.data.link_token;
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    throw new Error('Failed to create Plaid link token');
  }
}

// Exchange public token for access token - following official quickstart pattern
export async function exchangePublicToken(publicToken: string): Promise<{ 
  accessToken: string; 
  itemId: string; 
  requestId: string; 
}> {
  try {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    const response = await plaidClient.itemPublicTokenExchange(request);
    
    // Return comprehensive data following quickstart pattern
    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
      requestId: response.data.request_id,
    };
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw new Error('Failed to exchange public token for access token');
  }
}

// Get account information - following official quickstart pattern
export async function getAccounts(accessToken: string) {
  try {
    const request: AccountsGetRequest = {
      access_token: accessToken,
    };

    const response = await plaidClient.accountsGet(request);
    
    // Return formatted account data
    return {
      accounts: response.data.accounts,
      item: response.data.item,
      requestId: response.data.request_id,
    };
  } catch (error) {
    console.error('Error fetching Plaid accounts:', error);
    throw new Error('Failed to fetch bank accounts from Plaid');
  }
}

// Get transactions using the legacy endpoint (still useful for historical data)
export async function getTransactions(accessToken: string, startDate: Date, endDate: Date) {
  try {
    const request: TransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      options: {
        count: 500, // Maximum number of transactions per request
        offset: 0,
      }
    };

    const response = await plaidClient.transactionsGet(request);
    
    // Handle pagination if needed - following quickstart pattern
    let transactions = response.data.transactions;
    const totalTransactions = response.data.total_transactions;
    
    // Fetch remaining transactions if needed
    while (transactions.length < totalTransactions) {
      const paginatedRequest: TransactionsGetRequest = {
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        options: {
          count: 500,
          offset: transactions.length,
        }
      };
      
      const paginatedResponse = await plaidClient.transactionsGet(paginatedRequest);
      transactions = transactions.concat(paginatedResponse.data.transactions);
    }

    return {
      transactions,
      accounts: response.data.accounts,
      item: response.data.item,
      totalTransactions,
      requestId: response.data.request_id,
    };
  } catch (error) {
    console.error('Error fetching Plaid transactions:', error);
    throw new Error('Failed to fetch transactions from Plaid');
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

// Sync transactions for real-time updates - following official quickstart pattern
export async function syncTransactions(accessToken: string, cursor?: string): Promise<{
  added: Transaction[];
  modified: Transaction[];
  removed: RemovedTransaction[];
  nextCursor: string;
  hasMore: boolean;
  requestId: string;
}> {
  try {
    const request = {
      access_token: accessToken,
      cursor: cursor,
    };

    const response = await plaidClient.transactionsSync(request);
    
    return {
      added: response.data.added,
      modified: response.data.modified,
      removed: response.data.removed,
      nextCursor: response.data.next_cursor,
      hasMore: response.data.has_more,
      requestId: response.data.request_id,
    };
  } catch (error) {
    console.error('Error syncing Plaid transactions:', error);
    throw new Error('Failed to sync transactions from Plaid');
  }
}

// Enhanced transaction processing for Canadian bookkeeping
export async function processCanadianTransactions(transactions: Transaction[]) {
  return transactions.map(transaction => {
    // Convert Plaid transaction to our internal format
    const amount = Math.abs(transaction.amount);
    const isExpense = transaction.amount > 0; // Plaid uses positive for outflows
    
    // Extract Canadian tax information if available
    let taxInfo = null;
    if (transaction.location?.country === 'CA') {
      // Look for GST/HST patterns in merchant name or location
      const province = transaction.location.region;
      const isGstHstApplicable = ['ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'].includes(province || '');
      
      if (isGstHstApplicable) {
        taxInfo = {
          province,
          gstHstRate: getCanadianTaxRate(province || ''),
          estimatedTax: amount * (getCanadianTaxRate(province || '') / 100),
        };
      }
    }

    return {
      plaidTransactionId: transaction.transaction_id,
      accountId: transaction.account_id,
      amount: amount.toString(),
      isExpense,
      description: transaction.name,
      merchant: transaction.merchant_name || transaction.name,
      date: new Date(transaction.date),
      category: transaction.category?.[0] || 'Other',
      subcategory: transaction.category?.[1] || null,
      location: transaction.location,
      paymentChannel: transaction.payment_channel,
      taxInfo,
      rawPlaidData: transaction,
    };
  });
}

// Helper function for Canadian tax rates
function getCanadianTaxRate(province?: string): number {
  const taxRates: { [key: string]: number } = {
    'ON': 13, // HST
    'BC': 12, // GST + PST
    'AB': 5,  // GST only
    'SK': 11, // GST + PST
    'MB': 12, // GST + PST
    'QC': 14.975, // GST + QST
    'NB': 15, // HST
    'NS': 15, // HST
    'PE': 15, // HST
    'NL': 15, // HST
    'YT': 5,  // GST only
    'NT': 5,  // GST only
    'NU': 5,  // GST only
  };
  
  return taxRates[province || ''] || 5; // Default to GST only
}