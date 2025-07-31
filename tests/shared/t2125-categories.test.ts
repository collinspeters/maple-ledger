import { 
  T2125_CATEGORIES, 
  getExpenseCategories, 
  getIncomeCategories,
  findCategoryByCode,
  type T2125Category 
} from '@shared/t2125-categories';

describe('T2125 Categories', () => {
  describe('T2125_CATEGORIES', () => {
    test('should contain all required expense categories', () => {
      expect(T2125_CATEGORIES).toBeDefined();
      expect(Array.isArray(T2125_CATEGORIES)).toBe(true);
      expect(T2125_CATEGORIES.length).toBeGreaterThan(0);
    });

    test('should have valid category structure', () => {
      T2125_CATEGORIES.forEach((category: T2125Category) => {
        expect(category).toHaveProperty('code');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('lineNumber');
        expect(category).toHaveProperty('isFullyDeductible');
        
        expect(typeof category.code).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.description).toBe('string');
        expect(typeof category.lineNumber).toBe('string');
        expect(typeof category.isFullyDeductible).toBe('boolean');
      });
    });

    test('should contain MEALS_ENTERTAINMENT with 50% deductibility', () => {
      const mealsCategory = T2125_CATEGORIES.find(cat => cat.code === 'MEALS_ENTERTAINMENT');
      expect(mealsCategory).toBeDefined();
      expect(mealsCategory?.isFullyDeductible).toBe(false);
      expect(mealsCategory?.notes).toContain('50%');
    });

    test('should have unique category codes', () => {
      const codes = T2125_CATEGORIES.map(cat => cat.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    test('should have unique line numbers', () => {
      const lineNumbers = T2125_CATEGORIES.map(cat => cat.lineNumber);
      const uniqueLineNumbers = new Set(lineNumbers);
      expect(lineNumbers.length).toBe(uniqueLineNumbers.size);
    });
  });

  describe('getExpenseCategories', () => {
    test('should return expense categories', () => {
      const expenses = getExpenseCategories();
      expect(Array.isArray(expenses)).toBe(true);
      expect(expenses.length).toBeGreaterThan(0);
      
      // Should not include income categories
      const incomeCategories = expenses.filter(cat => 
        cat.code.includes('INCOME') || cat.code.includes('REVENUE')
      );
      expect(incomeCategories.length).toBe(0);
    });
  });

  describe('getIncomeCategories', () => {
    test('should return income categories', () => {
      const income = getIncomeCategories();
      expect(Array.isArray(income)).toBe(true);
      expect(income.length).toBeGreaterThan(0);
      
      // Should include business income
      const businessIncome = income.find(cat => cat.code === 'BUSINESS_INCOME');
      expect(businessIncome).toBeDefined();
    });
  });

  describe('findCategoryByCode', () => {
    test('should find category by valid code', () => {
      const category = findCategoryByCode('OFFICE_EXPENSES');
      expect(category).toBeDefined();
      expect(category?.code).toBe('OFFICE_EXPENSES');
      expect(category?.name).toContain('Office');
    });

    test('should return undefined for invalid code', () => {
      const category = findCategoryByCode('INVALID_CODE');
      expect(category).toBeUndefined();
    });

    test('should handle case sensitivity', () => {
      const category = findCategoryByCode('office_expenses');
      expect(category).toBeUndefined(); // Should be case sensitive
    });
  });
});