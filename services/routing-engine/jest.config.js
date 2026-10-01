/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        target: 'ES2022',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^(\\./.*)\\.js$': '$1',
    '^(\\.\\./.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  verbose: true,
};
