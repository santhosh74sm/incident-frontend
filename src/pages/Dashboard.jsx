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
    ActivityFeed,
    AnalyticsDataTable,
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
} from '../components/analytics/DashboardPrimitives';
import {
    formatShortDateTime,
    getIncidentTimestamp,
    buildDashboardActivityFeed,
    resolveHandlerLabel,
    formatActivityRecordLabel,
} from '../utils/analytics';

class DashboardErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch() {}

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-100 p-4 text-slate-800 lg:p-6">
                    <div className="mx-auto max-w-[1600px] rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                                <AlertCircle size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Dashboard temporarily unavailable</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                    One dashboard widget failed to render. Other workspace routes remain available while this view recovers.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => this.setState({ hasError: false })}
                                    className="mt-5 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
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

const QuickActionsPanel = memo(({ canReportIncident }) => (
    <DashboardPanel title="Quick shortcuts" description="Jump to everyday tasks staff use most." icon={TrendingUp}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            {canReportIncident ? (
                <QuickActionLink
                    to="/create-incident"
                    tone="blue"
                    icon={FileText}
                    title="Report an incident"
                    description="Start a new incident record."
                />
            ) : null}
            <QuickActionLink
                to="/incidents"
                tone="slate"
                icon={Activity}
                title="All incidents"
                description="See open cases, assignments, and follow-ups."
            />
            <QuickActionLink
                to="/analytics"
                tone="orange"
                icon={TrendingUp}
                title="School reports & summary"
                description="School-wide summaries and charts."
            />
            <QuickActionLink
                to="/student-analytics"
                tone="emerald"
                icon={GraduationCap}
                title="Student summaries"
                description="Look up one student’s involvement and letter history."
            />
        </div>
    </DashboardPanel>
));

const QuickActionLink = memo(({ to, tone, icon: Icon, title, description }) => {
    const toneClasses = {
        blue: { hover: 'hover:border-blue-200 hover:bg-blue-50', icon: 'bg-blue-100 text-blue-700' },
        slate: { hover: 'hover:border-slate-300 hover:bg-white', icon: 'bg-slate-200/70 text-slate-700' },
        orange: { hover: 'hover:border-orange-200 hover:bg-orange-50', icon: 'bg-orange-100 text-orange-700' },
        emerald: { hover: 'hover:border-emerald-200 hover:bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700' },
    };

    const currentTone = toneClasses[tone] || toneClasses.slate;

    return (
        <Link to={to} className={`flex min-h-[44px] flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4 transition ${currentTone.hover}`}>
            <div className="flex items-center justify-between">
                <div className={`rounded-xl ${currentTone.icon} p-2`}>
                    <Icon size={18} />
                </div>
                <ArrowRight size={16} className="text-slate-400" />
            </div>
            <p className="mt-4 font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
        </Link>
    );
});

const dashboardDataRequests = new Map();

const fetchDashboardData = (user) => {
    const requestKey = `${user?._id || user?.id || 'unknown'}:${user?.role || 'unknown'}`;
    if (!dashboardDataRequests.has(requestKey)) {
        const requests = [
            apiClient.get('/api/incidents', { params: { page: 1, limit: 20 } }),
            ['Super Admin', 'Admin'].includes(user.role)
                ? apiClient.get('/api/logs', { params: { page: 1, limit: 6 } })
                : Promise.resolve({ data: [] }),
        ];

        dashboardDataRequests.set(
            requestKey,
            Promise.all(requests).finally(() => {
                dashboardDataRequests.delete(requestKey);
            })
        );
    }

    return dashboardDataRequests.get(requestKey);
};

