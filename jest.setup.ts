import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Cell } from '@ton/core';

jest.mock('@ton/blueprint', () => {
    const actual = jest.requireActual<typeof import('@ton/blueprint')>('@ton/blueprint');

    return {
        ...actual,
        compile: async (name: string, ...args: unknown[]) => {
            if (name === 'Config' && process.env.CONFIG_USE_FUNC !== '1') {
                const tolkBuildPath = process.env.CONFIG_TOLK_BUILD_PATH
                    ? path.resolve(process.env.CONFIG_TOLK_BUILD_PATH)
                    : path.resolve(__dirname, '..', 'acton-contracts', 'build', 'config.json');

                const { code_boc64 } = JSON.parse(readFileSync(tolkBuildPath, 'utf8')) as { code_boc64: string };

                return Cell.fromBoc(Buffer.from(code_boc64, 'base64'))[0];
            }

            return (actual.compile as (...actualArgs: unknown[]) => Promise<Cell>)(name, ...args);
        },
    };
});
