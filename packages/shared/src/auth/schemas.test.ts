import { describe, expect, it } from "vitest";

import {
  MIN_SIGNUP_AGE_YEARS,
  loginSchema,
  resetPasswordRequestSchema,
  signupSchema,
} from "./schemas";

function isoYearsAgo(years: number): string {
  const d = new Date();
  const y = d.getFullYear() - years;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("loginSchema", () => {
  it("acepta email + password válidos", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "12345678" });
    expect(r.success).toBe(true);
  });

  it("normaliza email a lowercase y trim", () => {
    const r = loginSchema.parse({ email: "  A@B.COM  ", password: "12345678" });
    expect(r.email).toBe("a@b.com");
  });

  it("rechaza email inválido", () => {
    const r = loginSchema.safeParse({ email: "no-arroba", password: "12345678" });
    expect(r.success).toBe(false);
  });

  it("rechaza password menor a 8", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "1234567" });
    expect(r.success).toBe(false);
  });

  it("rechaza password mayor a 72", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "a".repeat(73) });
    expect(r.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const validBase = {
    full_name: "Carlos Martinez",
    email: "a@b.com",
    password: "12345678",
    date_of_birth: isoYearsAgo(20),
    terms_accepted: true as const,
  };

  it("acepta payload completo válido", () => {
    const r = signupSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it("normaliza full_name trim y email lowercase", () => {
    const r = signupSchema.parse({
      ...validBase,
      full_name: "  Carlos  ",
      email: "A@B.COM",
    });
    expect(r.full_name).toBe("Carlos");
    expect(r.email).toBe("a@b.com");
  });

  it("rechaza full_name < 2 chars", () => {
    const r = signupSchema.safeParse({ ...validBase, full_name: "A" });
    expect(r.success).toBe(false);
  });

  it("rechaza full_name > 80 chars", () => {
    const r = signupSchema.safeParse({ ...validBase, full_name: "a".repeat(81) });
    expect(r.success).toBe(false);
  });

  it("rechaza date_of_birth con formato incorrecto", () => {
    const r = signupSchema.safeParse({ ...validBase, date_of_birth: "01/01/2000" });
    expect(r.success).toBe(false);
  });

  it(`rechaza date_of_birth menor a ${MIN_SIGNUP_AGE_YEARS} años`, () => {
    const r = signupSchema.safeParse({ ...validBase, date_of_birth: isoYearsAgo(12) });
    expect(r.success).toBe(false);
  });

  it(`acepta date_of_birth de exactamente ${MIN_SIGNUP_AGE_YEARS} años (edge)`, () => {
    const r = signupSchema.safeParse({ ...validBase, date_of_birth: isoYearsAgo(MIN_SIGNUP_AGE_YEARS) });
    expect(r.success).toBe(true);
  });

  it("rechaza terms_accepted = false", () => {
    const r = signupSchema.safeParse({ ...validBase, terms_accepted: false as unknown as true });
    expect(r.success).toBe(false);
  });

  it("rechaza terms_accepted ausente", () => {
    const { terms_accepted, ...rest } = validBase;
    void terms_accepted;
    const r = signupSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

describe("resetPasswordRequestSchema", () => {
  it("acepta email válido", () => {
    const r = resetPasswordRequestSchema.safeParse({ email: "a@b.com" });
    expect(r.success).toBe(true);
  });

  it("normaliza email", () => {
    const r = resetPasswordRequestSchema.parse({ email: "  A@B.COM  " });
    expect(r.email).toBe("a@b.com");
  });

  it("rechaza email inválido", () => {
    const r = resetPasswordRequestSchema.safeParse({ email: "no-arroba" });
    expect(r.success).toBe(false);
  });
});
