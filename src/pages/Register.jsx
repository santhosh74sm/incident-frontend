import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useAuth } from '../context/AuthContext';
import { useRegister } from '../hooks/useAuthMutations';
import { getPasswordStrength, PASSWORD_POLICY_TEXT, registerSchema } from '../lib/validators';

const INPUT_CLASS_NAME =
    'w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-800/70 dark:focus:ring-indigo-400/20';

const INPUT_ERROR_CLASS_NAME =
    'w-full rounded-xl border border-red-300 bg-red-50/60 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/15 dark:border-red-500/50 dark:bg-red-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-red-950/40 dark:focus:ring-red-400/20';

const getFriendlyRegisterError = (message) => {
    const value = String(message || '').toLowerCase();
    if (!message) return '';
    if (value.includes('duplicate') || value.includes('already')) return 'This email or school is already registered.';
    if (value.includes('validation')) return 'Please check the highlighted fields.';
    if (value.includes('network')) return 'Unable to connect. Please check your internet and try again.';
    return message;
};

const Register = () => {
    const nameId = useId();
    const schoolNameId = useId();
    const emailId = useId();
    const passwordId = useId();
    const confirmPasswordId = useId();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const [protectedRegisterError, setProtectedRegisterError] = useState('');
    const redirectTimerRef = useRef(null);
    const navigate = useNavigate();
    const { login } = useAuth();
    const registerMutation = useRegister();

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(registerSchema),
        defaultValues: { schoolName: '', superAdminName: '', email: '', password: '', confirmPassword: '' },
    });

    const passwordValue = watch('password');
    const passwordStrength = getPasswordStrength(passwordValue);

    useEffect(() => () => {
        if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
        }
    }, []);

    const onSubmit = async (data) => {
        const { confirmPassword: _, ...payload } = data;
        setProtectedRegisterError('');
        try {
            const createdUser = await registerMutation.mutateAsync(payload);
            if (createdUser) login(createdUser);
            setSuccess(true);
            redirectTimerRef.current = setTimeout(() => navigate('/dashboard'), 1200);
        } catch (requestError) {
            setProtectedRegisterError(getFriendlyRegisterError(requestError.response?.data?.message || 'Unable to create account.'));
        }
    };

    const rawServerError = protectedRegisterError || registerMutation.error?.response?.data?.message || registerMutation.error?.message;
    const serverError = getFriendlyRegisterError(rawServerError);
    const submitting = isSubmitting || registerMutation.isPending;

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-slate-950 dark:bg-slate-950">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f172a_0%,#111827_48%,#1e293b_100%)]" />

            <div className="relative mx-auto grid min-h-screen w-full max-w-7xl content-center items-stretch gap-5 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)] lg:gap-8 lg:px-8">
                <section className="order-2 hidden min-w-0 flex-col justify-center rounded-2xl border border-white/10 bg-white/8 p-5 text-white shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8 sm:p-8 lg:order-1 lg:flex lg:p-10">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
                        <ShieldCheck size={14} />
                        Secure Portal
                    </div>
                    <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                        Incident Tracking System
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                        Create a private school workspace.
                    </p>
                    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">School Setup</p>
                            <p className="mt-2 min-w-0 text-sm font-medium leading-relaxed text-slate-200">Start with a Super Admin account for initial setup and account recovery.</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Simple English</p>
                            <p className="mt-2 min-w-0 text-sm font-medium leading-relaxed text-slate-200">Use straightforward forms for incidents, reports, and follow-up actions.</p>
                        </div>
                    </div>
                </section>

                <section className="order-1 flex w-full min-w-0 items-center lg:order-2 lg:justify-end">
                    <div className="w-full overflow-hidden rounded-2xl border border-white/15 bg-white shadow-xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900 lg:max-w-2xl">
                        <div className="border-b border-slate-200/80 bg-slate-900 px-6 py-7 text-white dark:border-slate-800 sm:px-8 sm:py-8">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-lg sm:h-14 sm:w-14">
                                    <UserPlus size={26} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Create Workspace</p>
                                    <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Add your school</h2>
                                </div>
                            </div>
                            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                                Create a school workspace.
                            </p>
                        </div>

                        <div className="p-6 sm:p-8">
                            {!success ? (
                                <>
                                    <div className="mb-7 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 text-sm text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-100 lg:hidden">
                                        <div className="flex items-start gap-3">
                                            <Sparkles className="mt-0.5 text-indigo-600" size={18} />
                                            <p className="leading-6">
                                                Each school gets its own isolated workspace and Super Admin account.
                                            </p>
                                        </div>
                                    </div>

                                    {serverError && (
                                        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-500/30 dark:bg-red-950/30" role="alert" aria-live="polite">
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

                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate aria-busy={submitting}>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">School Information</h3>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter the school name and official email.</p>
                                            <div className="mt-5 grid gap-5">
                                            <div className="md:col-span-2">
                                                <label htmlFor={schoolNameId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    School Name
                                                </label>
                                                <div className="relative">
                                                    <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        id={schoolNameId}
                                                        autoComplete="organization"
                                                        placeholder="ABC Higher Secondary School"
                                                        aria-invalid={Boolean(errors.schoolName)}
                                                        aria-describedby={errors.schoolName ? `${schoolNameId}-error` : undefined}
                                                        className={errors.schoolName ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        disabled={submitting}
                                                        {...register('schoolName')}
                                                    />
                                                </div>
                                                {errors.schoolName && (
                                                    <p id={`${schoolNameId}-error`} className="mt-1.5 text-xs font-medium text-red-600">{errors.schoolName.message}</p>
                                                )}
                                            </div>

                                            <div className="md:col-span-2">
                                                <label htmlFor={emailId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Official Email
                                                </label>
                                                <div className="relative">
                                                    <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="email"
                                                        id={emailId}
                                                        autoComplete="email"
                                                        placeholder="name@school.edu"
                                                        aria-invalid={Boolean(errors.email)}
                                                        aria-describedby={errors.email ? `${emailId}-error` : undefined}
                                                        className={errors.email ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        disabled={submitting}
                                                        {...register('email')}
                                                    />
                                                </div>
                                                {errors.email && (
                                                    <p id={`${emailId}-error`} className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p>
                                                )}
                                            </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Account Information</h3>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create the first Super Admin account.</p>
                                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                            <div className="md:col-span-2">
                                                <label htmlFor={nameId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Super Admin Name
                                                </label>
                                                <div className="relative">
                                                    <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        id={nameId}
                                                        autoComplete="name"
                                                        placeholder="Enter Super Admin name"
                                                        aria-invalid={Boolean(errors.superAdminName)}
                                                        aria-describedby={errors.superAdminName ? `${nameId}-error` : undefined}
                                                        className={errors.superAdminName ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        disabled={submitting}
                                                        {...register('superAdminName')}
                                                    />
                                                </div>
                                                {errors.superAdminName && (
                                                    <p id={`${nameId}-error`} className="mt-1.5 text-xs font-medium text-red-600">{errors.superAdminName.message}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label htmlFor={passwordId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Password
                                                </label>
                                                <div className="relative">
                                                    <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        id={passwordId}
                                                        autoComplete="new-password"
                                                        placeholder="Create password"
                                                        aria-invalid={Boolean(errors.password)}
                                                        aria-describedby={errors.password ? `${passwordId}-error` : `${passwordId}-hint`}
                                                        className={errors.password ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        disabled={submitting}
                                                        {...register('password')}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword((v) => !v)}
                                                        disabled={submitting}
                                                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                {errors.password && (
                                                    <p id={`${passwordId}-error`} className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>
                                                )}
                                                {!errors.password && (
                                                    <p id={`${passwordId}-hint`} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{PASSWORD_POLICY_TEXT}</p>
                                                )}
                                                <div className="mt-3" aria-live="polite">
                                                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                                        <div className={`h-full rounded-full transition-all duration-200 ${passwordStrength.bar}`} />
                                                    </div>
                                                    <p className={`mt-1.5 text-xs font-semibold ${passwordStrength.text}`}>Password strength: {passwordStrength.label}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <label htmlFor={confirmPasswordId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    Confirm Password
                                                </label>
                                                <div className="relative">
                                                    <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        id={confirmPasswordId}
                                                        autoComplete="new-password"
                                                        placeholder="Confirm password"
                                                        aria-invalid={Boolean(errors.confirmPassword)}
                                                        aria-describedby={errors.confirmPassword ? `${confirmPasswordId}-error` : undefined}
                                                        className={errors.confirmPassword ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                        disabled={submitting}
                                                        {...register('confirmPassword')}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword((v) => !v)}
                                                        disabled={submitting}
                                                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                                    >
                                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                {errors.confirmPassword && (
                                                    <p id={`${confirmPasswordId}-error`} className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword.message}</p>
                                                )}
                                            </div>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-900"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Creating Workspace...
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus size={18} />
                                                    Create School Workspace
                                                </>
                                            )}
                                        </button>
                                    </form>
                                    <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/login')}
                                            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-all duration-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 dark:hover:text-slate-100"
                                        >
                                            <ArrowLeft size={16} />
                                            Back to Login
                                        </button>
                                        <Link
                                            to="/login"
                                            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-blue-700 transition-all duration-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-blue-300 dark:hover:text-blue-200"
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
                                    <h3 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">School Workspace Created Successfully</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        Your school workspace is ready. You can now start using the system.
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
