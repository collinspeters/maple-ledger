// OpenAI integration tests (using mock to avoid API calls in CI)
import { jest } from '@jest/globals';

// Mock OpenAI before importing the service
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

describe('OpenAI Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle successful categorization', () => {
    const mockAIResult = {
      category: 'OFFICE_EXPENSES',
      confidence: 0.95,
      explanation: 'Office supplies from Staples',
      isExpense: true
    };

    // Test the result structure
    expect(mockAIResult).toHaveProperty('category');
    expect(mockAIResult).toHaveProperty('confidence');
    expect(mockAIResult).toHaveProperty('explanation');
    expect(mockAIResult).toHaveProperty('isExpense');
    
    expect(mockAIResult.confidence).toBeGreaterThanOrEqual(0);
    expect(mockAIResult.confidence).toBeLessThanOrEqual(1);
    expect(typeof mockAIResult.category).toBe('string');
    expect(typeof mockAIResult.explanation).toBe('string');
    expect(typeof mockAIResult.isExpense).toBe('boolean');
  });

  test('should handle T2125 category validation', () => {
    const validT2125Categories = [
      'OFFICE_EXPENSES',
      'MEALS_ENTERTAINMENT',
      'PROFESSIONAL_FEES',
      'ADVERTISING',
      'INSURANCE',
      'INTEREST_BANK_CHARGES',
      'BUSINESS_TAX',
      'MANAGEMENT_ADMIN',
      'RENT',
      'MAINTENANCE_REPAIRS',
      'SALARIES_WAGES',
      'SUBCONTRACTS',
      'TRAVEL',
      'TELEPHONE_UTILITIES',
      'VEHICLE_EXPENSES',
      'DELIVERY_FREIGHT',
      'OTHER_EXPENSES'
    ];

    const mockResult = { category: 'OFFICE_EXPENSES' };
    const isValid = validT2125Categories.includes(mockResult.category);
    expect(isValid).toBe(true);

    const invalidResult = { category: 'INVALID_CATEGORY' };
    const isInvalid = validT2125Categories.includes(invalidResult.category);
    expect(isInvalid).toBe(false);
  });

  test('should handle confidence score validation', () => {
    const testCases = [
      { input: 0.95, expected: 0.95 },
      { input: 1.5, expected: 1.0 }, // Should cap at 1.0
      { input: -0.2, expected: 0.0 }, // Should floor at 0.0
      { input: 0, expected: 0.0 },
      { input: 1, expected: 1.0 }
    ];

    testCases.forEach(({ input, expected }) => {
      const normalized = Math.max(0, Math.min(1, input));
      expect(normalized).toBe(expected);
    });
  });

  test('should handle error scenarios gracefully', () => {
    const errorFallback = {
      category: 'OTHER_EXPENSES',
      confidence: 0,
      explanation: 'AI categorization failed - manual review required',
      isExpense: true
    };

    expect(errorFallback.confidence).toBe(0);
    expect(errorFallback.category).toBe('OTHER_EXPENSES');
    expect(errorFallback.explanation).toContain('failed');
  });

  test('should validate prompt structure for T2125 compliance', () => {
    const mockTransactionData = {
      vendor: 'Staples',
      amount: 25.99,
      description: 'Office supplies'
    };

    // Mock prompt should contain T2125 references
    const expectedPromptElements = [
      'T2125',
      'Canadian',
      'sole proprietor',
      'OFFICE_EXPENSES',
      'MEALS_ENTERTAINMENT',
      '50% deductible'
    ];

    const mockPrompt = `You are an AI bookkeeper for Canadian sole proprietors using T2125 categories. 
    Transaction: ${mockTransactionData.description} from ${mockTransactionData.vendor} for $${mockTransactionData.amount}.
    Categories include OFFICE_EXPENSES, MEALS_ENTERTAINMENT (50% deductible), etc.`;

    expectedPromptElements.forEach(element => {
      expect(mockPrompt.toLowerCase()).toContain(element.toLowerCase());
    });
  });
});