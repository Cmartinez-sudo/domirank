import { z } from "zod";

export const MIN_SIGNUP_AGE_YEARS = 13;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z
    .string()
    .min(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres`)
    .max(PASSWORD_MAX, `Máximo ${PASSWORD_MAX} caracteres`),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Date of birth as ISO YYYY-MM-DD string. Enforces ≥ MIN_SIGNUP_AGE_YEARS at
// submission time. Comparison is done on date components (Y/M/D) to avoid
// timezone drift from toISOString() UTC conversion.
function isAtLeastYearsOld(iso: string, years: number, now = new Date()): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const dobY = Number(m[1]);
  const dobM = Number(m[2]);
  const dobD = Number(m[3]);
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const nowD = now.getDate();
  const yearDiff = nowY - dobY;
  if (yearDiff > years) return true;
  if (yearDiff < years) return false;
  if (nowM > dobM) return true;
  if (nowM < dobM) return false;
  return nowD >= dobD;
}

export const signupSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(FULL_NAME_MIN, `Mínimo ${FULL_NAME_MIN} caracteres`)
    .max(FULL_NAME_MAX, `Máximo ${FULL_NAME_MAX} caracteres`),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z
    .string()
    .min(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres`)
    .max(PASSWORD_MAX, `Máximo ${PASSWORD_MAX} caracteres`),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato requerido: YYYY-MM-DD")
    .refine(
      (v) => isAtLeastYearsOld(v, MIN_SIGNUP_AGE_YEARS),
      `Debes tener al menos ${MIN_SIGNUP_AGE_YEARS} años`,
    ),
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar los términos" }),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const resetPasswordRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
});

export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
