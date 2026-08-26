import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearMemory } from '../lib/storage.js';

afterEach(() => {
  cleanup();
  clearMemory();
  try {
    globalThis.localStorage.clear();
  } catch {
    /* not available in every environment */
  }
});
