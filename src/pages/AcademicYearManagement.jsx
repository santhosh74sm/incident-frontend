import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import apiClient from '../config/apiClient';
import { DashboardHero, DashboardPanel } from '../components/analytics/DashboardPrimitives';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { useAuth } from '../context/AuthContext';

const AcademicYearManagement = () => {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const { restoreAuth } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reversing, setReversing] = useState(false);
    const [rollbackProgress, setRollbackProgress] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const rollbackTimersRef = useRef([]);

    const getNextAcademicYear = (year) => {
        const match = String(year || '').match(/^(\d{4})-\d{2}$/);
        if (!match) return '';
        const startYear = Number(match[1]) + 1;
        return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
    };

    const nextAcademicYear = getNextAcademicYear(currentAcademicYear);
    const getPreviousAcademicYear = (year) => {
        const match = String(year || '').match(/^(\d{4})-\d{2}$/);
        if (!match) return '';
        const startYear = Number(match[1]) - 1;
        return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
    };

    const previousAcademicYear = getPreviousAcademicYear(currentAcademicYear);

    const clearRollbackTimers = () => {
        rollbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        rollbackTimersRef.current = [];
    };

    const startRollbackProgress = () => {
        clearRollbackTimers();
        const steps = [
            [0, 'Deleting promoted year records...'],
            [900, 'Restoring students...'],
            [1800, 'Restoring classes...'],
            [2700, 'Validating data...'],
            [3600, 'Finishing rollback...'],
        ];
        steps.forEach(([delay, label]) => {
            const timer = window.setTimeout(() => setRollbackProgress(label), delay);
            rollbackTimersRef.current.push(timer);
        });
    };

    useEffect(() => {
        let mounted = true;
        apiClient.get('/api/auth/academic-years')
            .then(({ data }) => {
                if (!mounted) return;
                setCurrentAcademicYear(data?.currentAcademicYear || '');
            })
            .catch(() => addToast('Could not load academic year settings.', 'error'))
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, [addToast]);

    useEffect(() => () => clearRollbackTimers(), []);

    const submitChange = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const { data } = await apiClient.put('/api/auth/academic-year', {});
            setCurrentAcademicYear(data.currentAcademicYear);
            await restoreAuth({ silent: true });
            addToast('Academic Year updated successfully. Student promotion completed.', 'success');
        } catch (error) {
            addToast('Academic Year change failed. No changes were saved.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmAcademicYearChange = async () => {
        if (saving || reversing) return;
        const confirmed = await confirm({
            tone: 'warning',
            title: 'Change Academic Year',
            description: `Move the workspace from ${currentAcademicYear} to ${nextAcademicYear}. This is a school-wide administrative action.`,
            details: (
                <ul className="list-disc space-y-2 pl-5">
                    <li>Eligible students may be promoted according to the existing promotion rules.</li>
                    <li>Final-year students may be marked as passed out according to the existing pass-out rules.</li>
                    <li>Historical academic-year records are preserved and should not be edited manually.</li>
                    <li>Reports, uploads, analytics, and new incidents will use the updated current academic year.</li>
                </ul>
            ),
            confirmLabel: 'Change Academic Year',
        });
        if (confirmed) {
            await submitChange();
        }
    };

    const submitRollback = async () => {
        if (reversing) return;
        setReversing(true);
        startRollbackProgress();
        try {
            const { data } = await apiClient.post('/api/auth/academic-year/reverse', {});
            clearRollbackTimers();
            setRollbackProgress('');
            setCurrentAcademicYear(data.currentAcademicYear);
            await restoreAuth({ silent: true });
            addToast('Academic Year has been successfully restored. Previous Academic Year is now active. All student promotions have been reversed successfully.', 'success');
        } catch (error) {
            clearRollbackTimers();
            setRollbackProgress('');
            const reason = error.response?.data?.message || error.message || 'The system has been restored to its original state.';
            addToast(`Rollback failed. Reason: ${reason}`, 'error');
        } finally {
            setReversing(false);
        }
    };

    const confirmRollback = async () => {
        if (saving || reversing) return;
        const confirmed = await confirm({
            tone: 'danger',
            title: 'Reverse Academic Year Update',
            description: 'You are about to reverse the Academic Year Update.',
            details: (
                <div className="space-y-3">
                    <p>This will restore the previous Academic Year and permanently remove all data created for the promoted Academic Year.</p>
                    <p>This action cannot be undone.</p>
                    <p className="font-semibold">Do you want to continue?</p>
                </div>
            ),
            confirmLabel: 'Reverse Academic Year Update',
        });
        if (confirmed) {
            await submitRollback();
        }
    };

    return (
        <div className="min-h-full bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <DashboardHero
                    icon={CalendarDays}
                    title="Academic Year Management"
                    description="Set the year used for new students, incidents, uploads, logs, reports, and analytics."
                    meta={currentAcademicYear ? `Current ${currentAcademicYear}` : 'Loading'}
                />

                <DashboardPanel title="Current Academic Year" description="Only future records use the new value. Existing historical records remain unchanged." icon={CalendarDays}>
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading
                        </div>
                    ) : (
                        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Academic Year</span>
                                    <span className="mt-2 block text-lg font-bold text-slate-900 dark:text-slate-100">{currentAcademicYear}</span>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next Academic Year</span>
                                    <span className="mt-2 block text-lg font-bold text-slate-900 dark:text-slate-100">{nextAcademicYear}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={confirmAcademicYearChange}
                                    disabled={!nextAcademicYear || saving || reversing || loading}
                                    className="btn-primary h-12 justify-center disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                    {saving ? 'Processing Academic Year Change... Please wait.' : 'Change To Next Academic Year'}
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmRollback}
                                    disabled={!previousAcademicYear || saving || reversing || loading}
                                    className="btn-danger h-12 justify-center disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {reversing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                    {reversing ? 'Reversing Academic Year Update...' : 'Reverse Academic Year Update'}
                                </button>
                            </div>
                        </div>
                    )}
                </DashboardPanel>

                <DashboardPanel title="Rollback Safety" description="Use this only when the most recent Academic Year Update was executed by mistake." icon={AlertTriangle}>
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-100">
                            Reversing restores students from their previous academic-year history, removes records created in the promoted year, validates integrity, and writes an audit log.
                        </div>
                        {rollbackProgress ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                                {rollbackProgress}
                            </div>
                        ) : null}
                    </div>
                </DashboardPanel>
            </div>

        </div>
    );
};

export default AcademicYearManagement;
