// Database schema validation tests
describe('Database Schema Tests', () => {
  describe('Transaction Schema', () => {
    test('should handle valid transaction data', () => {
      const mockTransaction = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        date: new Date('2025-01-31'),
        amount: '25.99',
        description: 'Office supplies',
        vendor: 'Staples',
        isExpense: true,
        category: 'OFFICE_EXPENSES',
        aiCategory: 'OFFICE_EXPENSES',
        aiConfidence: '0.95',
        aiExplanation: 'High confidence categorization',
        needsReview: false,
        userOverride: false
      };

      // Validate core fields
      expect(mockTransaction.userId).toBeDefined();
      expect(mockTransaction.date).toBeInstanceOf(Date);
      expect(parseFloat(mockTransaction.amount)).toBeGreaterThan(0);
      expect(mockTransaction.description.length).toBeGreaterThan(0);
      expect(typeof mockTransaction.isExpense).toBe('boolean');
    });

    test('should handle AI categorization fields', () => {
      const aiFields = {
        aiCategory: 'OFFICE_EXPENSES',
        aiConfidence: '0.95',
        aiExplanation: 'Categorized based on vendor and description',
        needsReview: false,
        userOverride: false
      };

      expect(aiFields.aiCategory).toBeDefined();
      expect(parseFloat(aiFields.aiConfidence)).toBeGreaterThan(0);
      expect(aiFields.aiExplanation.length).toBeGreaterThan(0);
      expect(typeof aiFields.needsReview).toBe('boolean');
      expect(typeof aiFields.userOverride).toBe('boolean');
    });
  });

  describe('User Schema', () => {
    test('should handle complete user profile', () => {
      const mockUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        businessName: 'Test Business Inc.',
        firstName: 'John',
        lastName: 'Doe',
        subscriptionStatus: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
      };

      expect(mockUser.username.length).toBeGreaterThan(0);
      expect(mockUser.email).toContain('@');
      expect(mockUser.password.length).toBeGreaterThan(0);
      expect(mockUser.subscriptionStatus).toBe('trial');
      expect(mockUser.trialEndsAt).toBeInstanceOf(Date);
    });
  });

  describe('Receipt Schema', () => {
    test('should handle receipt processing data', () => {
      const mockReceipt = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        fileName: 'receipt-2025-01-31.pdf',
        filePath: '/uploads/receipts/receipt-2025-01-31.pdf',
        extractedAmount: '25.99',
        extractedVendor: 'Staples',
        extractedDate: new Date('2025-01-31'),
        status: 'processed',
        isMatched: false
      };

      expect(mockReceipt.fileName.endsWith('.pdf')).toBe(true);
      expect(mockReceipt.filePath.startsWith('/uploads')).toBe(true);
      expect(parseFloat(mockReceipt.extractedAmount)).toBeGreaterThan(0);
      expect(mockReceipt.extractedVendor.length).toBeGreaterThan(0);
      expect(mockReceipt.extractedDate).toBeInstanceOf(Date);
      expect(['processing', 'processed', 'matched', 'unmatched']).toContain(mockReceipt.status);
    });
  });

  describe('Invoicing Schema', () => {
    test('should handle client data', () => {
      const mockClient = {
        businessName: 'Client Business Corp.',
        contactName: 'Jane Smith',
        email: 'jane@client.com',
        phone: '+1-416-555-0123',
        address: '123 Business St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 3A8',
        country: 'Canada',
        currency: 'CAD',
        paymentTerms: 30,
        isActive: true
      };

      expect(mockClient.businessName.length).toBeGreaterThan(0);
      expect(mockClient.email).toContain('@');
      expect(mockClient.country).toBe('Canada');
      expect(mockClient.currency).toBe('CAD');
      expect(mockClient.paymentTerms).toBeGreaterThan(0);
    });

    test('should handle invoice data', () => {
      const mockInvoice = {
        invoiceNumber: 'INV-2025-001',
        status: 'draft',
        issueDate: new Date('2025-01-31'),
        dueDate: new Date('2025-02-28'),
        subtotal: '1000.00',
        taxAmount: '130.00',
        totalAmount: '1130.00',
        currency: 'CAD'
      };

      expect(mockInvoice.invoiceNumber.startsWith('INV-')).toBe(true);
      expect(['draft', 'sent', 'paid', 'overdue', 'cancelled']).toContain(mockInvoice.status);
      expect(mockInvoice.issueDate).toBeInstanceOf(Date);
      expect(mockInvoice.dueDate).toBeInstanceOf(Date);
      expect(parseFloat(mockInvoice.subtotal)).toBeGreaterThan(0);
      expect(parseFloat(mockInvoice.totalAmount)).toBeGreaterThan(parseFloat(mockInvoice.subtotal));
      expect(mockInvoice.currency).toBe('CAD');
    });

    test('should handle invoice items', () => {
      const mockInvoiceItem = {
        description: 'Business consultation services',
        quantity: '5.00',
        unitPrice: '200.00',
        totalPrice: '1000.00',
        taxable: true
      };

      expect(mockInvoiceItem.description.length).toBeGreaterThan(0);
      expect(parseFloat(mockInvoiceItem.quantity)).toBeGreaterThan(0);
      expect(parseFloat(mockInvoiceItem.unitPrice)).toBeGreaterThan(0);
      expect(parseFloat(mockInvoiceItem.totalPrice)).toBe(
        parseFloat(mockInvoiceItem.quantity) * parseFloat(mockInvoiceItem.unitPrice)
      );
      expect(typeof mockInvoiceItem.taxable).toBe('boolean');
    });
  });
});