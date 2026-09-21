import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('repository boundaries', () => {
  it('defines explicit aliases for modules, infrastructure, and shared code', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
    const paths = tsconfig.compilerOptions.paths;

    expect(paths['@/modules/*']).toEqual(['./src/modules/*']);
    expect(paths['@/infrastructure/*']).toEqual(['./src/infrastructure/*']);
    expect(paths['@/shared/*']).toEqual(['./src/shared/*']);
  });
});
