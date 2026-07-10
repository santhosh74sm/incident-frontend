import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle,
    Eye,
    FileText,
    GraduationCap,
    ShieldCheck,
    TrendingUp,
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
    formatDisplayValue,
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
                <div className="min-h-screen bg-[#f6f8fc] p-4 text-slate-800 lg:p-6">
                    <div className="mx-auto max-w-[1560px] rounded-2xl border border-red-200 bg-white p-8 shadow-sm ">
                        <div className="flex items-start gap-4">
                            <div className="rounded-xl bg-red-50 p-3 text-red-600 ">
                                <AlertCircle size={20} aria-hidden="true" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 ">
                                    Dashboard Temporarily Unavailable
                                </h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 ">
                                    A dashboard section failed to render. All other workspace routes remain available.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => this.setState({ hasError: false })}
                                    className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 "
                                >
                                    Try Again
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
    blue:    { hover: 'hover:border-blue-200 hover:bg-blue-50/80 ',    icon: 'bg-blue-100 text-blue-700 '    },
    slate:   { hover: 'hover:border-slate-300 hover:bg-white ',          icon: 'bg-slate-100 text-slate-700 '   },
    orange:  { hover: 'hover:border-orange-200 hover:bg-orange-50/80 ', icon: 'bg-orange-100 text-orange-700 ' },
    emerald: { hover: 'hover:border-emerald-200 hover:bg-emerald-50/80 ', icon: 'bg-emerald-100 text-emerald-700 ' },
};

