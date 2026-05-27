import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    ShieldCheck,
} from 'lucide-react';
import { useResetPassword } from '../hooks/useAuthMutations';
import { resetPasswordSchema } from '../lib/validators';

const INPUT_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800/70 dark:focus:ring-indigo-400/20';

const INPUT_ERROR_CLASS_NAME =
    'w-full rounded-2xl border border-red-300 bg-red-50/60 px-4 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/15 dark:border-red-500/50 dark:bg-red-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-red-950/40 dark:focus:ring-red-400/20';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const resetMutation = useResetPassword();
    const resetToken = searchParams.get('token') || '';
    const [showNewPassword, setShowNewPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    const onSubmit = async (data) => {
        if (!resetToken) {
            return;
        }

        try {
            await resetMutation.mutateAsync({
                token: resetToken,
                password: data.newPassword,
            });
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch {
            // error shown via resetMutation.error
        }
    };

    const tokenError = !resetToken ? 'Please verify your reset code before changing your password.' : '';
    const serverError = resetMutation.error?.response?.data?.message || resetMutation.error?.message;
    const error = tokenError || serverError;
    const successMsg = resetMutation.isSuccess
        ? 'Password updated successfully! Redirecting to login...'
        : null;

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 dark:bg-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_32%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(15,23,42,0.92),rgba(15,23,42,0.76),rgba(2,6,23,0.96))]" />

            <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8">
                <section className="hidden rounded-[32px] border border-white/10 bg-white/6 p-10 text-white shadow-xl backdrop-blur-xl lg:block">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">
                        <ShieldCheck size={14} />
                        Secure Update
                    </div>

                    <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
                        Set a new password after code verification.
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
                        Password updates are accepted only after the reset code has been verified.
                    </p>

                    <div className="mt-10 space-y-4">
                        {[
                            'New password and confirmation must match.',
                            'The reset token is short-lived.',
                            'After update, the token is cleared from the account.',
                        ].map((item) => (
                            <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                                <CheckCircle2 className="mt-0.5 text-indigo-300" size={18} />
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
                                    <Lock size={26} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Password Reset</p>
                                    <h2 className="mt-1 text-3xl font-semibold tracking-tight">Reset password</h2>
                                </div>
                            </div>
                            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                                Choose a new password for your staff account.
                            </p>
                        </div>

                        <div className="p-8">
                            {error ? (
                                <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-500/30 dark:bg-red-950/30" role="alert" aria-live="polite">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                                            <AlertCircle size={18} />
                                        </div>
                                        <p className="text-sm leading-6 text-red-800 dark:text-red-100">{error}</p>
                                    </div>
                                </div>
                            ) : null}

                            {successMsg ? (
                                <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-500/30 dark:bg-emerald-950/30" role="status" aria-live="polite">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                                            <CheckCircle2 size={18} />
                                        </div>
                                        <p className="text-sm leading-6 text-emerald-800 dark:text-emerald-100">{successMsg}</p>
                                    </div>
                                </div>
                            ) : null}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            placeholder="Enter new password"
                                            className={errors.newPassword ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                            {...register('newPassword')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword((current) => !current)}
                                            className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                            aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                                        >
                                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {errors.newPassword ? (
                                        <p className="mt-2 text-sm text-red-600">{errors.newPassword.message}</p>
                                    ) : null}
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
                                            placeholder="Confirm new password"
                                            className={errors.confirmPassword ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                            {...register('confirmPassword')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((current) => !current)}
                                            className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                            aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                                        >
                                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {errors.confirmPassword ? (
                                        <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
                                    ) : null}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || resetMutation.isPending || !resetToken}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSubmitting || resetMutation.isPending ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Updating Password...
                                        </>
                                    ) : (
                                        <>
                                            <Lock size={18} />
                                            Update Password
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

export default ResetPassword;
