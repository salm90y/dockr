/**
 * Safe localStorage wrapper that degrades gracefully to in-memory storage
 * in environments where localStorage is blocked or disabled (e.g. sandboxed iframes).
 */

const inMemoryStorage: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`Storage access denied for key "${key}":`, e);
    }
    return inMemoryStorage[key] !== undefined ? inMemoryStorage[key] : null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`Storage write denied for key "${key}":`, e);
    }
    inMemoryStorage[key] = value;
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`Storage remove denied for key "${key}":`, e);
    }
    delete inMemoryStorage[key];
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn("Storage clear denied:", e);
    }
    for (const key in inMemoryStorage) {
      delete inMemoryStorage[key];
    }
  }
};
