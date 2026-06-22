import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldCheck, XCircle } from 'lucide-react';
import apiClient from '../config/apiClient';
import { useAuth } from '../context/AuthContext';
import { getPasswordStrengthLevel, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT } from '../lib/validators';
import useFocusFirstInvalid from '../hooks/useFocusFirstInvalid';

// ─── Security helpers (unchanged) ─────────────────────────────────────────────

const isStrongPassword = (password) =>
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH;

// ─── Password strength (UI only, does NOT affect validation) ──────────────────

const STRENGTH_CONFIG = [
    { label: '',       barColor: 'bg-slate-200 dark:bg-slate-700', textColor: '' },
    { label: 'Weak',   barColor: 'bg-rose-500',    textColor: 'text-rose-600 dark:text-rose-400' },
    { label: 'Fair',   barColor: 'bg-amber-500',   textColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Good',   barColor: 'bg-blue-500',    textColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Strong', barColor: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const Requirement = ({ met, label }) => (
    <div className="flex items-center gap-1.5">
        {met ? (
            <CheckCircle2 size={13} className="shrink-0 text-emerald-500" aria-hidden />
        ) : (
            <XCircle size={13} className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
        )}
        <span
            className={`text-xs transition-colors duration-200 ${
                met
                    ? 'font-medium text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
            }`}
        >
            {label}
        </span>
    </div>
);

const PasswordStrengthBar = ({ password }) => {
    const strength = getPasswordStrengthLevel(password);
    const cfg      = STRENGTH_CONFIG[strength];

    return (
        <div className="space-y-3">
            {/* Segmented bar */}
            <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((level) => (
                        <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                strength >= level ? cfg.barColor : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        />
                    ))}
                </div>
                {password ? (
                    <span
                        className={`min-w-[44px] text-right text-xs font-semibold transition-colors duration-200 ${cfg.textColor}`}
                        aria-live="polite"
                        aria-label={`Password strength: ${cfg.label}`}
                    >
                        {cfg.label}
                    </span>
                ) : null}
            </div>

            {/* Requirement checklist */}
            <div className="flex flex-col gap-y-1.5">
                <Requirement met={password.length >= PASSWORD_MIN_LENGTH} label={`${PASSWORD_MIN_LENGTH}+ characters`} />
            </div>
        </div>
    );
};

const PasswordField = ({ id, label, value, onChange, placeholder, visible, onToggle, minLength, invalid = false }) => {
    const ToggleIcon = visible ? EyeOff : Eye;

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
            >
                {label}
            </label>
            <div className="relative">
                {/* Lock icon */}
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={15} aria-hidden />
                </span>

                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    minLength={minLength}
                    required
                    aria-invalid={invalid}
                    className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 py-3 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />

                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                >
                    <ToggleIcon size={16} aria-hidden />
                </button>
            </div>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const ForceChangePassword = () => {
    const formRef = useRef(null);
    const { user, login, restoreAuth } = useAuth();
    const navigate = useNavigate();

    const [newPassword, setNewPassword]             = useState('');
    const [confirmPassword, setConfirmPassword]     = useState('');
    const [visibleFields, setVisibleFields]         = useState({ next: false, confirm: false });
    const [error, setError]                         = useState('');
    const [saving, setSaving]                       = useState(false);
    const confirmInvalid = Boolean(error && error.toLowerCase().includes('match'));
    useFocusFirstInvalid(error ? { password: error } : {}, formRef);

    const toggleVisibility = (field) =>
        setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));

    const passwordsMatch    = confirmPassword.length > 0 && newPassword === confirmPassword;

    // ── Submit (auth logic unchanged) ──────────────────────────────────────────
    const submit = async (event) => {
        event.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('New password and confirmation are required.');
            return;
        }
        if (!isStrongPassword(newPassword)) {
            setError('New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSaving(true);
        try {
            const endpoint =
                user?.role === 'Student'
                    ? '/api/auth/student/change-password'
                    : '/api/auth/change-password';
            const { data } = await apiClient.post(endpoint, { newPassword, confirmPassword });
            const freshUser = await restoreAuth({ silent: true });
            login(freshUser || data?.user || { ...user, mustChangePassword: false });
            navigate('/dashboard', { replace: true });
        } catch (requestError) {
            const fieldErrors = requestError.response?.data?.errors || {};
            setError(
                fieldErrors.confirmPassword?.[0] ||
                fieldErrors.newPassword?.[0] ||
                fieldErrors.currentPassword?.[0] ||
                requestError.response?.data?.message ||
                'Unable to change password. Please try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
            <div className="w-full max-w-md">

                {/* ── Trust header ──────────────────────────────────────────── */}
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                        <ShieldCheck size={26} aria-hidden />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Update Your Password
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        Set a secure new password.
                    </p>
                </div>

                {/* ── Form card ─────────────────────────────────────────────── */}
                <form
                    ref={formRef}
                    onSubmit={submit}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    noValidate
                >
                    {/* Error alert */}
                    {error ? (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-400"
                        >
                            <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    <div className="space-y-5">


                        {/* New password */}
                        <PasswordField
                            id="new-password"
                            label="New Password"
                            value={newPassword}
                            onChange={setNewPassword}
                            placeholder="Create a strong new password"
                            minLength={PASSWORD_MIN_LENGTH}
                            visible={visibleFields.next}
                            onToggle={() => toggleVisibility('next')}
                            invalid={Boolean(error && !confirmInvalid)}
                        />

                        {/* Strength meter + requirement checklist */}
                        {newPassword ? (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                                <PasswordStrengthBar password={newPassword} />
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{PASSWORD_POLICY_TEXT}</p>
                        )}

                        {/* Confirm password */}
                        <div className="space-y-2">
                            <PasswordField
                                id="confirm-password"
                                label="Confirm New Password"
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                placeholder="Re-enter your new password"
                                minLength={PASSWORD_MIN_LENGTH}
                                visible={visibleFields.confirm}
                                onToggle={() => toggleVisibility('confirm')}
                                invalid={confirmInvalid}
                            />

                            {/* Live match indicator */}
                            {confirmPassword ? (
                                <div
                                    aria-live="polite"
                                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-200 ${
                                        passwordsMatch
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                >
                                    {passwordsMatch ? (
                                        <><CheckCircle2 size={13} aria-hidden /> Passwords match</>
                                    ) : (
                                        <><XCircle size={13} aria-hidden /> Passwords do not match</>
                                    )}
                                </div>
                            ) : null}
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            {saving ? (
                                <><Loader2 size={16} className="animate-spin" aria-hidden /> Saving…</>
                            ) : (
                                'Save New Password'
                            )}
                        </button>
                    </div>
                </form>

                {/* Footer trust note */}
                <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    Your password is encrypted and never stored in plain text.
                </p>
            </div>
        </div>
    );
};

export default ForceChangePassword;
