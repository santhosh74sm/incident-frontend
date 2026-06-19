import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, Loader2 } from 'lucide-react';
import apiClient from '../config/apiClient';
import { DashboardHero, DashboardPanel } from '../components/analytics/DashboardPrimitives';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

const AcademicYearManagement = () => {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');

    const getNextAcademicYear = (year) => {
        const match = String(year || '').match(/^(\d{4})-\d{2}$/);
        if (!match) return '';
        const startYear = Number(match[1]) + 1;
        return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
    };

    const nextAcademicYear = getNextAcademicYear(currentAcademicYear);

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

    const submitChange = async () => {
        setSaving(true);
        try {
            const { data } = await apiClient.put('/api/auth/academic-year', {});
            setCurrentAcademicYear(data.currentAcademicYear);
            const promotion = data?.promotion || {};
            addToast(
                `Academic year updated successfully. Students promoted: ${promotion.promoted || 0}. Students passed out: ${promotion.passedOut || 0}.`,
                'success'
            );
        } catch (error) {
            addToast(error.response?.data?.message || 'Could not update the academic year.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmAcademicYearChange = async () => {
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
                            <button
                                type="button"
                                onClick={confirmAcademicYearChange}
                                disabled={!nextAcademicYear || saving}
                                className="btn-primary h-12 justify-center disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <CheckCircle size={16} />
                                Change To Next Academic Year
                            </button>
                        </div>
                    )}
                </DashboardPanel>
            </div>

        </div>
    );
};

export default AcademicYearManagement;
