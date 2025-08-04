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
const PLAID_ENV = process.env.PLAID_ENV || 'production'; // Use environment variable or default to production

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
  environment: PLAID_ENV,
  envVar: process.env.PLAID_ENVIRONMENT,
  baseUrl: PLAID_ENV_URL
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

// Enhanced categorization for Canadian tax purposes with transfer detection
export function categorizePlaidTransaction(transaction: any, userAccounts: string[] = []): {
  category: string;
  isExpense: boolean;
  confidence: number;
  isTransfer: boolean;
  transferType?: 'internal' | 'external' | 'payment';
} {
  const { category, amount, name, payment_channel } = transaction;
  const isExpense = amount > 0; // Plaid uses positive for expenses
  
  // Detect transfers first
  const transferResult = detectTransfer(transaction, userAccounts);
  if (transferResult.isTransfer) {
    return {
      category: 'Transfer',
      isExpense: false, // Transfers are not expenses
      confidence: transferResult.confidence,
      isTransfer: true,
      transferType: transferResult.transferType,
    };
  }
  
  // Map Plaid categories to T2125 business categories (like Wave Accounting)
  const categoryMappings: Record<string, string> = {
    'Food and Drink': 'MEALS_ENTERTAINMENT',
    'Shops': 'OFFICE_EXPENSES',
    'Transportation': 'VEHICLE_EXPENSES', 
    'Travel': 'TRAVEL',
    'Professional Services': 'PROFESSIONAL_FEES',
    'Bank Fees': 'INTEREST_BANK_CHARGES',
    'Interest': 'INTEREST_BANK_CHARGES',
    'Telecommunication Services': 'TELEPHONE_UTILITIES',
    'Rent': 'RENT',
    'Gas Stations': 'VEHICLE_EXPENSES',
    'Software': 'OFFICE_EXPENSES',
    'Hardware Stores': 'OFFICE_EXPENSES',
    'Payment': 'BUSINESS_INCOME',
    'Deposit': 'BUSINESS_INCOME',
    'Service': 'PROFESSIONAL_FEES',
    'Entertainment': 'MEALS_ENTERTAINMENT',
    'Recreation': 'MEALS_ENTERTAINMENT',
    'Government': 'BUSINESS_TAX',
    'Insurance': 'INSURANCE',
    'Utilities': 'TELEPHONE_UTILITIES',
    'Healthcare': 'OTHER_EXPENSES',
    'Automotive': 'VEHICLE_EXPENSES',
    'Home Improvement': 'MAINTENANCE_REPAIRS',
    'Office Supplies': 'OFFICE_EXPENSES',
    'Tax': 'BUSINESS_TAX'
  };

  const primaryCategory = category?.[0] || '';
  const mappedCategory = categoryMappings[primaryCategory] || 'OTHER_EXPENSES';
  
  return {
    category: mappedCategory,
    isExpense,
    confidence: 0.85,
    isTransfer: false,
  };
}

// Detect if a transaction is a transfer between accounts
function detectTransfer(transaction: any, userAccounts: string[]): {
  isTransfer: boolean;
  confidence: number;
  transferType?: 'internal' | 'external' | 'payment';
} {
  const { category, name, payment_channel, amount } = transaction;
  const description = name.toLowerCase();
  
  // High confidence transfer indicators
  const transferKeywords = [
    'transfer', 'trf', 'e-transfer', 'etransfer', 'interac',
    'online transfer', 'mobile transfer', 'internal transfer',
    'account transfer', 'between accounts', 'from account', 'to account'
  ];
  
  const paymentKeywords = [
    'payment', 'pmt', 'bill payment', 'online payment',
    'autopay', 'pre-authorized', 'pre-auth', 'recurring payment'
  ];
  
  // Check for transfer keywords
  const hasTransferKeyword = transferKeywords.some(keyword => 
    description.includes(keyword)
  );
  
  const hasPaymentKeyword = paymentKeywords.some(keyword => 
    description.includes(keyword)
  );
  
  // Check Plaid categories
  const isPlaidTransfer = category && (
    category.includes('Transfer') || 
    category.includes('Deposit') ||
    category.includes('Payroll') ||
    category.includes('Bank Fees')
  );
  
  // Payment channel indicators
  const isOnlineTransfer = payment_channel === 'online' || payment_channel === 'other';
  
  // Determine transfer type and confidence
  if (hasTransferKeyword && isOnlineTransfer) {
    return {
      isTransfer: true,
      confidence: 0.95,
      transferType: 'internal'
    };
  }
  
  if (hasPaymentKeyword) {
    return {
      isTransfer: true,
      confidence: 0.80,
      transferType: 'payment'
    };
  }
  
  if (isPlaidTransfer && amount < 0) { // Incoming transfer
    return {
      isTransfer: true,
      confidence: 0.75,
      transferType: 'external'
    };
  }
  
  // Low confidence transfer detection based on patterns
  if (description.includes('deposit') && amount < 0) {
    return {
      isTransfer: true,
      confidence: 0.60,
      transferType: 'external'
    };
  }
  
  return {
    isTransfer: false,
    confidence: 0
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

// Enhanced transaction processing for Canadian bookkeeping with transfer detection
export async function processCanadianTransactions(
  transactions: Transaction[], 
  userAccounts: string[] = []
) {
  return transactions.map(transaction => {
    // Convert Plaid transaction to our internal format
    const amount = Math.abs(transaction.amount);
    const isExpense = transaction.amount > 0; // Plaid uses positive for outflows
    
    // Enhanced categorization with transfer detection
    const categorization = categorizePlaidTransaction(transaction, userAccounts);
    
    // Extract Canadian tax information if available (skip for transfers)
    let taxInfo = null;
    if (!categorization.isTransfer && transaction.location?.country === 'CA') {
      // Look for GST/HST patterns in merchant name or location
      const province = transaction.location.region;
      const isGstHstApplicable = ['ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'].includes(province || '');
      
      if (isGstHstApplicable && categorization.isExpense) {
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
      isExpense: categorization.isTransfer ? false : categorization.isExpense,
      isTransfer: categorization.isTransfer,
      transferType: categorization.transferType,
      description: transaction.name,
      merchant: transaction.merchant_name || transaction.name,
      date: new Date(transaction.date),
      category: categorization.category,
      subcategory: transaction.category?.[1] || null,
      location: transaction.location,
      paymentChannel: transaction.payment_channel,
      aiCategory: categorization.category,
      aiConfidence: categorization.confidence,
      needsReview: categorization.confidence < 0.8, // Low confidence needs review
      taxInfo,
      rawPlaidData: transaction,
    };
  });
}

// Get user's account IDs for transfer detection
export async function getUserAccountIds(userId: string): Promise<string[]> {
  // This would query the database to get all account IDs for the user
  // For now, return empty array - will be implemented in storage layer
  return [];
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