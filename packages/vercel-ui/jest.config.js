/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
