import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    ShieldCheck,
    Sparkles,
    User,
    UserPlus,
} from 'lucide-react';
import apiClient from '../config/apiClient';
import { useRegister } from '../hooks/useAuthMutations';
import { registerSchema } from '../lib/validators';

const INPUT_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-800/70 dark:focus:ring-indigo-400/20';

const INPUT_ERROR_CLASS_NAME =
    'w-full rounded-2xl border border-red-300 bg-red-50/60 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/15 dark:border-red-500/50 dark:bg-red-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-red-950/40 dark:focus:ring-red-400/20';

const Register = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const redirectTimerRef = useRef(null);
    const navigate = useNavigate();
    const registerMutation = useRegister();

    const { data: adminData } = useQuery({
        queryKey: ['admin-exists'],
        queryFn: () => apiClient.get('/api/auth/admin-exists').then((r) => r.data),
        staleTime: 30 * 1000,
    });

    const adminExists = adminData?.exists ?? true;

    const roleOptions = useMemo(() => {
        const options = [
            {
                value: 'Teacher',
                title: 'Teacher',
                description: 'Incident reporting and everyday follow-up.',
            },
            {
                value: 'Admin',
                title: 'Administrator',
                description: 'School-wide tools, uploads, and staff management.',
            },
        ];
        return adminExists ? options.filter((r) => r.value !== 'Admin') : options;
    }, [adminExists]);

    const defaultRole = adminExists ? 'Teacher' : 'Admin';

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(registerSchema),
        defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: defaultRole },
    });

    const selectedRole = watch('role');

    useEffect(() => {
        if (adminExists && selectedRole === 'Admin') setValue('role', 'Teacher');
        if (!adminExists && selectedRole === 'Teacher') setValue('role', 'Admin');
    }, [adminExists, selectedRole, setValue]);

    useEffect(() => () => {
        if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
        }
    }, []);

    const onSubmit = async (data) => {
        const { confirmPassword: _, ...payload } = data;
        try {
            await registerMutation.mutateAsync(payload);
            setSuccess(true);
            redirectTimerRef.current = setTimeout(() => navigate('/login'), 2000);
        } catch {
            // error shown via registerMutation.error below
        }
    };

    const serverError = registerMutation.error?.response?.data?.message || registerMutation.error?.message;

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 dark:bg-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_32%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(15,23,42,0.92),rgba(15,23,42,0.76),rgba(2,6,23,0.96))]" />

            <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:px-8">
                <section className="hidden rounded-[32px] border border-white/10 bg-white/6 p-10 text-white shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/6 lg:block">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">
                        <ShieldCheck size={14} />
                        Secure Portal
                    </div>
                    <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
                        Incident Tracking System
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
                        A secure workspace for schools to record incidents, follow up with staff, and keep families and leadership informed.
                    </p>
                    <div className="mt-10 space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Admin Feature</p>
                            <p className="mt-2 text-lg font-medium text-slate-200">School-wide settings, staff accounts, and official letter files.</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Teacher Feature</p>
                            <p className="mt-2 text-lg font-medium text-slate-200">Fast incident reporting and day-to-day follow-up.</p>
                        </div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-2xl">
                    <div className="rounded-[32px] border border-white/15 bg-white/90 shadow-xl backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
                        <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-8 py-8 text-white dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-lg">
                                    <UserPlus size={26} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Create Account</p>
                                    <h2 className="mt-1 text-3xl font-semibold tracking-tight">Register staff</h2>
                                </div>
                            </div>
                            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                                Create the initial administrator account, or sign in as an administrator to add staff later.
                            </p>
                        </div>

                        <div className="p-8">
                            {!success ? (
                                <>
                                    <div className="mb-8 rounded-3xl border border-indigo-100 bg-indigo-50 px-4 py-4 text-sm text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-100 lg:hidden">
                                        <div className="flex items-start gap-3">
                                            <Sparkles className="mt-0.5 text-indigo-600" size={18} />
                                            <p className="leading-6">
                                                First setup must create an administrator. After setup, staff creation requires an administrator session.
                                            </p>
                                        </div>
                                    </div>

                                    {serverError && (
                                        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-500/30 dark:bg-red-950/30" role="alert" aria-live="polite">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                                                    <AlertCircle size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-red-800 dark:text-red-100">Registration issue</p>
                                                    <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-200">{serverError}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                                        <div className="grid gap-5 md:grid-cols-2">
                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Full Name
                                                </label>
                                                <div className="relative">
                                                    <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        autoComplete="name"
                                                        placeholder="Enter full name"
                                                        className={errors.name ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        {...register('name')}
                                                    />
                                                </div>
                                                {errors.name && (
                                                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.name.message}</p>
                                                )}
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Email Address
                                                </label>
                                                <div className="relative">
                                                    <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="email"
                                                        autoComplete="email"
                                                        placeholder="name@school.edu"
                                                        className={errors.email ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        {...register('email')}
                                                    />
                                                </div>
                                                {errors.email && (
                                                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Password
                                                </label>
                                                <div className="relative">
                                                    <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        autoComplete="new-password"
                                                        placeholder="Create password"
                                                        className={errors.password ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        {...register('password')}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword((v) => !v)}
                                                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                {errors.password && (
                                                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Confirm Password
                                                </label>
                                                <div className="relative">
                                                    <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        autoComplete="new-password"
                                                        placeholder="Confirm password"
                                                        className={errors.confirmPassword ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        {...register('confirmPassword')}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword((v) => !v)}
                                                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                                    >
                                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                {errors.confirmPassword && (
                                                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword.message}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                Account Role
                                            </label>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {roleOptions.map((role) => {
                                                    const isSelected = selectedRole === role.value;
                                                    return (
                                                        <button
                                                            key={role.value}
                                                            type="button"
                                                            onClick={() => setValue('role', role.value, { shouldValidate: true })}
                                                            className={`rounded-3xl border px-4 py-4 text-left transition-all duration-200 ${
                                                                isSelected
                                                                    ? 'border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-100/40 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:shadow-none'
                                                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:hover:border-slate-600 dark:hover:bg-slate-900'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{role.title}</p>
                                                                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{role.description}</p>
                                                                </div>
                                                                <div
                                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                                        isSelected
                                                                            ? 'border-indigo-500 bg-indigo-500 text-white'
                                                                            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                                                                    }`}
                                                                >
                                                                    {isSelected && <CheckCircle2 size={14} />}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {errors.role && (
                                                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.role.message}</p>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting || registerMutation.isPending}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {registerMutation.isPending ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Creating Account...
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus size={18} />
                                                    Create Account
                                                </>
                                            )}
                                        </button>
                                    </form>

                                    <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/login')}
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                                        >
                                            <ArrowLeft size={16} />
                                            Back to Login
                                        </button>
                                        <Link
                                            to="/login"
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition-all duration-300 hover:text-indigo-700 dark:text-blue-300 dark:hover:text-blue-200"
                                        >
                                            Already have an account
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div className="py-12 text-center">
                                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    <h3 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">Account created</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        The staff account was created successfully. Redirecting to the login screen now.
                                    </p>
                                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
                                        <Loader2 className="animate-spin" size={16} />
                                        Redirecting...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Register;
