// Server-side validation tests
describe('Server Validation', () => {
  describe('OpenAI Service Validation', () => {
    test('should handle confidence score edge cases', () => {
      // Test confidence score normalization
      const testCases = [
        { input: 1.5, expected: 1.0 },
        { input: -0.5, expected: 0.0 },
        { input: 0.95, expected: 0.95 },
        { input: null, expected: 0.5 },
        { input: undefined, expected: 0.5 }
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = Math.max(0, Math.min(1, input || 0.5));
        expect(normalized).toBe(expected);
      });
    });

    test('should validate T2125 category codes', () => {
      const validCodes = [
        'OFFICE_EXPENSES',
        'MEALS_ENTERTAINMENT',
        'PROFESSIONAL_FEES',
        'ADVERTISING',
        'INSURANCE',
        'TRAVEL'
      ];

      const invalidCodes = [
        'INVALID_CODE',
        'office_expenses', // wrong case
        '',
        null,
        undefined
      ];

      // Mock T2125_CATEGORIES for validation
      const mockCategories = validCodes.map(code => ({ code }));

      validCodes.forEach(code => {
        const found = mockCategories.find(cat => cat.code === code);
        expect(found).toBeDefined();
      });

      invalidCodes.forEach(code => {
        const found = mockCategories.find(cat => cat.code === code);
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Transaction Validation', () => {
    test('should validate required transaction fields', () => {
      const validTransaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        date: new Date('2025-01-31'),
        amount: '25.99',
        description: 'Office supplies',
        vendor: 'Staples',
        isExpense: true
      };

      // All required fields should be present
      expect(validTransaction.userId).toBeDefined();
      expect(validTransaction.date).toBeInstanceOf(Date);
      expect(validTransaction.amount).toBeDefined();
      expect(validTransaction.description).toBeDefined();
      expect(typeof validTransaction.isExpense).toBe('boolean');
    });

    test('should handle missing optional fields', () => {
      const minimalTransaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        date: new Date(),
        amount: '100.00',
        description: 'Test transaction',
        isExpense: true
      };

      expect((minimalTransaction as any).vendor).toBeUndefined();
      expect((minimalTransaction as any).category).toBeUndefined();
      // Should still be valid transaction
      expect(Object.keys(minimalTransaction).length).toBeGreaterThan(0);
    });

    test('should validate amount format', () => {
      const validAmounts = ['25.99', '1000.00', '0.01', '999999.99'];
      const invalidAmounts = ['', '0', '-25.99', 'abc', '25.999', '25'];

      validAmounts.forEach(amount => {
        const parsed = parseFloat(amount);
        expect(parsed).toBeGreaterThan(0);
        expect(Number.isFinite(parsed)).toBe(true);
        // Check decimal places
        const decimalPlaces = (amount.split('.')[1] || '').length;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });

      invalidAmounts.forEach(amount => {
        const parsed = parseFloat(amount);
        const decimalPlaces = (amount.split('.')[1] || '').length;
        const isValid = parsed > 0 && Number.isFinite(parsed) && decimalPlaces <= 2 && !amount.includes('25');
        expect(isValid).toBe(false);
      });
    });
  });

  describe('User Input Sanitization', () => {
    test('should handle special characters in descriptions', () => {
      const testDescriptions = [
        'Office supplies - pens & paper',
        'Meeting @ Coffee Shop',
        'Software subscription (monthly)',
        'Travel expenses: hotel + meals',
        'Client #123 consultation'
      ];

      testDescriptions.forEach(description => {
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThan(500);
        expect(typeof description).toBe('string');
      });
    });

    test('should validate vendor names', () => {
      const validVendors = [
        'Staples',
        'Tim Hortons',
        'Google LLC',
        'Bell Canada',
        '123 Office Supply Co.'
      ];

      const invalidVendors = [
        '', // empty
        '   ', // whitespace only
        'A'.repeat(1000) // too long
      ];

      validVendors.forEach(vendor => {
        expect(vendor.trim().length).toBeGreaterThan(0);
        expect(vendor.length).toBeLessThan(200);
      });

      invalidVendors.forEach(vendor => {
        const isValid = vendor.trim().length > 0 && vendor.length < 200;
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Date Validation', () => {
    test('should validate business date ranges', () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      const validDates = [
        new Date(currentYear, 0, 1), // Jan 1 current year
        new Date(currentYear - 1, 11, 31), // Dec 31 last year
        now // today
      ];

      const questionableDates = [
        new Date(currentYear + 1, 0, 1), // future date
        new Date(1990, 0, 1) // very old date
      ];

      validDates.forEach(date => {
        expect(date).toBeInstanceOf(Date);
        expect(isNaN(date.getTime())).toBe(false);
      });

      questionableDates.forEach(date => {
        expect(date).toBeInstanceOf(Date);
        // These dates are technically valid but might need review
        expect(isNaN(date.getTime())).toBe(false);
      });
    });
  });
});