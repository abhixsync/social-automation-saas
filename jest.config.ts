import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    // Next.js path alias
    '^@/(.*)$': '<rootDir>/src/$1',

    // Block the generated prisma client (loads WASM .mjs that Jest cannot parse)
    // Forward slashes work on all platforms inside Jest's internal path handling
    '^.+/src/generated/prisma.*$': '<rootDir>/__mocks__/prisma-client.ts',

    // Block npm packages
    '^@prisma/client$': '<rootDir>/__mocks__/prisma-client.ts',
    '^@prisma/adapter-pg$': '<rootDir>/__mocks__/prisma-adapter-pg.ts',

    // Strip ESM .js extensions so Jest resolves .ts sources
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  modulePathIgnorePatterns: ['<rootDir>/worker/dist'],
  clearMocks: false,
}

export default createJestConfig(config)
