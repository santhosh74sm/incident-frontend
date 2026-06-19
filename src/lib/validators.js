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
export const PASSWORD_POLICY_TEXT = 'Use at least 8 characters.';

export const getPasswordStrengthScore = (password = '') => {
    return password.length >= PASSWORD_MIN_LENGTH ? 5 : 1;
};

export const getPasswordStrengthLevel = (password = '') => {
    if (!password) return 0;
    return password.length >= PASSWORD_MIN_LENGTH ? 4 : 1;
};

export const getPasswordStrength = (password = '') => {
    if (!password) return { label: 'Not started', score: 0, bar: 'w-0 bg-slate-200', text: 'text-slate-500' };
    if (password.length >= PASSWORD_MIN_LENGTH) {
        return { label: 'Strong', score: 5, bar: 'w-full bg-emerald-500', text: 'text-emerald-600' };
    }
    return { label: 'Weak', score: 1, bar: 'w-1/3 bg-red-500', text: 'text-red-600' };
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
        academicYear: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}$/, 'Use YYYY-YY format, for example 2026-27'),
        password: z
            .string()
            .min(PASSWORD_MIN_LENGTH, 'Password must be at least 8 characters')
            .max(200, 'Password is too long'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });
