import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    GraduationCap,
    ShieldCheck,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../config/apiClient';
import {
    AnalyticsDataTable,
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
} from '../components/analytics/DashboardPrimitives';
import {
    formatShortDateTime,
    getIncidentTimestamp,
    resolveHandlerLabel,
} from '../utils/analytics';
import { isAdminRole, isIncidentReporterRole } from '../utils/roles';

// ─── Error Boundary ───────────────────────────────────────────────────────────

class DashboardErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 lg:p-6">
                    <div className="mx-auto max-w-[1560px] rounded-2xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-900/30 dark:bg-slate-900">
                        <div className="flex items-start gap-4">
                            <div className="rounded-xl bg-red-50 p-3 text-red-600 dark:bg-red-950/40">
                                <AlertCircle size={20} aria-hidden="true" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    Dashboard temporarily unavailable
                                </h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                                    A dashboard section failed to render. All other workspace routes remain available.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => this.setState({ hasError: false })}
                                    className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                >
                                    Retry Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// ─── Quick Actions Panel ──────────────────────────────────────────────────────

const QUICK_ACTION_TONES = {
    blue:    { hover: 'hover:border-blue-200 hover:bg-blue-50/80 dark:hover:border-blue-800/60 dark:hover:bg-blue-950/30',    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'    },
    slate:   { hover: 'hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800/60',          icon: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'   },
    orange:  { hover: 'hover:border-orange-200 hover:bg-orange-50/80 dark:hover:border-orange-800/50 dark:hover:bg-orange-950/30', icon: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' },
    emerald: { hover: 'hover:border-emerald-200 hover:bg-emerald-50/80 dark:hover:border-emerald-800/50 dark:hover:bg-emerald-950/30', icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
};

const QuickActionCard = memo(({ to, tone, icon: Icon, title, description }) => {
    const t = QUICK_ACTION_TONES[tone] || QUICK_ACTION_TONES.slate;
    return (
        <Link
            to={to}
            className={`group flex min-h-[44px] flex-col justify-center rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/60 ${t.hover}`}
        >
            <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${t.icon}`}>
                    <Icon size={16} aria-hidden="true" />
                </div>
                <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5"
                />
            </div>
            <p className="mt-3 text-[13px] font-bold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{description}</p>
        </Link>
    );
});

const QuickActionsPanel = memo(({ canReportIncident }) => (
    <DashboardPanel
        title="Quick Actions"
        description="Jump to the tasks you use most."
        icon={TrendingUp}
    >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
            {canReportIncident && (
                <QuickActionCard
                    to="/create-incident"
                    tone="blue"
                    icon={FileText}
                    title="Create Incident"
                    description="Start a new incident record."
                />
            )}
            <QuickActionCard
                to="/incidents"
                tone="slate"
                icon={Activity}
                title="All Incidents"
                description="Open cases, assignments, follow-ups."
            />
            <QuickActionCard
                to="/analytics"
                tone="orange"
                icon={TrendingUp}
                    title="School Analytics"
                description="School-wide summaries and charts."
            />
            <QuickActionCard
                to="/student-analytics"
                tone="emerald"
                icon={GraduationCap}
                title="Student History"
                description="One student's incidents and letters."
            />
        </div>
    </DashboardPanel>
));

// ─── Lifecycle progress panel ─────────────────────────────────────────────────

const LIFECYCLE_TONE_MAP = {
    emerald: 'bg-emerald-500',
    blue:    'bg-blue-500',
    red:     'bg-red-500',
    amber:   'bg-amber-500',
};

const LifecycleRow = memo(({ row }) => {
    const barColor = LIFECYCLE_TONE_MAP[row.tone] || 'bg-amber-500';
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{row.label}</span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400">
                    {row.count} &middot; {row.share}
                </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: row.share }}
                    role="progressbar"
                    aria-valuenow={row.count}
                    aria-label={`${row.label}: ${row.share}`}
                />
            </div>
        </div>
    );
});

const LifecycleOverviewPanel = memo(({ rows }) => (
    <DashboardPanel
        title="Incident Breakdown"
        description="Where cases stand right now at a glance."
        icon={Activity}
    >
        <div className="space-y-2.5">
            {rows.map((row) => (
                <LifecycleRow key={row.id} row={row} />
            ))}
        </div>
    </DashboardPanel>
));

// ─── Module-level request dedup map (unchanged) ────────────────────────────────

const dashboardDataRequests = new Map();

const fetchDashboardData = (user) => {
    const requestKey = `${user?._id || user?.id || 'unknown'}:${user?.role || 'unknown'}`;
    if (!dashboardDataRequests.has(requestKey)) {
        dashboardDataRequests.set(
            requestKey,
            apiClient.get('/api/incidents').finally(() => {
                dashboardDataRequests.delete(requestKey);
            })
        );
    }

    return dashboardDataRequests.get(requestKey);
};

// ─── Main Dashboard content ────────────────────────────────────────────────────

const DashboardContent = memo(() => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);

    const userId = user?._id || user?.id;
    const userRole = user?.role;

    const handleViewIncident = useCallback(
        (incidentId) => navigate(`/incidents/${incidentId}`),
        [navigate]
    );

    // ── Table columns (memoized) ─────────────────────────────────────────
    const recentIncidentColumns = useMemo(
        () => [
            { key: 'title',   label: 'Incident' },
            { key: 'student', label: 'Student'  },
            {
                key: 'status',
                label: 'Status',
                render: (row) => (
                    <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            row.status === 'Closed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : row.status === 'In Progress'
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300'
                                    : 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-300'
                        }`}
                    >
                        {row.status}
                    </span>
                ),
            },
            { key: 'handler', label: 'Assigned To' },
            { key: 'opened',  label: 'Opened'      },
            {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                    <button
                        onClick={() => handleViewIncident(row.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                    >
                        <Eye size={13} aria-hidden="true" />
                        View
                    </button>
                ),
            },
        ],
        [handleViewIncident]
    );

    // ── Fetch ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        let mounted = true;
        const requestUser = { _id: userId, role: userRole };

        const fetchData = async () => {
            try {
                setLoading(true);
                const incidentRes = await fetchDashboardData(requestUser);
                if (!mounted) return;

                const incidentList = Array.isArray(incidentRes.data)
                    ? incidentRes.data
                    : Array.isArray(incidentRes.data?.data)
                        ? incidentRes.data.data
                        : [];

                setIncidents(incidentList);
            } catch {
                if (!mounted) return;
                setIncidents([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [userId, userRole]);

    // ── Derived summaries (unchanged calculations) ────────────────────────
    const summary = useMemo(() => {
        const total      = incidents.length;
        const open       = incidents.filter((i) => i.status === 'Open').length;
        const inProgress = incidents.filter((i) => i.status === 'In Progress').length;
        const closed     = incidents.filter((i) => i.status === 'Closed').length;
        const unassigned = incidents.filter(
            (i) => !i?.assignedHandler || isAdminRole(i?.assignedHandler?.role)
        ).length;
        return { total, open, inProgress, closed, unassigned, active: open + inProgress };
    }, [incidents]);

    const canReportIncident = isIncidentReporterRole(user?.role);

    const recentIncidentRows = useMemo(
        () =>
            [...incidents]
                .sort(
                    (a, b) =>
                        new Date(getIncidentTimestamp(b) || 0) -
                        new Date(getIncidentTimestamp(a) || 0)
                )
                .slice(0, 6)
                .map((incident) => ({
                    id:      incident._id,
                    title:   incident.title || 'Untitled incident',
                    student: incident.studentDetails?.name || incident.studentsInvolved?.[0] || 'Student unavailable',
                    status:  incident.status || 'Open',
                    opened:  formatShortDateTime(getIncidentTimestamp(incident)),
                    handler: resolveHandlerLabel(incident),
                })),
        [incidents]
    );

    const lifecycleRows = useMemo(() => {
        const total = summary.total || 1;
        return [
            { id: 'open',     label: 'Open',        count: summary.open,       share: `${Math.round((summary.open / total) * 100)}%`,       tone: 'amber'   },
            { id: 'progress', label: 'In Progress',  count: summary.inProgress, share: `${Math.round((summary.inProgress / total) * 100)}%`, tone: 'blue'    },
            { id: 'closed',   label: 'Closed',       count: summary.closed,     share: `${Math.round((summary.closed / total) * 100)}%`,     tone: 'emerald' },
        ];
    }, [summary]);

    // ── Loading state ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 lg:p-6">
                <div className="mx-auto max-w-[1560px]">
                    <DashboardPageSkeleton />
                </div>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 lg:p-5">
            <div className="mx-auto max-w-[1560px] space-y-5">

                {/* Hero */}
                <DashboardHero
                    eyebrow="School overview"
                    title="Dashboard"
                    description="Monitor incidents and school activity."
                    icon={ShieldCheck}
                    actions={(
                        <>
                            {canReportIncident && (
                                <Link
                                    to="/create-incident"
                                    className="btn-primary"
                                >
                                    <FileText size={15} aria-hidden="true" />
                                    New Incident
                                </Link>
                            )}
                            <Link
                                to="/analytics"
                                className="btn-secondary"
                            >
                                <TrendingUp size={15} aria-hidden="true" />
                                View Reports
                            </Link>
                        </>
                    )}
                    meta={(
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
                                {summary.total} total
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
                                {summary.active} active
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
                                {summary.unassigned} unassigned
                            </span>
                        </div>
                    )}
                />

                {/* ── Stat cards ── */}
                <section
                    aria-label="Incident statistics"
                    className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                >
                    <DashboardStatCard
                        title="Active"
                        value={summary.active}
                        icon={TrendingUp}
                        tone="blue"
                        helper="Open + in progress"
                    />
                    <DashboardStatCard
                        title="Open"
                        value={summary.open}
                        icon={AlertCircle}
                        tone="amber"
                        helper="Awaiting first action"
                    />
                    <DashboardStatCard
                        title="In Progress"
                        value={summary.inProgress}
                        icon={Clock}
                        tone="blue"
                        helper="Currently being handled"
                    />
                    <DashboardStatCard
                        title="Closed"
                        value={summary.closed}
                        icon={CheckCircle}
                        tone="emerald"
                        helper="Resolved"
                    />
                    <DashboardStatCard
                        title="Unassigned"
                        value={summary.unassigned}
                        icon={Users}
                        tone="red"
                        helper="Needs an owner"
                    />
                </section>

                {/* ── Main body: table + side panels ── */}
                <section
                    aria-label="Recent incidents and actions"
                    className="grid grid-cols-1 gap-5 xl:grid-cols-12"
                >
                    {/* Recent incidents table */}
                    <DashboardPanel
                        className="xl:col-span-7"
                        title="Recent Incidents"
                        description="Latest cases — most recently opened or updated."
                        icon={FileText}
                        actions={(
                            <Link
                                to="/incidents"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                View All
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                        )}
                    >
                        <AnalyticsDataTable
                            columns={recentIncidentColumns}
                            rows={recentIncidentRows}
                            emptyMessage="No incidents have been recorded yet."
                        />
                    </DashboardPanel>

                    {/* Right column */}
                    <div className="flex flex-col gap-5 xl:col-span-5">
                        <QuickActionsPanel canReportIncident={canReportIncident} />
                        <LifecycleOverviewPanel rows={lifecycleRows} />
                    </div>
                </section>

            </div>
        </div>
    );
});

// ─── Export ───────────────────────────────────────────────────────────────────

const Dashboard = () => (
    <DashboardErrorBoundary>
        <DashboardContent />
    </DashboardErrorBoundary>
);

export default Dashboard;
