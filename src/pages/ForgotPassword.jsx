import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Mail,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { useForgotPassword } from '../hooks/useAuthMutations';
import { forgotPasswordSchema } from '../lib/validators';

const INPUT_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3.5 pl-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-800/70 dark:focus:ring-indigo-400/20';

const INPUT_ERROR_CLASS_NAME =
    'w-full rounded-2xl border border-red-300 bg-red-50/60 px-4 py-3.5 pl-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/15 dark:border-red-500/50 dark:bg-red-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-red-950/40 dark:focus:ring-red-400/20';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const forgotMutation = useForgotPassword();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (data) => {
        try {
            await forgotMutation.mutateAsync(data);
            setTimeout(() => {
                navigate('/verify-otp', { state: { email: data.email.trim() } });
            }, 700);
        } catch {
            // error shown via forgotMutation.error
        }
    };

    const serverError = forgotMutation.error?.response?.data?.message || forgotMutation.error?.message;
    const successMsg = forgotMutation.isSuccess
        ? forgotMutation.data?.message || 'A reset code has been sent to your email address.'
        : null;

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 dark:bg-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.18),_transparent_30%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(15,23,42,0.92),rgba(15,23,42,0.75),rgba(2,6,23,0.96))]" />

            <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8">
                <section className="hidden rounded-[32px] border border-white/10 bg-white/6 p-10 text-white shadow-xl backdrop-blur-xl lg:block">
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                        <ShieldCheck size={14} />
                        Account Recovery
                    </div>
                    <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
                        Verify your staff email before resetting access.
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
                        Enter the email connected to your staff account. If it exists, the system will send a short-lived reset code.
                    </p>
                    <div className="mt-10 space-y-4">
                        {[
                            'Email is checked before any reset code is created.',
                            'The reset code expires after 2 minutes.',
                            'A new password can only be set after the code is verified.',
                        ].map((item) => (
                            <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                                <CheckCircle2 className="mt-0.5 text-blue-300" size={18} />
                                <p className="text-sm leading-6 text-slate-200">{item}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto w-full max-w-xl">
                    <div className="rounded-[32px] border border-white/15 bg-white/90 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-8 py-8 text-white dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-lg">
                                    <Mail size={26} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Password Reset</p>
                                    <h2 className="mt-1 text-3xl font-semibold tracking-tight">Forgot password</h2>
                                </div>
                            </div>
                            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                                Request a 6-digit reset code using your staff email address.
                            </p>
                        </div>

                        <div className="p-8">
                            <div className="mb-8 rounded-3xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100 lg:hidden">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="mt-0.5 text-blue-600" size={18} />
                                    <p className="leading-6">Enter your staff email to receive a 2-minute reset code.</p>
                                </div>
                            </div>

                            {serverError && (
                                <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-500/30 dark:bg-red-950/30" role="alert" aria-live="polite">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                                            <AlertCircle size={18} />
                                        </div>
                                        <p className="text-sm leading-6 text-red-800 dark:text-red-100">{serverError}</p>
                                    </div>
                                </div>
                            )}

                            {successMsg && (
                                <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-500/30 dark:bg-emerald-950/30" role="status" aria-live="polite">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                                            <CheckCircle2 size={18} />
                                        </div>
                                        <p className="text-sm leading-6 text-emerald-800 dark:text-emerald-100">{successMsg}</p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                                <div>
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

                                <button
                                    type="submit"
                                    disabled={isSubmitting || forgotMutation.isPending}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {forgotMutation.isPending ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Checking Email...
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={18} />
                                            Send Reset Code
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-200"
                                >
                                    <ArrowLeft size={16} />
                                    Back to Login
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ForgotPassword;