const LifecycleOverviewPanel = memo(({ rows }) => (
    <DashboardPanel title="Progress snapshot" description="Where incidents stand right now—in plain language." icon={Activity}>
        <div className="space-y-4">
            {rows.map((row) => {
                const tone = row.tone === 'emerald'
                    ? 'bg-emerald-500'
                    : row.tone === 'blue'
                        ? 'bg-blue-500'
                        : row.tone === 'red'
                            ? 'bg-red-500'
                            : 'bg-orange-500';

                return (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-900">{row.label}</span>
                            <span className="text-slate-500">{row.count} incidents - {row.share}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className={`h-full rounded-full ${tone}`} style={{ width: row.share }} />
                        </div>
                    </div>
                );
            })}
        </div>
    </DashboardPanel>
));

const DashboardContent = memo(() => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const userId = user?._id || user?.id;
    const userRole = user?.role;

    const handleViewIncident = useCallback(
        (incidentId) => navigate(`/incidents/${incidentId}`),
        [navigate]
    );

    const recentIncidentColumns = useMemo(() => [
        { key: 'title', label: 'Incident' },
        { key: 'student', label: 'Student' },
        {
            key: 'status',
            label: 'Status',
            render: (row) => (
                <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                        row.status === 'Closed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : row.status === 'In Progress'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-orange-200 bg-orange-50 text-orange-700'
                    }`}
                >
                    {row.status}
                </span>
            ),
        },
        { key: 'handler', label: 'Assigned To' },
        { key: 'opened', label: 'Opened' },
        {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
                <button
                    onClick={() => handleViewIncident(row.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                    <Eye size={14} />
                    View
                </button>
            ),
        },
    ], [handleViewIncident]);

    useEffect(() => {
        if (!userId) return;

        let mounted = true;
        const requestUser = { _id: userId, role: userRole };

        const fetchData = async () => {
            try {
                setLoading(true);
                const [incidentRes, logsRes] = await fetchDashboardData(requestUser);

                if (!mounted) return;

                const incidentList = Array.isArray(incidentRes.data)
                    ? incidentRes.data
                    : Array.isArray(incidentRes.data?.data)
                        ? incidentRes.data.data
                        : [];
                const logsData = logsRes.data;
                const logs = Array.isArray(logsData)
                    ? logsData
                    : Array.isArray(logsData?.logs)
                        ? logsData.logs
                        : [];

                setIncidents(incidentList);
                setRecentLogs(logs);
            } catch {
                if (!mounted) return;
                setIncidents([]);
                setRecentLogs([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();

        return () => { mounted = false; };
    }, [userId, userRole]);

    const summary = useMemo(() => {
        const total = incidents.length;
        const open = incidents.filter((i) => i.status === 'Open').length;
        const inProgress = incidents.filter((i) => i.status === 'In Progress').length;
        const closed = incidents.filter((i) => i.status === 'Closed').length;
        const unassigned = incidents.filter(
            (i) => !i?.assignedHandler || ['Super Admin', 'Admin', 'super_admin', 'admin'].includes(i?.assignedHandler?.role)
        ).length;

        return { total, open, inProgress, closed, unassigned, active: open + inProgress };
    }, [incidents]);
    const canReportIncident = ['Admin', 'Teacher'].includes(user?.role);

    const recentIncidentRows = useMemo(
        () =>
            [...incidents]
                .sort((a, b) => new Date(getIncidentTimestamp(b) || 0) - new Date(getIncidentTimestamp(a) || 0))
                .slice(0, 6)
                .map((incident) => ({
                    id: incident._id,
                    title: incident.title || 'Untitled incident',
                    student: incident.studentDetails?.name || incident.studentsInvolved?.[0] || 'Student unavailable',
                    status: incident.status || 'Open',
                    opened: formatShortDateTime(getIncidentTimestamp(incident)),
                    handler: resolveHandlerLabel(incident),
                })),
        [incidents]
    );

    const lifecycleRows = useMemo(() => {
        const total = summary.total || 1;
        return [
            { id: 'open', label: 'Open', count: summary.open, share: `${Math.round((summary.open / total) * 100)}%`, tone: 'amber' },
            { id: 'progress', label: 'In Progress', count: summary.inProgress, share: `${Math.round((summary.inProgress / total) * 100)}%`, tone: 'blue' },
            { id: 'closed', label: 'Closed', count: summary.closed, share: `${Math.round((summary.closed / total) * 100)}%`, tone: 'emerald' },
        ];
    }, [summary]);

    const activityItems = useMemo(() => {
        if (recentLogs.length > 0) {
            return recentLogs.map((log) => ({
                id: log._id,
                title: log.actionName || 'System action',
                description: `${log.performedByName || log.performedBy || 'System'} · ${formatActivityRecordLabel(log.entityType)}`,
                timestamp: formatShortDateTime(log.createdAt),
                icon: Activity,
                tone:
                    log?.actionName?.toLowerCase().includes('delete')
                        ? 'red'
                        : log?.actionName?.toLowerCase().includes('close')
                            ? 'emerald'
                            : log?.actionName?.toLowerCase().includes('update')
                                ? 'blue'
                                : 'amber',
            }));
        }
        return buildDashboardActivityFeed(incidents, {
            icons: {
                closed: CheckCircle,
                inProgress: TrendingUp,
                open: AlertCircle,
            },
        });
    }, [incidents, recentLogs]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 p-4 text-slate-800 lg:p-6">
                <div className="mx-auto max-w-[1600px]">
                    <DashboardPageSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 text-slate-800 lg:p-6">
            <div className="mx-auto max-w-[1600px] space-y-6">
                <DashboardHero
                    eyebrow="School overview"
                    title="Dashboard"
                    description="See how many incidents are open, who is handling them, and what changed recently—all in one place."
                    icon={ShieldCheck}
                    actions={(
                        <>
                            {canReportIncident ? (
                                <Link
                                    to="/create-incident"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                                >
                                    <FileText size={16} />
                                    New incident
                                </Link>
                            ) : null}
                            <Link
                                to="/analytics"
                                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-blue-50"
                            >
                                <TrendingUp size={16} />
                                View reports & trends
                            </Link>
                        </>
                    )}
                    meta={(
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                {summary.total} total incidents
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                {summary.active} active workload
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                {activityItems.length} recent updates
                            </span>
                        </div>
                    )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    <DashboardStatCard title="Active Incidents" value={summary.active} icon={TrendingUp} tone="blue" helper="Open and in-progress workload" />
                    <DashboardStatCard title="Open" value={summary.open} icon={AlertCircle} tone="amber" helper="Waiting for first action" />
                    <DashboardStatCard title="In Progress" value={summary.inProgress} icon={Clock} tone="blue" helper="Currently being handled" />
                    <DashboardStatCard title="Closed" value={summary.closed} icon={CheckCircle} tone="emerald" helper="Resolved in current scope" />
                    <DashboardStatCard title="Unassigned" value={summary.unassigned} icon={Users} tone="red" helper="Needs ownership" />
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                    <DashboardPanel
                        className="xl:col-span-7"
                        title="Recent incidents"
                        description="Most recently opened or updated cases."
                        icon={FileText}
                        actions={(
                            <Link
                                to="/incidents"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                View All
                                <ArrowRight size={14} />
                            </Link>
                        )}
                    >
                        <AnalyticsDataTable
                            columns={recentIncidentColumns}
                            rows={recentIncidentRows}
                            emptyMessage="No incidents have been recorded yet."
                        />
                    </DashboardPanel>

                    <div className="space-y-6 xl:col-span-5">
                        <QuickActionsPanel canReportIncident={canReportIncident} />
                        <LifecycleOverviewPanel rows={lifecycleRows} />
                    </div>
                </div>

                <DashboardPanel title="What happened recently" description="Updates drawn from incidents and administrative activity history." icon={Activity}>
                    <ActivityFeed items={activityItems} emptyMessage="No recent activity is available right now." />
                </DashboardPanel>
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
