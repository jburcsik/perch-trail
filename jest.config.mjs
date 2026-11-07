import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  // Jest runs the unit tests under src/ only; the Playwright specs in tests/
  // import @playwright/test and run through `npm run test:e2e`.
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/',
    '<rootDir>/.next/',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig)
