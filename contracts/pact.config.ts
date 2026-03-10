import type { Config } from 'jest';

/**
 * Jest configuration for Pact consumer contract tests.
 *
 * Run:  npm run test:contracts
 * This config is passed directly to Jest via --config contracts/pact.config.ts
 *
 * Uses ts-jest so TypeScript spec files are compiled on the fly without a
 * separate build step.  Pact output goes to ./pacts/ by default (configured
 * per-spec via PactHelper.pactConfig()).
 */
const config: Config = {
  // Only pick up Pact spec files inside contracts/
  testMatch: ['<rootDir>/**/*.pact.spec.ts'],

  // TypeScript support via ts-jest
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Longer timeout — Pact mock server startup + HTTP round-trips can be slow
  testTimeout: 30_000,

  // ts-jest compiler options (inherit from repo tsconfig)
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
        diagnostics: false,
      },
    ],
  },

  // Friendly output
  verbose: true,

  // Module path aliases matching tsconfig paths
  moduleNameMapper: {
    '^@helpers/(.*)$': '<rootDir>/../helpers/$1',
    '^@pages/(.*)$': '<rootDir>/../pages/$1',
    '^@fixtures/(.*)$': '<rootDir>/../fixtures/$1',
  },

  // Collect coverage only when explicitly requested (npm run test:contracts -- --coverage)
  collectCoverage: false,
};

export default config;
