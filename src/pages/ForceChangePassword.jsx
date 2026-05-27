import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import apiClient from '../config/apiClient';
import { useAuth } from '../context/AuthContext';

const PasswordField = ({ value, onChange, placeholder, visible, onToggle, minLength }) => {
    const VisibilityIcon = visible ? EyeOff : Eye;

    return (
        <div className="relative">
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 pr-12 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                minLength={minLength}
                required
            />
            <button
                type="button"
                onClick={onToggle}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label={visible ? `Hide ${placeholder.toLowerCase()}` : `Show ${placeholder.toLowerCase()}`}
            >
                <VisibilityIcon size={17} />
            </button>
        </div>
    );
};

const ForceChangePassword = () => {
    const { user, login, restoreAuth } = useAuth();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [visibleFields, setVisibleFields] = useState({
        current: false,
        next: false,
        confirm: false,
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const toggleVisibility = (field) => {
        setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');

        if (!currentPassword.trim() || !newPassword || !confirmPassword) {
            setError('Current password, new password, and confirmation are required.');
            return;
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (currentPassword === newPassword) {
            setError('New password must be different from the temporary password.');
            return;
        }

        setSaving(true);

        try {
            const endpoint = user?.role === 'Student'
                ? '/api/auth/student/change-password'
                : '/api/auth/change-password';
            const { data } = await apiClient.post(endpoint, { currentPassword, newPassword, confirmPassword });
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
                'Unable to change password.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
            <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                        <Lock size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Change password</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Set a new password before continuing.</p>
                    </div>
                </div>
                {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
                <div className="space-y-4">
                    <PasswordField
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        placeholder="Temporary or current password"
                        visible={visibleFields.current}
                        onToggle={() => toggleVisibility('current')}
                    />
                    <PasswordField
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="New password"
                        minLength={6}
                        visible={visibleFields.next}
                        onToggle={() => toggleVisibility('next')}
                    />
                    <PasswordField
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="Repeat new password"
                        minLength={6}
                        visible={visibleFields.confirm}
                        onToggle={() => toggleVisibility('confirm')}
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        Save Password
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ForceChangePassword;
