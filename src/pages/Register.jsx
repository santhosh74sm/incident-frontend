import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    Cloud,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    Lock,
    Mail,
    School,
    ShieldCheck,
    User,
    UserPlus,
    Users,
    Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRegister } from '../hooks/useAuthMutations';
import { getPasswordStrength, PASSWORD_POLICY_TEXT, registerSchema } from '../lib/validators';
import useFocusFirstInvalid from '../hooks/useFocusFirstInvalid';

const INPUT_CLASS_NAME =
    'h-12 w-full rounded-lg border border-slate-200 bg-white px-4 pl-11 pr-12 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ';

const INPUT_ERROR_CLASS_NAME =
    'h-12 w-full rounded-lg border border-rose-300 bg-rose-50/60 px-4 pl-11 pr-12 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/15 ';

const getFriendlyRegisterError = (message) => {
    const value = String(message || '').toLowerCase();
    if (!message) return '';
    if (value.includes('duplicate') || value.includes('already')) return 'This email or school is already registered.';
    if (value.includes('validation')) return 'Please check the highlighted fields.';
    if (value.includes('network')) return 'Unable to connect. Please check your internet and try again.';
    return message;
};

const BrandMark = ({ size = 'md' }) => (
    <div className={`flex shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-950/25 ${size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'}`}>
        <ShieldCheck size={size === 'lg' ? 25 : 20} strokeWidth={2.4} />
    </div>
);

const FeaturePoint = ({ icon: Icon, title, children }) => (
    <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-300/10 bg-blue-500/10 text-cyan-300">
            <Icon size={20} />
        </div>
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{children}</p>
        </div>
    </div>
);

const FormSection = ({ icon: Icon, title, children }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ">
                <Icon size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-950 ">{title}</h3>
        </div>
        <div className="mt-5 grid gap-5">{children}</div>
    </section>
);

