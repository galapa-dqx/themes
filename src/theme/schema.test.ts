import { describe, expect, it } from 'vitest';
import { validateProjectMetadata, validateProjectTokens } from './validation';

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
});

