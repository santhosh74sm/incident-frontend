import React, { memo } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
import { CHART_THEME, ChartSurface, ChartTooltip } from './DashboardPrimitives';
import { CHART_COLORS, STATUS_COLORS } from '../../utils/analytics';

export const IncidentStatusTrendChart = memo(({ data = [], height = 320, idPrefix = 'status-trend' }) => (
    <ChartSurface height={height}>
        {/* Wrapper div ensures ResponsiveContainer always receives a positive, finite parent size */}
        <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`${idPrefix}-open`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS.Open} stopOpacity={0.18} />
                            <stop offset="95%" stopColor={STATUS_COLORS.Open} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`${idPrefix}-progress`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS['In Progress']} stopOpacity={0.16} />
                            <stop offset="95%" stopColor={STATUS_COLORS['In Progress']} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`${idPrefix}-closed`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS.Closed} stopOpacity={0.16} />
                            <stop offset="95%" stopColor={STATUS_COLORS.Closed} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip
                        cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || 'Timeline Date'}
                    />
                    <Area type="monotone" dataKey="open" stroke={STATUS_COLORS.Open} fill={`url(#${idPrefix}-open)`} strokeWidth={3} name="Open" activeDot={{ r: 6 }} />
                    <Area type="monotone" dataKey="inProgress" stroke={STATUS_COLORS['In Progress']} fill={`url(#${idPrefix}-progress)`} strokeWidth={3} name="In Progress" activeDot={{ r: 6 }} />
                    <Area type="monotone" dataKey="closed" stroke={STATUS_COLORS.Closed} fill={`url(#${idPrefix}-closed)`} strokeWidth={3} name="Closed" activeDot={{ r: 6 }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </ChartSurface>
));

export const DailyCreationTrendChart = memo(({ data = [], height = 300 }) => (
    <ChartSurface height={height}>
        <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} maxBarSize={38}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || 'Timeline Date'}
                    />
                    <Bar dataKey="created" fill={CHART_COLORS.neutralPrimary} radius={[8, 8, 0, 0]} name="New Incidents">
                        <LabelList dataKey="created" position="top" fill={CHART_THEME.label} fontSize={12} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    </ChartSurface>
));
