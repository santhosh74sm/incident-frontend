import React, { useId, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowRight,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    LogIn,
    Mail,
    ShieldCheck,
    Sparkles,
    AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLogin } from '../hooks/useAuthMutations';
import { loginSchema } from '../lib/validators';

const INPUT_CLASS_NAME =
    'w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-800/70 dark:focus:ring-indigo-400/20';

const INPUT_ERROR_CLASS_NAME =
    'w-full rounded-xl border border-red-300 bg-red-50/60 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/15 dark:border-red-500/50 dark:bg-red-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-red-950/40 dark:focus:ring-red-400/20';

const getFriendlyLoginError = (message) => {
    const value = String(message || '').toLowerCase();
    if (!message) return '';
    if (value.includes('validation')) return 'Please check your email and password.';
    if (value.includes('invalid') || value.includes('unauthorized') || value.includes('incorrect')) {
        return 'The email or password is not correct.';
    }
    if (value.includes('network')) return 'Unable to connect. Please check your internet and try again.';
    return message;
};

const Login = () => {
    const emailId = useId();
    const passwordId = useId();
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const loginMutation = useLogin();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '', loginType: 'staff' },
    });

    const onSubmit = async (data) => {
        try {
            const user = await loginMutation.mutateAsync(data);
            login(user);
            navigate(user?.mustChangePassword ? '/change-password' : '/dashboard');
        } catch {
            // error shown via loginMutation.error below
        }
    };

    const rawServerError = loginMutation.error?.response?.data?.message || loginMutation.error?.message;
    const serverError = getFriendlyLoginError(rawServerError);
    const submitting = isSubmitting || loginMutation.isPending;

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-slate-950 dark:bg-slate-950">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f172a_0%,#111827_48%,#1e293b_100%)]" />

            <div className="relative mx-auto grid min-h-screen w-full max-w-7xl content-center items-stretch gap-5 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.9fr)] lg:gap-8 lg:px-8">
                <section className="order-2 hidden min-w-0 flex-col justify-center rounded-2xl border border-white/10 bg-white/8 p-5 text-white shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8 sm:p-8 lg:order-1 lg:flex lg:p-10">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
                        <ShieldCheck size={14} />
                        Secure Portal
                    </div>
                    <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                        Incident Tracking System
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                        Sign in to manage school incidents.
                    </p>
                    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">For Admins</p>
                            <p className="mt-2 text-base font-medium leading-7 text-slate-200">Manage staff, reports, uploads, and official letters.</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">For Teachers</p>
                            <p className="mt-2 text-base font-medium leading-7 text-slate-200">Report incidents quickly and track follow-up work.</p>
                        </div>
                    </div>
                </section>

                <section className="order-1 flex w-full min-w-0 items-center lg:order-2 lg:justify-end">
                    <div className="w-full overflow-hidden rounded-2xl border border-white/15 bg-white shadow-xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900 lg:max-w-xl">
                        <div className="border-b border-slate-200/80 bg-slate-900 px-6 py-7 text-white dark:border-slate-800 sm:px-8 sm:py-8">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-lg sm:h-14 sm:w-14">
                                    <ShieldCheck size={26} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Staff Portal</p>
                                    <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Sign In</h2>
                                </div>
                            </div>
                            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                                Use your school account.
                            </p>
                        </div>

                        <div className="p-6 sm:p-8">
                            <div className="mb-7 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100 lg:hidden">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="mt-0.5 text-blue-600" size={18} />
                                    <p className="leading-6">
                                        Secure sign-in for administrators and teachers.
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
                                            <p className="text-sm font-semibold text-red-800 dark:text-red-100">Sign-in failed</p>
                                            <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-200">{serverError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate aria-busy={submitting}>
                                <div>
                                    <label htmlFor={emailId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Email Address
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

                                <div>
                                    <label htmlFor={passwordId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id={passwordId}
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            aria-invalid={Boolean(errors.password)}
                                            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
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
                                        <p id={`${passwordId}-error`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">{errors.password.message}</p>
                                    )}
                                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                        Password resets are handled by the Super Admin. Ask them for a temporary password.
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
                                            Signing in…
                                        </>
                                    ) : (
                                        <>
                                            <LogIn size={18} />
                                            Sign In
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-slate-500 dark:text-slate-400">New school?</p>
                                <Link
                                    to="/register"
                                    className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-blue-700 transition-all duration-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-blue-300 dark:hover:text-blue-200"
                                >
                                    Create school workspace
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Login;
