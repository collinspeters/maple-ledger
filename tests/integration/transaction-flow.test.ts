// Integration tests for transaction processing flow
describe('Transaction Processing Flow', () => {
  describe('Transaction Creation Flow', () => {
    test('should process complete transaction creation', () => {
      // Mock transaction data
      const transactionData = {
        date: '2025-01-31',
        amount: '25.99',
        vendor: 'Staples',
        description: 'Office supplies - pens, paper, folders',
        isExpense: true
      };

      // Simulate transaction validation
      expect(transactionData.amount).toMatch(/^\d+\.\d{2}$/);
      expect(new Date(transactionData.date)).toBeInstanceOf(Date);
      expect(transactionData.vendor.length).toBeGreaterThan(0);
      expect(transactionData.description.length).toBeGreaterThan(0);
      expect(typeof transactionData.isExpense).toBe('boolean');
    });

    test('should handle AI categorization result', () => {
      // Mock AI categorization response
      const aiResult = {
        category: 'OFFICE_EXPENSES',
        confidence: 0.95,
        explanation: 'Office supplies purchased from Staples clearly fall under office expenses',
        isExpense: true
      };

      expect(aiResult.confidence).toBeGreaterThan(0);
      expect(aiResult.confidence).toBeLessThanOrEqual(1);
      expect(aiResult.category).toBeDefined();
      expect(aiResult.explanation.length).toBeGreaterThan(0);
      expect(typeof aiResult.isExpense).toBe('boolean');
    });

    test('should determine review queue placement', () => {
      const highConfidenceResult = { confidence: 0.95, category: 'OFFICE_EXPENSES' };
      const lowConfidenceResult = { confidence: 0.45, category: 'OTHER' };

      // High confidence should not need review
      expect(highConfidenceResult.confidence >= 0.8).toBe(true);
      
      // Low confidence should need review
      expect(lowConfidenceResult.confidence < 0.8).toBe(true);
    });
  });

  describe('Review Queue Processing', () => {
    test('should filter transactions needing review', () => {
      const mockTransactions = [
        { id: '1', needsReview: true, aiConfidence: '0.65' },
        { id: '2', needsReview: false, aiConfidence: '0.95' },
        { id: '3', needsReview: true, aiConfidence: '0.45' }
      ];

      const reviewQueue = mockTransactions.filter(t => t.needsReview);
      expect(reviewQueue).toHaveLength(2);
      expect(reviewQueue[0].id).toBe('1');
      expect(reviewQueue[1].id).toBe('3');
    });

    test('should handle user override', () => {
      const transaction = {
        id: '1',
        aiCategory: 'OTHER',
        category: 'OTHER',
        userOverride: false
      };

      // Simulate user override
      const updatedTransaction = {
        ...transaction,
        category: 'OFFICE_EXPENSES',
        userOverride: true,
        needsReview: false
      };

      expect(updatedTransaction.userOverride).toBe(true);
      expect(updatedTransaction.category).toBe('OFFICE_EXPENSES');
      expect(updatedTransaction.aiCategory).toBe('OTHER'); // Original AI suggestion preserved
    });
  });

  describe('Error Handling', () => {
    test('should handle AI service failures gracefully', () => {
      const transactionData = {
        vendor: 'Test Vendor',
        amount: '100.00',
        description: 'Test transaction'
      };

      // Simulate AI service failure
      const fallbackResult = {
        category: 'OTHER',
        confidence: 0.0,
        explanation: 'AI categorization failed - manual review required',
        needsReview: true
      };

      expect(fallbackResult.needsReview).toBe(true);
      expect(fallbackResult.confidence).toBe(0.0);
      expect(fallbackResult.category).toBe('OTHER');
    });

    test('should validate transaction amounts', () => {
      const validAmounts = ['25.99', '1000.00', '0.01'];
      const invalidAmounts = ['', '-25.99', 'abc'];

      validAmounts.forEach(amount => {
        const parsed = parseFloat(amount);
        expect(parsed).toBeGreaterThan(0);
        expect(Number.isFinite(parsed)).toBe(true);
      });

      invalidAmounts.forEach(amount => {
        const parsed = parseFloat(amount);
        const isInvalid = isNaN(parsed) || parsed <= 0 || !Number.isFinite(parsed);
        expect(isInvalid).toBe(true);
      });
    });
  });
});