import { describe, test, expect } from 'vitest';
import { slugify, appendRandomSuffix } from './slug';

describe('slugify', () => {
  test('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Copa Invedin 2026')).toBe('copa-invedin-2026');
  });

  test('strips diacritics (España → espana)', () => {
    expect(slugify('Torneo Día del Niño')).toBe('torneo-dia-del-nino');
  });

  test('collapses multiple non-alphanumeric chars into single hyphen', () => {
    expect(slugify('a — b  /  c')).toBe('a-b-c');
  });

  test('trims leading and trailing hyphens', () => {
    expect(slugify('—hello—')).toBe('hello');
  });

  test('truncates to 60 chars', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBe(60);
  });

  test('handles empty input', () => {
    expect(slugify('')).toBe('');
  });

  test('strips HTML brackets and special chars (defense-in-depth)', () => {
    expect(slugify('<script>')).toBe('script');
  });
});

describe('appendRandomSuffix', () => {
  test('appends 6-char base36 suffix preceded by hyphen', () => {
    const result = appendRandomSuffix('copa-invedin');
    expect(result).toMatch(/^copa-invedin-[a-z0-9]{6}$/);
  });

  test('truncates base so total <= 60 chars', () => {
    const base = 'a'.repeat(60);
    const result = appendRandomSuffix(base);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).toMatch(/^a{53}-[a-z0-9]{6}$/);
  });

  test('two calls produce different suffixes (probabilistically)', () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(appendRandomSuffix('test'));
    }
    // Collision in 20 calls of 36^6 = ~2B space is essentially zero
    expect(results.size).toBeGreaterThan(15);
  });
});
