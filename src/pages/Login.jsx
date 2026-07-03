import React, { useId, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowRight,
    Eye,
    EyeOff,
    FileText,
    Loader2,
    Lock,
    LogIn,
    Mail,
    ShieldCheck,
    UserCog,
    AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLogin } from '../hooks/useAuthMutations';
import { loginSchema } from '../lib/validators';
import useFocusFirstInvalid from '../hooks/useFocusFirstInvalid';

const INPUT_CLASS_NAME =
    'h-12 w-full rounded-lg border border-slate-200 bg-white px-4 pl-11 pr-12 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';

const INPUT_ERROR_CLASS_NAME =
    'h-12 w-full rounded-lg border border-rose-300 bg-rose-50/60 px-4 pl-11 pr-12 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/15 dark:border-rose-500/50 dark:bg-rose-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-rose-950/40 dark:focus:ring-rose-400/20';

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

const BrandMark = ({ size = 'md' }) => (
    <div className={`flex shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-950/25 ${size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'}`}>
        <ShieldCheck size={size === 'lg' ? 25 : 20} strokeWidth={2.4} />
    </div>
);

const FeatureCard = ({ icon: Icon, title, children }) => (
    <div className="group flex gap-4 rounded-lg border border-white/10 bg-white/[0.055] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300/30 hover:bg-white/[0.08]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-300/10 bg-blue-500/10 text-cyan-300">
            <Icon size={20} />
        </div>
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{children}</p>
        </div>
    </div>
);

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
    useFocusFirstInvalid(errors);

    return (
        <main className="relative min-h-screen overflow-x-hidden bg-[#071426] text-slate-900 dark:bg-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(37,99,235,0.28),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(14,165,233,0.18),transparent_24rem),linear-gradient(135deg,#05101f_0%,#071a33_48%,#0b2344_100%)]" />
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(59,130,246,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.10)_1px,transparent_1px)] [background-size:64px_64px]" />

            <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,460px)] lg:gap-10 xl:gap-14">
                <section className="hidden min-h-[min(700px,calc(100dvh-3rem))] min-w-0 flex-col rounded-2xl border border-white/10 bg-slate-950/30 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur lg:flex xl:p-9">
                    <header className="flex items-center">
                        <div className="flex items-center gap-3">
                            <BrandMark />
                            <span className="text-sm font-semibold">Incident Tracking System</span>
                        </div>
                    </header>

                    <div className="flex flex-1 flex-col justify-center py-8">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
                            <ShieldCheck size={15} />
                            Secure Portal
                        </div>
                        <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight xl:text-5xl">
                            Incident<br />Tracking System
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                            Sign in to manage school incidents, reports, uploads, and official follow-up work.
                        </p>

                        <div className="mt-9 grid max-w-xl gap-4">
                            <FeatureCard icon={UserCog} title="For Admins">
                                Manage staff, reports, uploads, and official letters from one secure workspace.
                            </FeatureCard>
                            <FeatureCard icon={FileText} title="For Teachers">
                                Report incidents quickly and track follow-up work with clear accountability.
                            </FeatureCard>
                        </div>
                    </div>
                </section>

                <section className="flex min-w-0 items-center justify-center lg:justify-end">
                    <div className="w-full max-w-[460px]">
                        <div className="mb-5 flex items-center text-white lg:hidden">
                            <div className="flex items-center gap-3">
                                <BrandMark />
                                <span className="text-sm font-semibold">Incident Tracking System</span>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
                            <div className="px-5 pb-4 pt-7 text-center sm:px-8 sm:pt-8">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                                    <ShieldCheck size={25} />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Welcome Back!</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    Use your school account to continue.
                                </p>
                            </div>

                            <div className="px-5 pb-6 sm:px-8 sm:pb-7">
                                {serverError && (
                                    <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-950/30" role="alert" aria-live="polite">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
                                                <AlertCircle size={17} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-rose-800 dark:text-rose-100">Sign-in failed</p>
                                                <p className="mt-0.5 text-sm leading-6 text-rose-700 dark:text-rose-200">{serverError}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate aria-busy={submitting}>
                                    <div>
                                        <label htmlFor={emailId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                                            <p id={`${emailId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">{errors.email.message}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor={passwordId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                                                aria-describedby={errors.password ? `${passwordId}-error` : `${passwordId}-hint`}
                                                className={errors.password ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                disabled={submitting}
                                                {...register('password')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                disabled={submitting}
                                                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        {errors.password ? (
                                            <p id={`${passwordId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">{errors.password.message}</p>
                                        ) : (
                                            <p id={`${passwordId}-hint`} className="sr-only">Password resets are handled by the Super Admin.</p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                                                disabled={submitting}
                                            />
                                            Remember me
                                        </label>
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300" title="Password resets are handled by the Super Admin.">
                                            Forgot password?
                                        </span>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-900"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                Signing in...
                                            </>
                                        ) : (
                                            <>
                                                <LogIn size={18} />
                                                Sign In
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                                    <div className="flex items-center justify-between gap-4 text-sm">
                                        <p className="text-slate-500 dark:text-slate-400">New school?</p>
                                        <Link
                                            to="/register"
                                            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-blue-700 transition-all duration-200 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
                                        >
                                            Create school workspace
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Login;

