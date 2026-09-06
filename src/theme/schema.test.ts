import { describe, expect, it } from 'vitest';
import {
  validateCompiledControl,
  validateProjectMetadata,
  validateProjectTokens,
} from './validation';

describe('theme schemas', () => {
  it('accepts a minimal project metadata document', () => {
    expect(
      validateProjectMetadata({
        formatVersion: 1,
        id: 'app.galapa.themes.0123456789abcdefghij',
        name: 'Test theme',
        author: { name: 'Test Author' },
        updates: null,
        chromeStyle: 'dark',
      }),
    ).toEqual([]);
  });

  it('rejects unknown token categories and invalid names', () => {
    expect(validateProjectTokens({ colors: { Bad_Name: '#123456' } })).not.toEqual(
      [],
    );
    expect(validateProjectTokens({ numbers: { opacity: 0.5 } })).not.toEqual([]);
  });

  it('allows variant artwork that does not use currentColor', () => {
    expect(
      validateCompiledControl('tab-bar', {
        parts: {
          hint: {
            assets: {
              'left-bumper': './assets/0123456789ab.svg',
              'right-bumper': './assets/0123456789ab.svg',
              'left-trigger': './assets/0123456789ab.svg',
              'right-trigger': './assets/0123456789ab.svg',
            },
            opacity: 1,
          },
        },
      }),
    ).toEqual([]);
  });
});
