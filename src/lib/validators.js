/**
 * validators.js
 * Frontend Zod schemas — mirror backend validators exactly.
 * Used with React Hook Form via zodResolver.
 *
 * Keep in sync with:
 *   backend/validators/authValidators.js
 *   backend/validators/incidentValidators.js
 *   backend/validators/studentValidators.js
 */

import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_TEXT = 'Use at least 8 characters with uppercase, lowercase, number, and symbol.';

export const getPasswordStrengthScore = (password = '') => [
    password.length >= PASSWORD_MIN_LENGTH,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
].filter(Boolean).length;

export const getPasswordStrengthLevel = (password = '') => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
};

export const getPasswordStrength = (password = '') => {
    const score = getPasswordStrengthScore(password);

    if (!password) return { label: 'Not started', score: 0, bar: 'w-0 bg-slate-200', text: 'text-slate-500' };
    if (score <= 2) return { label: 'Weak', score, bar: 'w-1/3 bg-red-500', text: 'text-red-600' };
    if (score <= 4) return { label: 'Good', score, bar: 'w-2/3 bg-amber-500', text: 'text-amber-600' };
    return { label: 'Strong', score, bar: 'w-full bg-emerald-500', text: 'text-emerald-600' };
};

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .max(254, 'Email is too long'),
    password: z
        .string()
        .min(1, 'Password is required')
        .max(200, 'Password is too long'),
    loginType: z.enum(['staff', 'student']).default('staff'),
});

export const registerSchema = z
    .object({
        schoolName: z
            .string()
            .trim()
            .min(2, 'School name is required')
            .max(160, 'School name is too long'),
        superAdminName: z
            .string()
            .trim()
            .min(1, 'Super Admin name is required')
            .max(120, 'Name is too long'),
        email: z
            .string()
            .trim()
            .email('Enter a valid email address')
            .max(254, 'Email is too long'),
        password: z
            .string()
            .min(PASSWORD_MIN_LENGTH, 'Password must be at least 8 characters')
            .max(200, 'Password is too long')
            .regex(/[a-z]/, 'Password must include a lowercase letter')
            .regex(/[A-Z]/, 'Password must include an uppercase letter')
            .regex(/\d/, 'Password must include a number')
            .regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });
