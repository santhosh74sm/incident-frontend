import React, { memo, useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Table } from 'lucide-react';
import { Tooltip } from 'recharts';

const TONE_STYLES = {
    slate: {
        icon: 'bg-slate-100 text-slate-600',
        accent: 'text-slate-700',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    blue: {
        icon: 'bg-blue-50 text-blue-600',
        accent: 'text-blue-700',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    amber: {
        icon: 'bg-amber-50 text-amber-600',
        accent: 'text-amber-700',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    emerald: {
        icon: 'bg-emerald-50 text-emerald-600',
        accent: 'text-emerald-700',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    red: {
        icon: 'bg-red-50 text-red-600',
        accent: 'text-red-700',
        badge: 'bg-red-50 text-red-700 border-red-200',
    },
    cyan: {
        icon: 'bg-cyan-50 text-cyan-600',
        accent: 'text-cyan-700',
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },
};

const getTone = (tone = 'blue') => TONE_STYLES[tone] || TONE_STYLES.blue;

export const CHART_THEME = {
    grid: 'var(--chart-grid)',
    axis: 'var(--chart-axis)',
    axisStrong: 'var(--chart-axis-strong)',
    label: 'var(--chart-label)',
};

const ChartTooltipContent = ({ active, payload, label, labelFormatter, valueFormatter }) => {
    if (!active || !payload || payload.length === 0) return null;

    const formattedLabel = labelFormatter
        ? labelFormatter(label, payload)
        : label || payload[0]?.payload?.fullDate || payload[0]?.payload?.name || payload[0]?.name || 'Details';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {formattedLabel}
            </p>
            <div className="space-y-1.5">
                {payload.map((entry) => (
                    <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                            <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {valueFormatter
                                ? valueFormatter(entry.value, entry.name, entry.payload)
                                : typeof entry.value === 'number'
                                    ? entry.value.toLocaleString('en-US')
                                    : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const ChartTooltip = ({ labelFormatter, valueFormatter, cursor = false }) => (
    <Tooltip
        cursor={cursor}
        content={<ChartTooltipContent labelFormatter={labelFormatter} valueFormatter={valueFormatter} />}
    />
);

export const truncateChartLabel = (value, maxLength = 14) => {
    const label = value === null || value === undefined ? '' : String(value);
    return label.length > maxLength ? `${label.slice(0, Math.max(maxLength - 1, 1))}...` : label;
};

export const CompactXAxisTick = ({ x, y, payload, maxLength = 14 }) => {
    const label = payload?.value === null || payload?.value === undefined ? '' : String(payload.value);

    return (
        <g transform={`translate(${x},${y})`}>
            <title>{label}</title>
            <text
                x={0}
                y={0}
                dy={12}
                textAnchor="end"
                transform="rotate(-35)"
                fill={CHART_THEME.axis}
                fontSize={11}
            >
                {truncateChartLabel(label, maxLength)}
            </text>
        </g>
    );
};

export const CompactYAxisTick = ({ x, y, payload, maxLength = 16 }) => {
    const label = payload?.value === null || payload?.value === undefined ? '' : String(payload.value);

    return (
        <g transform={`translate(${x},${y})`}>
            <title>{label}</title>
            <text x={0} y={0} dy={4} textAnchor="end" fill={CHART_THEME.axisStrong} fontSize={11}>
                {truncateChartLabel(label, maxLength)}
            </text>
        </g>
    );
};

export const useCompactChart = () => {
    const getMatches = () => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 900px)').matches;
    };
    const [matches, setMatches] = useState(getMatches);

    useLayoutEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mediaQuery = window.matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 900px)');
        const handleChange = () => setMatches(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener?.('change', handleChange);
        return () => mediaQuery.removeEventListener?.('change', handleChange);
    }, []);

    return matches;
};

export const ChartSurface = memo(({ height = 400, className = '', children }) => {
    const surfaceRef = useRef(null);
    const [hasValidSize, setHasValidSize] = useState(false);
    const safeHeight = Math.max(Number(height) || 0, 300);

    useLayoutEffect(() => {
        const node = surfaceRef.current;
        if (!node) return undefined;

        const updateSize = () => {
            const { width, height: measuredHeight } = node.getBoundingClientRect();
            setHasValidSize(width > 0 && measuredHeight > 0);
        };

        updateSize();
        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
        resizeObserver?.observe(node);
        window.addEventListener('orientationchange', updateSize);
        window.addEventListener('resize', updateSize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('orientationchange', updateSize);
            window.removeEventListener('resize', updateSize);
        };
    }, []);

    return (
        <div
            ref={surfaceRef}
            className={`relative w-full min-w-0 overflow-visible ${className}`}
            style={{ height: `${safeHeight}px`, minHeight: '300px', minWidth: '1px' }}
        >
            {hasValidSize ? (
                <div className="h-full w-full min-w-[1px]">
                    {children}
                </div>
            ) : null}
        </div>
    );
});

export const DashboardHero = ({ eyebrow, title, description, icon: Icon, actions = null, meta = null }) => (
    <section className="dashboard-hero">
        <div className="dashboard-hero-band">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                    {Icon ? (
                        <div className="w-fit rounded-2xl border border-white/20 bg-white/10 p-3 text-white shadow-lg shadow-slate-950/10">
                            <Icon size={22} />
                        </div>
                    ) : null}
                    <div className="min-w-0 space-y-3">
                        {eyebrow ? (
                            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100">
                                {eyebrow}
                            </span>
                        ) : null}
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90">{description}</p>
                        </div>
                    </div>
                </div>
                {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
            </div>
        </div>
        {meta ? <div className="border-t border-slate-200 bg-white px-6 py-4 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">{meta}</div> : null}
    </section>
);

export const DashboardStatCard = ({ title, value, icon: Icon, tone = 'blue', helper = null, footer = null }) => {
    const currentTone = getTone(tone);

    return (
        <div className="dashboard-stat-card">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="dashboard-kicker">{title}</p>
                    <p className="dashboard-stat-value">{value}</p>
                    {helper ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p> : null}
                </div>
                {Icon ? (
                    <div className={`shrink-0 rounded-2xl p-3 ${currentTone.icon}`}>
                        <Icon size={22} />
                    </div>
                ) : null}
            </div>
            {footer ? <div className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{footer}</div> : null}
        </div>
    );
};

export const DashboardPanel = ({ title, description, icon: Icon, actions = null, className = '', bodyClassName = '', children }) => (
    <section className={`dashboard-panel ${className}`}>
        {(title || actions || description) && (
            <div className="dashboard-panel-header">
                <div className="flex min-w-0 items-start gap-3">
                    {Icon ? (
                        <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Icon size={18} />
                        </div>
                    ) : null}
                    <div className="min-w-0">
                        {title ? <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h3> : null}
                        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
                    </div>
                </div>
                {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">{actions}</div> : null}
            </div>
        )}
        <div className={`dashboard-panel-body ${bodyClassName}`}>{children}</div>
    </section>
);

export const DashboardWidgetPanel = ({
    title,
    description,
    icon,
    actions = null,
    className = '',
    bodyClassName = '',
    chart = null,
    footer = null,
    tableColumns = [],
    tableRows = [],
    emptyMessage = 'No data available.',
    defaultTableView = false,
}) => {
    const [tableView, setTableView] = useState(defaultTableView);
    const hasTable = tableColumns.length > 0;

    const panelActions = hasTable ? (
        <div className="flex flex-wrap gap-2">
            {actions}
            <TableToggleButton expanded={tableView} onClick={() => setTableView((current) => !current)} />
        </div>
    ) : actions;

    return (
        <DashboardPanel
            title={title}
            description={description}
            icon={icon}
            actions={panelActions}
            className={className}
            bodyClassName={bodyClassName}
        >
            {tableView ? (
                <AnalyticsDataTable columns={tableColumns} rows={tableRows} emptyMessage={emptyMessage} />
            ) : (
                <>
                    {chart}
                    {footer}
                </>
            )}
        </DashboardPanel>
    );
};

export const LegendList = ({ items = [] }) => (
    <div className="flex flex-wrap gap-2 pt-4">
        {items.map((item) => (
            <div
                key={item.label}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
                {item.value !== undefined ? <span className="font-semibold text-slate-800 dark:text-slate-100">{item.value}</span> : null}
            </div>
        ))}
    </div>
);

export const TableToggleButton = ({ expanded, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={expanded}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-300 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
    >
        {expanded ? <EyeOff size={14} /> : <Table size={14} />}
        {expanded ? 'Hide Table' : 'View Table'}
    </button>
);

const getCellContent = (row, column, index) => {
    const value = column.render ? column.render(row, index) : row?.[column.key];
    return value === null || value === undefined || value === '' ? 'Not available' : value;
};

export const AnalyticsDataTable = ({ columns = [], rows = [], emptyMessage = 'No data available.' }) => {
    const safeColumns = Array.isArray(columns) ? columns : [];
    const safeRows = Array.isArray(rows) ? rows : [];

    return (
        <div className="analytics-table-shell">
            <div className="hidden overflow-x-auto md:block">
                <table className="analytics-table">
                    <thead className="analytics-table-head">
                        <tr>
                            {safeColumns.map((column) => (
                                <th key={column.key || column.label} className="analytics-table-th">
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {safeRows.length === 0 ? (
                            <tr>
                                <td className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={safeColumns.length || 1}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            safeRows.map((row, index) => (
                                <tr key={row?.id || row?._id || `${index}`} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/70">
                                    {safeColumns.map((column) => (
                                        <td
                                            key={column.key || column.label}
                                            className={`analytics-table-td ${column.className || ''}`}
                                        >
                                            {getCellContent(row, column, index)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
                {safeRows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        {emptyMessage}
                    </div>
                ) : (
                    safeRows.map((row, rowIndex) => (
                        <article
                            key={row?.id || row?._id || `${rowIndex}`}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            {safeColumns.map((column, columnIndex) => (
                                <div
                                    key={column.key || column.label}
                                    className={`grid grid-cols-[minmax(0,1fr)_minmax(5rem,auto)] items-start gap-5 px-4 py-3 ${
                                        columnIndex % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-900/60'
                                    } ${columnIndex + 1 === safeColumns.length ? '' : 'border-b border-slate-100 dark:border-slate-800'}`}
                                >
                                    <span className="min-w-0 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                        {column.label}
                                    </span>
                                    <div className="min-w-0 justify-self-end text-right text-sm font-semibold text-slate-800 dark:text-slate-100 [&>*]:ml-auto">
                                        {getCellContent(row, column, rowIndex)}
                                    </div>
                                </div>
                            ))}
                        </article>
                    ))
                )}
            </div>
        </div>
    );
};

export const EmptyStatePanel = ({ title, description, action = null }) => (
    <div className="analytics-empty">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Eye size={22} className="text-slate-400 dark:text-slate-300" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
    </div>
);

export const DashboardPageSkeleton = ({ showHero = true }) => (
    <div className="space-y-6">
        {showHero ? (
            <div className="dashboard-panel overflow-hidden">
                <div className="h-40 w-full bg-slate-200 skeleton-shimmer" />
            </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={`stat-${index}`} className="dashboard-stat-card">
                    <div className="skeleton-shimmer h-3 w-24 rounded-full bg-slate-200" />
                    <div className="mt-4 skeleton-shimmer h-10 w-20 rounded-xl bg-slate-200" />
                    <div className="mt-3 skeleton-shimmer h-3 w-32 rounded-full bg-slate-200" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={`panel-${index}`} className="dashboard-panel xl:col-span-6">
                    <div className="dashboard-panel-header">
                        <div className="space-y-3">
                            <div className="skeleton-shimmer h-4 w-32 rounded-full bg-slate-200" />
                            <div className="skeleton-shimmer h-3 w-48 rounded-full bg-slate-200" />
                        </div>
                    </div>
                    <div className="dashboard-panel-body">
                        <div className="skeleton-shimmer h-72 w-full rounded-2xl bg-slate-200" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const CategoryHeatmap = ({ rows = [], columns = [] }) => {
    const maxValue = rows.reduce((max, row) => {
        return Math.max(
            max,
            ...columns.map((column) => Number(row[column.key] || 0))
        );
    }, 0);

    if (rows.length === 0 || columns.length === 0) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">No category activity matches the current filters.</p>;
    }

    return (
        <div className="space-y-3">
            <div className="-mx-1 max-w-full overflow-x-auto overscroll-x-contain px-1 pb-1 [-webkit-overflow-scrolling:touch]">
                <div className="inline-block min-w-[480px] max-w-none md:min-w-0 md:max-w-full">
                    <div className={`grid gap-3`} style={{ gridTemplateColumns: `minmax(120px, 1.2fr) repeat(${columns.length}, minmax(72px, 1fr))` }}>
                        <div />
                        {columns.map((column) => (
                            <div key={column.key} className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                {column.label}
                            </div>
                        ))}
                        {rows.map((row) => (
                            <React.Fragment key={row.label}>
                                <div className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-200">{row.label}</div>
                                {columns.map((column) => {
                                    const value = Number(row[column.key] || 0);
                                    const intensity = maxValue > 0 ? value / maxValue : 0;
                                    const opacity = 0.12 + intensity * 0.7;
                                    return (
                                        <div
                                            key={`${row.label}-${column.key}`}
                                            className="analytics-heat-cell"
                                            style={{
                                                backgroundColor: `rgba(${column.rgb}, ${opacity})`,
                                                color: `rgb(${column.rgb})`,
                                            }}
                                            title={`${row.label} — ${column.label}: ${value}`}
                                        >
                                            {value}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ActivityFeed = ({ items = [], emptyMessage = 'No recent activity.' }) => {
    if (items.length === 0) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>;
    }

    return (
        <div className="space-y-3">
            {items.map((item) => {
                const tone = getTone(item.tone || 'slate');
                const Icon = item.icon;

                return (
                    <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className={`mt-0.5 rounded-xl p-2 ${tone.icon}`}>
                            {Icon ? <Icon size={16} /> : <Eye size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.timestamp}</span>
                            </div>
                            {item.description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p> : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
