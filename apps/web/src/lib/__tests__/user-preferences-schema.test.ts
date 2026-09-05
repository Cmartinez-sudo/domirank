import { describe, it, expect } from 'vitest';
import { userPreferencesInputSchema } from '../user-preferences-schema';

describe('userPreferencesInputSchema', () => {
  it('acepta objeto vacío (todas las propiedades son opcionales)', () => {
    expect(userPreferencesInputSchema.safeParse({}).success).toBe(true);
  });

  it('acepta default_match_modality válida', () => {
    for (const m of ['ven', 'dom', 'cub', 'pri'] as const) {
      expect(userPreferencesInputSchema.safeParse({ default_match_modality: m }).success).toBe(true);
    }
  });

  it('rechaza default_match_modality con valor fuera del enum', () => {
    expect(userPreferencesInputSchema.safeParse({ default_match_modality: 'xxx' }).success).toBe(false);
  });

  it('acepta default_match_modality null (nullable)', () => {
    expect(userPreferencesInputSchema.safeParse({ default_match_modality: null }).success).toBe(true);
  });

  it('rechaza skip_modality_prompt si no es boolean', () => {
    expect(userPreferencesInputSchema.safeParse({ skip_modality_prompt: 'yes' }).success).toBe(false);
    expect(userPreferencesInputSchema.safeParse({ skip_modality_prompt: 1 }).success).toBe(false);
  });

  it('acepta skip_modality_prompt boolean', () => {
    expect(userPreferencesInputSchema.safeParse({ skip_modality_prompt: true }).success).toBe(true);
    expect(userPreferencesInputSchema.safeParse({ skip_modality_prompt: false }).success).toBe(true);
  });

  it('rechaza theme fuera del enum', () => {
    expect(userPreferencesInputSchema.safeParse({ theme: 'pink' }).success).toBe(false);
    expect(userPreferencesInputSchema.safeParse({ theme: 'auto' }).success).toBe(false);
  });

  it('acepta los tres valores válidos de theme', () => {
    for (const t of ['dark', 'light', 'system'] as const) {
      expect(userPreferencesInputSchema.safeParse({ theme: t }).success).toBe(true);
    }
  });

  it('acepta notification_settings como record arbitrario', () => {
    expect(
      userPreferencesInputSchema.safeParse({ notification_settings: { push: true, email: false } }).success,
    ).toBe(true);
    expect(userPreferencesInputSchema.safeParse({ notification_settings: {} }).success).toBe(true);
  });

  it('valida input completo válido', () => {
    const full = {
      default_match_modality: 'ven' as const,
      skip_modality_prompt: true,
      notification_settings: { push: true },
      theme: 'dark' as const,
    };
    const result = userPreferencesInputSchema.safeParse(full);
    expect(result.success).toBe(true);
  });
});
