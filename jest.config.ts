import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/*.spec.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testTimeout: 150000
};

export default config;
