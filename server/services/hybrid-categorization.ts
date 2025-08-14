import { categorizeTransaction } from './openai';
import { categorizePlaidTransaction } from './plaid';
import { enrichMerchantDescription, getCachedEnrichment, setCachedEnrichment } from './merchant-enrichment';
import { MERCHANT_MAPPINGS } from '@shared/t2125-categories';

export interface HybridCategorizationResult {
  category: string;
  isExpense: boolean;
  confidence: number;
  isTransfer: boolean;
  transferType?: 'internal' | 'external' | 'payment';
  method: 'transfer_detection' | 'merchant_mapping' | 'plaid_rules' | 'ai_enhanced' | 'ai_fallback';
  explanation?: string;
  enrichedContext?: string;
}

/**
 * Hybrid categorization system that combines multiple approaches:
 * 1. Transfer Detection (rule-based, instant)
 * 2. Known Merchant Mapping (rule-based, instant) 
 * 3. Plaid Category Rules (rule-based, instant)
 * 4. AI with Enrichment (smart, 2-3 seconds)
 * 5. Manual Review Flag (low confidence)
 */
export async function categorizeTransactionHybrid(
  transaction: any,
  userAccountIds: string[] = []
): Promise<HybridCategorizationResult> {
  
  // Step 1: Transfer Detection (highest priority, instant)
  const transferResult = detectTransferAdvanced(transaction, userAccountIds);
  if (transferResult.isTransfer) {
    return {
      ...transferResult,
      method: 'transfer_detection'
    };
  }

  // Step 2: Known Merchant Mapping (high confidence, instant)
  const merchantResult = checkMerchantMapping(transaction);
  if (merchantResult.confidence >= 0.9) {
    return {
      ...merchantResult,
      method: 'merchant_mapping'
    };
  }

  // Step 3: Plaid Rule-Based Categorization (medium confidence, instant)
  const plaidResult = categorizePlaidTransaction(transaction, userAccountIds);
  if (plaidResult.confidence >= 0.85) {
    return {
      category: plaidResult.category,
      isExpense: plaidResult.isExpense,
      confidence: plaidResult.confidence,
      isTransfer: plaidResult.isTransfer,
      transferType: plaidResult.transferType,
      method: 'plaid_rules'
    };
  }

  // Step 4: AI with Merchant Enrichment (high accuracy, slower)
  try {
    const enrichmentResult = await getCachedEnrichment(transaction.name) || 
                           await enrichMerchantDescription(transaction.name, Math.abs(transaction.amount));
    
    // Cache the enrichment for future use
    if (!await getCachedEnrichment(transaction.name)) {
      setCachedEnrichment(transaction.name, enrichmentResult);
    }

    const aiResult = await categorizeTransaction(
      transaction.merchant_name || transaction.name,
      Math.abs(transaction.amount),
      transaction.name,
      enrichmentResult.enrichedContext
    );

    return {
      category: aiResult.category,
      isExpense: aiResult.isExpense,
      confidence: aiResult.confidence,
      isTransfer: false,
      method: 'ai_enhanced',
      explanation: aiResult.explanation,
      enrichedContext: enrichmentResult.enrichedContext
    };
  } catch (aiError) {
    console.log(`AI categorization failed for ${transaction.name}, using fallback:`, aiError);
    
    // Step 5: Fallback to best available result
    if (merchantResult.confidence > 0) {
      return {
        ...merchantResult,
        method: 'merchant_mapping'
      };
    }
    
    return {
      category: plaidResult.category,
      isExpense: plaidResult.isExpense,
      confidence: Math.max(plaidResult.confidence - 0.2, 0.3), // Lower confidence for fallback
      isTransfer: plaidResult.isTransfer,
      transferType: plaidResult.transferType,
      method: 'ai_fallback'
    };
  }
}

/**
 * Enhanced transfer detection with Canadian banking patterns
 */
function detectTransferAdvanced(transaction: any, userAccountIds: string[]): HybridCategorizationResult {
  const { category, name, payment_channel, amount } = transaction;
  const description = name.toLowerCase();
  const isExpense = amount > 0; // Plaid uses positive for expenses
  
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
    category.includes('Payroll')
  );
  
  // Payment channel indicators
  const isOnlineTransfer = payment_channel === 'online' || payment_channel === 'other';
  
  // Determine transfer type and confidence
  if (hasTransferKeyword && isOnlineTransfer) {
    return {
      category: 'Transfer',
      isExpense: false,
      confidence: 0.95,
      isTransfer: true,
      transferType: 'internal',
      method: 'transfer_detection'
    };
  }
  
  if (hasPaymentKeyword) {
    return {
      category: 'Transfer',
      isExpense: false,
      confidence: 0.85,
      isTransfer: true,
      transferType: 'payment',
      method: 'transfer_detection'
    };
  }
  
  if (isPlaidTransfer && amount < 0) { // Incoming transfer
    return {
      category: 'Transfer',
      isExpense: false,
      confidence: 0.80,
      isTransfer: true,
      transferType: 'external',
      method: 'transfer_detection'
    };
  }
  
  return {
    category: '',
    isExpense,
    confidence: 0,
    isTransfer: false,
    method: 'transfer_detection'
  };
}

/**
 * Check against known merchant mappings for instant categorization
 */
function checkMerchantMapping(transaction: any): Omit<HybridCategorizationResult, 'method'> {
  const description = transaction.name.toLowerCase();
  const merchantName = (transaction.merchant_name || '').toLowerCase();
  const isExpense = transaction.amount > 0;
  
  // Check both description and merchant name against our mappings
  for (const [merchant, category] of Object.entries(MERCHANT_MAPPINGS)) {
    if (description.includes(merchant) || merchantName.includes(merchant)) {
      return {
        category,
        isExpense,
        confidence: 0.95, // High confidence for known merchants
        isTransfer: false
      };
    }
  }
  
  // No match found
  return {
    category: isExpense ? 'OTHER_EXPENSES' : 'BUSINESS_INCOME',
    isExpense,
    confidence: 0,
    isTransfer: false
  };
}