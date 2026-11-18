import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('labels language configuration', () => {
  it('uses Spanish when VITE_LANGUAGE is not set', async () => {
    vi.stubEnv('VITE_LANGUAGE', undefined);

    const { LANGUAGE, LABELS } = await import('./labels.js');

    expect(LANGUAGE).toBe('es');
    expect(LABELS.common.save).toBe('Guardar');
  });

  it('uses the language selected by VITE_LANGUAGE', async () => {
    vi.stubEnv('VITE_LANGUAGE', 'en');

    const { LANGUAGE, LABELS } = await import('./labels.js');

    expect(LANGUAGE).toBe('en');
    expect(LABELS.common.save).toBe('Save');
  });

  it('rejects unsupported languages', async () => {
    vi.stubEnv('VITE_LANGUAGE', 'fr');

    await expect(import('./labels.js')).rejects.toThrow(
      'Unsupported VITE_LANGUAGE "fr". Supported languages: es, en.',
    );
  });
});
