import { categorizeTransaction } from '../../../server/services/openai.js';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAI Service', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as any;
    MockedOpenAI.mockImplementation(() => mockOpenAI);
  });

  describe('categorizeTransaction', () => {
    test('should categorize office supplies correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'OFFICE_EXPENSES',
              confidence: 0.95,
              explanation: 'Office supplies purchased from Staples clearly fall under office expenses category',
              isExpense: true
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await categorizeTransaction(
        'Staples',
        25.99,
        'Office supplies - pens, paper, folders'
      );

      expect(result).toEqual({
        category: 'OFFICE_EXPENSES',
        confidence: 0.95,
        explanation: 'Office supplies purchased from Staples clearly fall under office expenses category',
        isExpense: true
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: expect.stringContaining('T2125') }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });
    });

    test('should categorize meals and entertainment with notes', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'MEALS_ENTERTAINMENT',
              confidence: 0.88,
              explanation: 'Business lunch at restaurant - only 50% deductible per T2125 rules',
              isExpense: true
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await categorizeTransaction(
        'Restaurant XYZ',
        45.00,
        'Business lunch with client'
      );

      expect(result.category).toBe('MEALS_ENTERTAINMENT');
      expect(result.confidence).toBe(0.88);
      expect(result.explanation).toContain('50%');
    });

    test('should use enriched context when provided', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'ADVERTISING',
              confidence: 0.92,
              explanation: 'Google Ads spending for business promotion based on enriched context',
              isExpense: true
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const enrichedContext = 'Google Ads is an online advertising platform for promoting businesses';

      await categorizeTransaction(
        'Google',
        150.00,
        'Monthly advertising spend',
        enrichedContext
      );

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Enriched Context: Google Ads is an online advertising platform');
    });

    test('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(categorizeTransaction('Test', 100, 'Test transaction')).rejects.toThrow('API Error');
    });

    test('should handle invalid JSON responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await expect(categorizeTransaction('Test', 100, 'Test transaction')).rejects.toThrow();
    });

    test('should include all required T2125 categories in prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'OFFICE_EXPENSES',
              confidence: 0.9,
              explanation: 'Test',
              isExpense: true
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await categorizeTransaction('Test Vendor', 50, 'Test description');

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      // Should include major T2125 categories
      expect(prompt).toContain('OFFICE_EXPENSES');
      expect(prompt).toContain('MEALS_ENTERTAINMENT');
      expect(prompt).toContain('PROFESSIONAL_FEES');
      expect(prompt).toContain('ADVERTISING');
      expect(prompt).toContain('50% deductible');
    });

    test('should validate confidence score range', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'OFFICE_EXPENSES',
              confidence: 1.5, // Invalid confidence > 1
              explanation: 'Test',
              isExpense: true
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await categorizeTransaction('Test', 100, 'Test');
      
      // Should cap confidence at 1.0
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});