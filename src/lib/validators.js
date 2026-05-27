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
        name: z
            .string()
            .trim()
            .min(1, 'Full name is required')
            .max(120, 'Name is too long'),
        email: z
            .string()
            .trim()
            .email('Enter a valid email address')
            .max(254, 'Email is too long'),
        password: z
            .string()
            .min(6, 'Password must be at least 6 characters')
            .max(200, 'Password is too long'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
        role: z.enum(['Super Admin', 'Admin', 'Teacher'], {
            message: 'Select a valid role',
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Enter a valid email address')
        .max(254, 'Email is too long'),
});

export const verifyOtpSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Enter a valid email address')
        .max(254),
    otp: z
        .string()
        .trim()
        .regex(/^\d{6}$/, 'Reset code must be exactly 6 digits'),
});

export const resetPasswordSchema = z
    .object({
        newPassword: z
            .string()
            .min(6, 'Password must be at least 6 characters')
            .max(200, 'Password is too long'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });
