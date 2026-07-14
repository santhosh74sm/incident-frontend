import React, { memo } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { CHART_THEME, ChartSurface, CompactXAxisTick, useCompactChart } from './DashboardPrimitives';
import { CHART_COLORS, STATUS_COLORS } from '../../utils/analytics';

const TrendChartTooltipContent = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const dataObj = payload[0].payload || {};

    const pending = Number(dataObj.pending ?? 0);
    const closed = Number(dataObj.closed ?? 0);
    const created = Number(dataObj.created ?? 0);

    const isCreationTrend = dataObj.created !== undefined;
    const total = isCreationTrend ? created : (pending + closed);

    const fullDate = dataObj.fullDate || dataObj.name || label || 'Timeline Date';

    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
    const closedPct = total > 0 ? Math.round((closed / total) * 100) : 0;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {fullDate}
            </p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4 text-sm font-bold text-slate-900 border-b border-slate-100 pb-1">
                    <span>Incident Count</span>
                    <span>{total.toLocaleString('en-US')}</span>
                </div>
                {isCreationTrend ? (
                    <>
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
                                <span className="text-slate-600 font-medium">New Incidents</span>
                            </div>
                            <span className="font-semibold text-slate-900">
                                {created.toLocaleString('en-US')}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm pl-4">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.Pending }} />
                                <span className="text-slate-500">Pending</span>
                            </div>
                            <span className="font-semibold text-slate-700">
                                {pending.toLocaleString('en-US')} ({pendingPct}%)
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm pl-4">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.Closed }} />
                                <span className="text-slate-500">Closed</span>
                            </div>
                            <span className="font-semibold text-slate-700">
                                {closed.toLocaleString('en-US')} ({closedPct}%)
                            </span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.Pending }} />
                                <span className="text-slate-600 font-medium">Pending</span>
                            </div>
                            <span className="font-semibold text-slate-900">
                                {pending.toLocaleString('en-US')} ({pendingPct}%)
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.Closed }} />
                                <span className="text-slate-600 font-medium">Closed</span>
                            </div>
                            <span className="font-semibold text-slate-900">
                                {closed.toLocaleString('en-US')} ({closedPct}%)
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const TrendChartTooltip = ({ cursor }) => (
    <Tooltip
        cursor={cursor}
        allowEscapeViewBox={{ x: true, y: true }}
        content={<TrendChartTooltipContent />}
    />
);

const getXAxisInterval = (len) => {
    if (len <= 10) return 0;
    if (len <= 20) return 1;
    return 2;
};

export const IncidentStatusTrendChart = memo(({ data = [], height = 320, idPrefix = 'status-trend' }) => {
    const compactChart = useCompactChart();
    const interval = compactChart ? getXAxisInterval(data.length) : 'preserveStartEnd';
    const xAxisProps = compactChart
        ? { height: 68, interval, tickMargin: 12, tick: <CompactXAxisTick maxLength={10} /> }
        : { height: 35, tick: { fill: CHART_THEME.axis, fontSize: 12 }, interval: 'preserveStartEnd' };

    return (
        <ChartSurface height={height}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: compactChart ? 34 : 24 }}>
                    <defs>
                        <linearGradient id={`${idPrefix}-pending`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS.Pending} stopOpacity={0.18} />
                            <stop offset="95%" stopColor={STATUS_COLORS.Pending} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`${idPrefix}-closed`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS.Closed} stopOpacity={0.16} />
                            <stop offset="95%" stopColor={STATUS_COLORS.Closed} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} {...xAxisProps} />
                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                    <TrendChartTooltip cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="pending" stroke={STATUS_COLORS.Pending} fill={`url(#${idPrefix}-pending)`} strokeWidth={3} name="Pending" activeDot={{ r: 6 }} />
                    <Area type="monotone" dataKey="closed" stroke={STATUS_COLORS.Closed} fill={`url(#${idPrefix}-closed)`} strokeWidth={3} name="Closed" activeDot={{ r: 6 }} />
                </AreaChart>
            </ResponsiveContainer>
        </ChartSurface>
    );
});

export const DailyCreationTrendChart = memo(({ data = [], height = 300 }) => {
    const compactChart = useCompactChart();
    const interval = compactChart ? getXAxisInterval(data.length) : 'preserveStartEnd';
    const xAxisProps = compactChart
        ? { height: 68, interval, tickMargin: 12, tick: <CompactXAxisTick maxLength={10} /> }
        : { height: 35, tick: { fill: CHART_THEME.axis, fontSize: 12 }, interval: 'preserveStartEnd' };

    return (
        <ChartSurface height={height}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: compactChart ? 34 : 24 }} maxBarSize={38}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} {...xAxisProps} />
                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                    <TrendChartTooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
                    <Bar dataKey="created" fill={CHART_COLORS.neutralPrimary} radius={[8, 8, 0, 0]} name="New Incidents">
                        <LabelList dataKey="created" position="top" fill={CHART_THEME.label} fontSize={12} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartSurface>
    );
});
