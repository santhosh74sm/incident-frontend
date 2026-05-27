import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import apiClient from '../config/apiClient';
import { useAuth } from '../context/AuthContext';

const ForceChangePassword = () => {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const endpoint = user?.role === 'Student'
                ? '/api/auth/student/change-password'
                : '/api/auth/change-password';
            await apiClient.post(endpoint, { currentPassword, newPassword });
            login({ ...user, mustChangePassword: false });
            navigate('/dashboard', { replace: true });
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to change password.');
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
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        placeholder="Temporary or current password"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        required
                    />
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="New password"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        minLength={6}
                        required
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
