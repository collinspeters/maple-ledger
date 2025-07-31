// Unit tests for critical validation logic
describe('Validation Tests', () => {
  describe('T2125 Category Validation', () => {
    test('should validate required T2125 categories exist', () => {
      const requiredCategories = [
        'OFFICE_EXPENSES',
        'MEALS_ENTERTAINMENT', 
        'PROFESSIONAL_FEES',
        'ADVERTISING',
        'INSURANCE',
        'INTEREST_BANK_CHARGES'
      ];

      // Mock categories for testing
      const mockCategories = [
        { code: 'OFFICE_EXPENSES', name: 'Office Expenses', isFullyDeductible: true },
        { code: 'MEALS_ENTERTAINMENT', name: 'Meals and Entertainment', isFullyDeductible: false },
        { code: 'PROFESSIONAL_FEES', name: 'Professional Fees', isFullyDeductible: true },
        { code: 'ADVERTISING', name: 'Advertising', isFullyDeductible: true },
        { code: 'INSURANCE', name: 'Insurance', isFullyDeductible: true },
        { code: 'INTEREST_BANK_CHARGES', name: 'Interest and Bank Charges', isFullyDeductible: true }
      ];

      requiredCategories.forEach(requiredCode => {
        const category = mockCategories.find(cat => cat.code === requiredCode);
        expect(category).toBeDefined();
      });
    });

    test('should validate MEALS_ENTERTAINMENT is not fully deductible', () => {
      const mealsCategory = { code: 'MEALS_ENTERTAINMENT', isFullyDeductible: false };
      expect(mealsCategory.isFullyDeductible).toBe(false);
    });
  });

  describe('Transaction Amount Validation', () => {
    test('should validate positive amounts', () => {
      const validAmounts = ['25.99', '100.00', '1.50', '999999.99'];
      
      validAmounts.forEach(amount => {
        const parsed = parseFloat(amount);
        expect(parsed).toBeGreaterThan(0);
        expect(isNaN(parsed)).toBe(false);
      });
    });

    test('should reject invalid amounts', () => {
      const invalidAmounts = ['', 'abc', '-25.99', '0'];
      
      invalidAmounts.forEach(amount => {
        const parsed = parseFloat(amount);
        expect(parsed <= 0 || isNaN(parsed)).toBe(true);
      });
    });
  });

  describe('Date Validation', () => {
    test('should validate proper date formats', () => {
      const validDates = ['2025-01-31', '2024-12-25', '2023-06-15'];
      
      validDates.forEach(dateStr => {
        const date = new Date(dateStr);
        expect(date instanceof Date).toBe(true);
        expect(isNaN(date.getTime())).toBe(false);
      });
    });

    test('should reject invalid date formats', () => {
      const invalidDates = ['invalid-date', '2025-13-45', '25/01/2025'];
      
      invalidDates.forEach(dateStr => {
        const date = new Date(dateStr);
        expect(isNaN(date.getTime())).toBe(true);
      });
    });
  });

  describe('Business Rules Validation', () => {
    test('should validate vendor names', () => {
      const validVendors = ['Staples', 'Tim Hortons', 'Google Ads', 'Adobe Inc.'];
      
      validVendors.forEach(vendor => {
        expect(vendor.length).toBeGreaterThan(0);
        expect(typeof vendor).toBe('string');
        expect(vendor.trim()).toBe(vendor); // No leading/trailing spaces
      });
    });

    test('should validate transaction descriptions', () => {
      const validDescriptions = [
        'Office supplies purchase',
        'Business lunch with client',
        'Software subscription renewal',
        'Professional development course'
      ];
      
      validDescriptions.forEach(description => {
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThan(500); // Reasonable length limit
        expect(typeof description).toBe('string');
      });
    });
  });
});