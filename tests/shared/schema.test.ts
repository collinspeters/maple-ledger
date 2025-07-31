import { 
  insertTransactionSchema,
  insertUserSchema,
  insertReceiptSchema,
  insertAiSuggestionSchema,
  insertChatMessageSchema
} from '@shared/schema';

describe('Database Schemas', () => {
  describe('insertTransactionSchema', () => {
    test('should validate valid transaction data', () => {
      const validTransaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-31',
        amount: '25.99',
        description: 'Office supplies',
        vendor: 'Staples',
        isExpense: true
      };

      const result = insertTransactionSchema.safeParse(validTransaction);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
        expect(result.data.amount).toBe('25.99');
      }
    });

    test('should reject missing required fields', () => {
      const invalidTransaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        // Missing date, amount, description
      };

      const result = insertTransactionSchema.safeParse(invalidTransaction);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => e.path[0]);
        expect(errors).toContain('date');
        expect(errors).toContain('amount');
        expect(errors).toContain('description');
      }
    });

    test('should transform date string to Date object', () => {
      const transaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-31',
        amount: '25.99',
        description: 'Test transaction',
        isExpense: true
      };

      const result = insertTransactionSchema.safeParse(transaction);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
        expect(result.data.date.getFullYear()).toBe(2025);
        expect(result.data.date.getMonth()).toBe(0); // January is 0
        expect(result.data.date.getDate()).toBe(31);
      }
    });

    test('should handle invalid date strings', () => {
      const transaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        date: 'invalid-date',
        amount: '25.99',
        description: 'Test transaction',
        isExpense: true
      };

      const result = insertTransactionSchema.safeParse(transaction);
      expect(result.success).toBe(false);
    });
  });

  describe('insertUserSchema', () => {
    test('should validate valid user data', () => {
      const validUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'securepassword123',
        businessName: 'Test Business',
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = insertUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    test('should reject invalid email', () => {
      const invalidUser = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'securepassword123'
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    test('should require username, email, and password', () => {
      const result = insertUserSchema.safeParse({});
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => e.path[0]);
        expect(errors).toContain('username');
        expect(errors).toContain('email');
        expect(errors).toContain('password');
      }
    });
  });

  describe('insertReceiptSchema', () => {
    test('should validate valid receipt data', () => {
      const validReceipt = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        fileName: 'receipt.pdf',
        filePath: '/uploads/receipt.pdf',
        extractedAmount: '15.99',
        extractedVendor: 'Coffee Shop',
        status: 'processed'
      };

      const result = insertReceiptSchema.safeParse(validReceipt);
      expect(result.success).toBe(true);
    });

    test('should require userId, fileName, and filePath', () => {
      const result = insertReceiptSchema.safeParse({});
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => e.path[0]);
        expect(errors).toContain('userId');
        expect(errors).toContain('fileName');
        expect(errors).toContain('filePath');
      }
    });
  });

  describe('insertAiSuggestionSchema', () => {
    test('should validate valid AI suggestion data', () => {
      const validSuggestion = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        suggestionType: 'categorization',
        originalPrompt: 'Categorize: Staples office supplies',
        aiResponse: { category: 'OFFICE_EXPENSES', confidence: 0.95 },
        confidence: '0.95'
      };

      const result = insertAiSuggestionSchema.safeParse(validSuggestion);
      expect(result.success).toBe(true);
    });
  });

  describe('insertChatMessageSchema', () => {
    test('should validate valid chat message data', () => {
      const validMessage = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'What were my office expenses last month?',
        response: 'Your office expenses totaled $150.99 last month.',
        messageType: 'financial_query'
      };

      const result = insertChatMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });
  });
});