const Register = () => {
    const nameId = useId();
    const schoolNameId = useId();
    const academicYearId = useId();
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
        defaultValues: { schoolName: '', superAdminName: '', email: '', academicYear: '', password: '', confirmPassword: '' },
    });

    const passwordValue = watch('password');
    const passwordStrength = getPasswordStrength(passwordValue);
    useFocusFirstInvalid(errors);

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
        <main className="relative min-h-screen overflow-x-hidden bg-[#071426] text-slate-900 ">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.30),transparent_28rem),radial-gradient(circle_at_86%_12%,rgba(14,165,233,0.18),transparent_25rem),linear-gradient(135deg,#05101f_0%,#071a33_48%,#0b2344_100%)]" />
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(59,130,246,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.10)_1px,transparent_1px)] [background-size:64px_64px]" />

            <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 px-5 py-5 md:px-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(500px,560px)] lg:gap-10 lg:py-7 xl:gap-16">
                <section className="hidden min-w-0 flex-col rounded-2xl border border-white/10 bg-slate-950/30 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur lg:flex xl:p-9">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BrandMark />
                            <span className="text-sm font-semibold">Incident Tracking System</span>
                        </div>
                        <div className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-slate-200">Need help?</div>
                    </header>

                    <div className="flex flex-1 flex-col justify-center py-12">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
                            <Users size={15} />
                            Create Workspace
                        </div>
                        <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight xl:text-5xl">
                            Create Your<br />School Workspace
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                            Set up your school and create the first Super Admin account.
                        </p>

                        <div className="mt-10 grid max-w-xl gap-6">
                            <FeaturePoint icon={Zap} title="Simple Setup">
                                Quick workspace creation with the required school and admin details.
                            </FeaturePoint>
                            <FeaturePoint icon={ShieldCheck} title="Secure & Private">
                                Your data is isolated within a protected school workspace.
                            </FeaturePoint>
                            <FeaturePoint icon={Cloud} title="Always Accessible">
                                Access your workspace from anywhere, anytime.
                            </FeaturePoint>
                        </div>
                    </div>

                    <footer className="border-t border-white/10 pt-5 text-center text-xs text-slate-400">
                        © 2026 Incident Tracking System. All rights reserved.
                    </footer>
                </section>

                <section className="flex min-w-0 items-start justify-center py-4 lg:justify-end">
                    <div className="w-full max-w-[560px]">
                        <div className="mb-6 flex items-center gap-3 text-white lg:hidden">
                            <BrandMark />
                            <span className="text-sm font-semibold">Incident Tracking System</span>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25 transition-colors duration-200 ">
                            <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
                                <div className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700 ">
                                    Create Workspace
                                </div>
                                <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 ">Let's Get Started!</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500 ">
                                    Fill in the details to create your school workspace.
                                </p>
                            </div>

                            <div className="px-5 py-6 sm:px-8 sm:py-7">
                                {!success ? (
                                    <>
                                        {serverError && (
                                            <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 " role="alert" aria-live="polite">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ">
                                                        <AlertCircle size={17} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-rose-800 ">Registration Issue</p>
                                                        <p className="mt-0.5 text-sm leading-6 text-rose-700 ">{serverError}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate aria-busy={submitting}>
                                            <FormSection icon={School} title="School Information">
                                                <div>
                                                    <label htmlFor={schoolNameId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 ">
                                                        School Name
                                                    </label>
                                                    <div className="relative">
                                                        <School className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input
                                                            type="text"
                                                            id={schoolNameId}
                                                            autoComplete="organization"
                                                            placeholder="Enter school name"
                                                            aria-invalid={Boolean(errors.schoolName)}
                                                            aria-describedby={errors.schoolName ? `${schoolNameId}-error` : undefined}
                                                            className={errors.schoolName ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                            disabled={submitting}
                                                            {...register('schoolName')}
                                                        />
                                                    </div>
                                                    {errors.schoolName && (
                                                        <p id={`${schoolNameId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 ">{errors.schoolName.message}</p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label htmlFor={emailId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 ">
                                                        Official Email
                                                    </label>
                                                    <div className="relative">
                                                        <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input
                                                            type="email"
                                                            id={emailId}
                                                            autoComplete="email"
                                                            placeholder="Enter official email"
                                                            aria-invalid={Boolean(errors.email)}
                                                            aria-describedby={errors.email ? `${emailId}-error` : undefined}
                                                            className={errors.email ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                            disabled={submitting}
                                                            {...register('email')}
                                                        />
                                                    </div>
                                                    {errors.email && (
                                                        <p id={`${emailId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 ">{errors.email.message}</p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label htmlFor={academicYearId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 ">
                                                        Academic Year
                                                    </label>
                                                    <div className="relative">
                                                        <CalendarDays className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input
                                                            type="text"
                                                            id={academicYearId}
                                                            placeholder="2026-27"
                                                            aria-invalid={Boolean(errors.academicYear)}
                                                            aria-describedby={errors.academicYear ? `${academicYearId}-error` : undefined}
                                                            className={errors.academicYear ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                            disabled={submitting}
                                                            {...register('academicYear')}
                                                        />
                                                    </div>
                                                    {errors.academicYear && (
                                                        <p id={`${academicYearId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 ">{errors.academicYear.message}</p>
                                                    )}
                                                </div>
                                            </FormSection>

                                            <FormSection icon={Users} title="Account Information">
                                                <div>
                                                    <label htmlFor={nameId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 ">
                                                        Super Admin Name
                                                    </label>
                                                    <div className="relative">
                                                        <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input
                                                            type="text"
                                                            id={nameId}
                                                            autoComplete="name"
                                                            placeholder="Enter full name"
                                                            aria-invalid={Boolean(errors.superAdminName)}
                                                            aria-describedby={errors.superAdminName ? `${nameId}-error` : undefined}
                                                            className={errors.superAdminName ? INPUT_ERROR_CLASS_NAME : INPUT_CLASS_NAME}
                                                            disabled={submitting}
                                                            {...register('superAdminName')}
                                                        />
                                                    </div>
                                                    {errors.superAdminName && (
                                                        <p id={`${nameId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 ">{errors.superAdminName.message}</p>
                                                    )}
                                                </div>

                                                <div className="grid gap-5 md:grid-cols-2">
                                                    <div>
                                                        <label htmlFor={passwordId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 ">
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
                                                                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                            >
                                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </button>
                                                        </div>
                                                        {errors.password && (
                                                            <p id={`${passwordId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 ">{errors.password.message}</p>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label htmlFor={confirmPasswordId} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 ">
                                                            Confirm Password
                                                        </label>
                                                        <div className="relative">
                                                            <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
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
                                                                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                                                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                                            >
                                                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </button>
                                                        </div>
                                                        {errors.confirmPassword && (
                                                            <p id={`${confirmPasswordId}-error`} className="mt-1.5 text-xs font-medium text-rose-600 ">{errors.confirmPassword.message}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div id={`${passwordId}-hint`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 ">
                                                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 " aria-hidden="true">
                                                        <div className={`h-full rounded-full transition-all duration-200 ${passwordStrength.bar}`} />
                                                    </div>
                                                    <p className={`mt-2 text-xs font-semibold ${passwordStrength.text}`}>Password strength: {passwordStrength.label}</p>
                                                    <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-500 ">
                                                        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={14} />
                                                        {PASSWORD_POLICY_TEXT}
                                                    </p>
                                                </div>
                                            </FormSection>

                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 "
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={18} />
                                                        Creating workspace...
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus size={18} />
                                                        Create School Workspace
                                                    </>
                                                )}
                                            </button>
                                        </form>

                                        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                                            <button
                                                type="button"
                                                onClick={() => navigate('/login')}
                                                className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-all duration-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                            >
                                                <ArrowLeft size={16} />
                                                Back to Login
                                            </button>
                                            <Link
                                                to="/login"
                                                className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-blue-700 transition-all duration-200 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                            >
                                                Already have an account?
                                                <ArrowRight size={16} />
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12 text-center">
                                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner ">
                                            <CheckCircle2 size={40} />
                                        </div>
                                        <h3 className="mt-6 text-2xl font-semibold text-slate-900 ">School Workspace Created</h3>
                                        <p className="mt-3 text-sm leading-7 text-slate-600 ">
                                            Your school workspace is ready. You can now start using the system.
                                        </p>
                                        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ">
                                            <Loader2 className="animate-spin" size={16} />
                                            Redirecting...
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Register;
