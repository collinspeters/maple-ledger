// Simple test without complex imports to verify Jest is working
describe('Basic T2125 Categories Test', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  test('should validate environment setup', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should have basic math working', () => {
    expect(2 + 2).toBe(4);
    expect([1, 2, 3]).toHaveLength(3);
  });
});