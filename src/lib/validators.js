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
            .min(12, 'Password must be at least 12 characters')
            .max(200, 'Password is too long')
            .regex(/[a-z]/, 'Password must include a lowercase letter')
            .regex(/[A-Z]/, 'Password must include an uppercase letter')
            .regex(/\d/, 'Password must include a number')
            .regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
        role: z.enum(['Super Admin', 'Admin', 'Teacher'], {
            message: 'Select a valid role',
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });
