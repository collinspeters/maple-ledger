export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1'
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],
  collectCoverageFrom: [
    'shared/**/*.ts',
    'server/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: 'tsconfig.test.json'
    }]
  }
};