const QuickActionCard = memo(({ to, tone, icon: Icon, title, description }) => {
    const t = QUICK_ACTION_TONES[tone] || QUICK_ACTION_TONES.slate;
    return (
        <Link
            to={to}
            className={`group flex min-h-[92px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] sm:min-h-[124px] sm:p-4 ${t.hover}`}
        >
            <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2.5 sm:p-3 ${t.icon}`}>
                    <Icon size={18} aria-hidden="true" />
                </div>
                <ArrowRight
                    size={15}
                    aria-hidden="true"
                    className="text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5"
                />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-950 ">{title}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500 sm:mt-1.5 sm:leading-5">{description}</p>
            </div>
        </Link>
    );
});

const QuickActionsPanel = memo(({ canAccessAnalytics, canReportIncident }) => (
    <DashboardPanel
        title="Quick Actions"
        description="Common tasks you can perform quickly."
        icon={TrendingUp}
    >
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2 ${canAccessAnalytics ? '2xl:grid-cols-4' : ''}`}>
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
                description="Review open cases, assignments, and follow-ups."
            />
            {canAccessAnalytics && (
                <>
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
                        title="Student Analytics"
                        description="One student's incidents and letters."
                    />
                </>
            )}
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
        <div>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700 ">
                    <span className={`h-2.5 w-2.5 rounded-full ${barColor}`} />
                    {row.label}
                </span>
                <span className="shrink-0 text-sm font-medium text-slate-500 ">
                    {row.count} ({row.share})
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 ">
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
        description="Overview of incidents by their current status."
        icon={Activity}
    >
        <div className="grid gap-6 md:grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[150px_minmax(0,1fr)]">
            <div
                className="mx-auto grid h-36 w-36 place-items-center rounded-full"
                style={{
                    background: `conic-gradient(#f97316 0 ${rows[0]?.share || '0%'}, #10b981 ${rows[0]?.share || '0%'} 100%)`,
                }}
                aria-label="Incident breakdown chart"
            >
                <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner ">
                    <div>
                        <p className="text-2xl font-extrabold leading-none text-slate-950 ">
                            {rows.reduce((sum, row) => sum + Number(row.count || 0), 0)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Total</p>
                    </div>
                </div>
            </div>
            <div className="space-y-5">
                {rows.map((row) => (
                    <LifecycleRow key={row.id} row={row} />
                ))}
            </div>
        </div>
    </DashboardPanel>
));

// ─── Module-level request dedup map (unchanged) ────────────────────────────────

const dashboardDataRequests = new Map();
const STATUS_PRIORITY = { Pending: 0, Closed: 1 };

const fetchDashboardData = (user) => {
    const requestKey = `${user?._id || user?.id || 'unknown'}:${user?.role || 'unknown'}:${user?.currentAcademicYear || 'unknown'}`;
    if (!dashboardDataRequests.has(requestKey)) {
        dashboardDataRequests.set(
            requestKey,
            Promise.all([
                apiClient.get('/api/incidents', { params: { page: 1, limit: 6, academicYear: user?.currentAcademicYear } }),
                apiClient.get('/api/incidents/summary', { params: { academicYear: user?.currentAcademicYear } }),
            ]).finally(() => {
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
    const [summary, setSummary] = useState({ total: 0, open: 0, inProgress: 0, closed: 0, unassigned: 0, active: 0 });
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
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 '
                                : 'border-orange-200 bg-orange-50 text-orange-700 '
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
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 "
                    >
                        <Eye size={13} aria-hidden="true" />
                        View Details
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
        const requestUser = {
            _id: userId,
            role: userRole,
            currentAcademicYear: user?.currentAcademicYear,
        };

        const fetchData = async () => {
            try {
                setLoading(true);
                const [incidentRes, summaryRes] = await fetchDashboardData(requestUser);
                if (!mounted) return;

                const incidentList = Array.isArray(incidentRes.data)
                    ? incidentRes.data
                    : Array.isArray(incidentRes.data?.data)
                        ? incidentRes.data.data
                        : [];

                setIncidents(incidentList);
                setSummary(summaryRes.data || { total: 0, open: 0, inProgress: 0, closed: 0, unassigned: 0, active: 0 });
            } catch {
                if (!mounted) return;
                setIncidents([]);
                setSummary({ total: 0, open: 0, inProgress: 0, closed: 0, unassigned: 0, active: 0 });
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [userId, userRole, user?.currentAcademicYear]);

    // ── Derived summaries (unchanged calculations) ────────────────────────
    const canReportIncident = isIncidentReporterRole(user?.role);
    const canAccessAnalytics = isAdminRole(user?.role);

    // Actionable-first ordering: Open, then In Progress (oldest pending surfaces first within
    // each), then Closed. Purely a client-side re-sort of the already-fetched incidents — no
    // API or calculation changes.
    const recentIncidentRows = useMemo(
        () =>
            [...incidents]
                .sort((a, b) => {
                    const priorityA = STATUS_PRIORITY[a.status] ?? 0;
                    const priorityB = STATUS_PRIORITY[b.status] ?? 0;
                    if (priorityA !== priorityB) return priorityA - priorityB;

                    const timeA = new Date(getIncidentTimestamp(a) || 0).getTime();
                    const timeB = new Date(getIncidentTimestamp(b) || 0).getTime();
                    // Open/In Progress: oldest pending first (needs attention).
                    // Closed: most recently closed first.
                    return priorityA === 2 ? timeB - timeA : timeA - timeB;
                })
                .slice(0, 6)
                .map((incident) => ({
                    id:      incident._id,
                    title:   formatDisplayValue(incident.title || 'Untitled incident'),
                    student: incident.studentDetails?.name || incident.studentsInvolved?.[0] || 'Student unavailable',
                    status:  formatDisplayValue(incident.status || 'Pending'),
                    opened:  formatShortDateTime(getIncidentTimestamp(incident)),
                    handler: resolveHandlerLabel(incident),
                })),
        [incidents]
    );

    const lifecycleRows = useMemo(() => {
        const total = summary.total || 1;
        return [
            { id: 'pending',  label: 'Pending',     count: summary.pending || summary.open,   share: `${Math.round(((summary.pending || summary.open) / total) * 100)}%`, tone: 'amber'   },
            { id: 'closed',   label: 'Closed',      count: summary.closed,                    share: `${Math.round((summary.closed / total) * 100)}%`,                    tone: 'emerald' },
        ];
    }, [summary]);

    // ── Loading state ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#f6f8fc] p-4 text-slate-800 lg:p-6">
                <div className="mx-auto max-w-[1560px]">
                    <DashboardPageSkeleton />
                </div>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f6f8fc] p-4 text-slate-800 lg:p-7">
            <div className="mx-auto max-w-[1560px] space-y-5">

                {/* Hero */}
                <DashboardHero
                    title={`Welcome, ${user?.name || 'Admin'}`}
                    icon={ShieldCheck}
                    meta={
                        (user?.schoolName || user?.currentAcademicYear) ? (
                            <div className="max-w-full min-w-0 space-y-1.5 text-center">
                                {user?.schoolName ? (
                                    <p className="break-words text-base font-bold text-slate-800 sm:text-lg">
                                        {user.schoolName}
                                    </p>
                                ) : null}
                                {user?.currentAcademicYear ? (
                                    <p className="text-sm font-semibold text-blue-700 ">
                                        Academic Year: {user.currentAcademicYear}
                                    </p>
                                ) : null}
                            </div>
                        ) : null
                    }
                    metaClassName="justify-center"
                    actions={(
                        <>
                            {canReportIncident && (
                                <Link
                                    to="/create-incident"
                                    className="btn-primary"
                                >
                                    <FileText size={15} aria-hidden="true" />
                                    Create Incident
                                </Link>
                            )}
                            {canAccessAnalytics && (
                                <Link
                                    to="/analytics"
                                    className="btn-secondary"
                                >
                                    <TrendingUp size={15} aria-hidden="true" />
                                    View Reports
                                </Link>
                            )}
                        </>
                    )}
                />

                {/* ── Stat cards ── */}
                <section
                    aria-label="Incident statistics"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                >
                    <DashboardStatCard
                        title="Total Incidents"
                        value={summary.total}
                        icon={TrendingUp}
                        tone="blue"
                        helper="All incidents this academic year"
                    />
                    <DashboardStatCard
                        title="Pending Incidents"
                        value={summary.pending || summary.open}
                        icon={AlertCircle}
                        tone="amber"
                        helper="Awaiting action"
                    />
                    <DashboardStatCard
                        title="Closed Incidents"
                        value={summary.closed}
                        icon={CheckCircle}
                        tone="emerald"
                        helper="Resolved"
                    />
                </section>

                {/* ── Main body: recent incidents + breakdown ── */}
                <section
                    aria-label="Recent incidents and breakdown"
                    className="grid grid-cols-1 gap-4 xl:grid-cols-12"
                >
                    {/* Recent incidents table */}
                    <DashboardPanel
                        className="xl:col-span-7"
                        title="Recent Incidents"
                        description="Showing latest incidents that need your attention."
                        icon={FileText}
                        actions={(
                            <Link
                                to="/incidents"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 "
                            >
                                View All
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                        )}
                    >
                        <div className="hidden md:block">
                            <AnalyticsDataTable
                                columns={recentIncidentColumns}
                                rows={recentIncidentRows}
                                emptyMessage="No incidents have been recorded yet."
                            />
                        </div>
                        <div className="space-y-2 md:hidden">
                            {recentIncidentRows.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                                    No incidents have been recorded yet.
                                </div>
                            ) : recentIncidentRows.map((row) => (
                                <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <span
                                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                                    row.status === 'Closed'
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                                                }`}
                                            >
                                                {row.status}
                                            </span>
                                            <h3 className="mt-2 truncate text-sm font-bold text-slate-950">{row.title}</h3>
                                            <p className="mt-1 truncate text-xs text-slate-500">{row.student}</p>
                                            <p className="mt-1 text-xs tabular-nums text-slate-400">{row.opened}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleViewIncident(row.id)}
                                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                        >
                                            <Eye size={12} />
                                            View
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </DashboardPanel>

                    {/* Right column */}
                    <div className="flex flex-col gap-4 xl:col-span-5">
                        <LifecycleOverviewPanel rows={lifecycleRows} />
                    </div>
                </section>

                {/* Quick Actions must remain the final dashboard section. */}
                <QuickActionsPanel canAccessAnalytics={canAccessAnalytics} canReportIncident={canReportIncident} />

            </div>
        </div>
    );
});

const Dashboard = () => (
    <DashboardErrorBoundary>
        <DashboardContent />
    </DashboardErrorBoundary>
);

export default Dashboard;
