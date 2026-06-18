import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, Filter, RefreshCw, Search, X } from 'lucide-react';

// ─── Normalise option shapes ───────────────────────────────────────────────────

const normalizeOptions = (options = []) =>
    options.map((option) =>
        typeof option === 'string'
            ? { id: option, label: option }
            : {
                  id   : option?.id ?? option?.value ?? option?.name,
                  label: option?.label ?? option?.name ?? String(option?.id ?? ''),
              }
    );

// ─── Shared style tokens ───────────────────────────────────────────────────────

const labelClassName =
    'mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400';

const fieldClassName =
    'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm shadow-slate-200/40 transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';

// ─── Portal dropdown positioning ──────────────────────────────────────────────

const buildDropdownLayout = (triggerElement) => {
    if (!triggerElement) return null;

    const rect           = triggerElement.getBoundingClientRect();
    const viewportPadding = 12;
    const maxWidth        = Math.max(240, window.innerWidth - viewportPadding * 2);
    const width           = Math.min(rect.width, maxWidth);
    const spaceBelow      = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove      = rect.top - viewportPadding;
    const openAbove       = spaceBelow < 260 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(220, Math.min(openAbove ? spaceAbove - 8 : spaceBelow - 8, 420));
    const left            = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    );

    return {
        panelStyle: openAbove
            ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 6}px`, width: `${width}px` }
            : { left: `${left}px`, top: `${rect.bottom + 6}px`, width: `${width}px` },
        listMaxHeight: Math.max(120, availableHeight - 132),
    };
};

const getButtonLabel = (selected, normalizedOptions, placeholder) => {
    if (!selected.length) return placeholder;
    if (selected.length === 1) {
        const match = normalizedOptions.find((option) => option.id === selected[0]);
        return match?.label || String(selected[0]);
    }
    return `${selected.length} selected`;
};

// ─── FilterDropdown ────────────────────────────────────────────────────────────

export const FilterDropdown = ({
    label,
    options,
    selected,
    onChange,
    placeholder,
    searchable        = true,
    searchPlaceholder = 'Search options…',
    clearLabel        = 'Clear',
}) => {
    const fieldId   = useId();
    const listboxId = useId();
    const [isOpen, setIsOpen]               = useState(false);
    const [query, setQuery]                 = useState('');
    const [portalReady, setPortalReady]     = useState(false);
    const [dropdownLayout, setDropdownLayout] = useState(null);
    const triggerRef = useRef(null);
    const menuRef    = useRef(null);

    const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
    const filteredOptions   = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return normalizedOptions;
        return normalizedOptions.filter((option) => option.label.toLowerCase().includes(q));
    }, [normalizedOptions, query]);

    const selectedLabel = useMemo(
        () => getButtonLabel(selected, normalizedOptions, placeholder),
        [normalizedOptions, placeholder, selected]
    );

    const syncDropdownLayout = useCallback(() => {
        if (!triggerRef.current) return;
        setDropdownLayout(buildDropdownLayout(triggerRef.current));
    }, []);

    useEffect(() => {
        setPortalReady(typeof document !== 'undefined');
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;

        syncDropdownLayout();

        const handleOutsideClick = (event) => {
            if (
                triggerRef.current?.contains(event.target) ||
                menuRef.current?.contains(event.target)
            ) return;
            setIsOpen(false);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        const handleViewportChange = () => syncDropdownLayout();

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [isOpen, syncDropdownLayout]);

    const allSelected      = normalizedOptions.length > 0 && selected.length === normalizedOptions.length;
    const someSelected     = selected.length > 0 && selected.length < normalizedOptions.length;
    const hasActiveSelection = selected.length > 0;

    const handleClear = () => {
        onChange([]);
        setQuery('');
    };

    const selectionSummary = selected.length === 0
        ? 'None selected'
        : `${selected.length} item${selected.length === 1 ? '' : 's'} selected`;

    const dropdownContent =
        isOpen && portalReady && dropdownLayout
            ? createPortal(
                <div
                    ref={menuRef}
                    id={listboxId}
                    role="listbox"
                    aria-label={label}
                    aria-multiselectable="true"
                    className="fixed z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/60"
                    style={dropdownLayout.panelStyle}
                >
                    {/* Panel header */}
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {label}
                                </p>
                                <p
                                    className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                                    aria-live="polite"
                                    aria-atomic="true"
                                >
                                    {selectionSummary}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={!hasActiveSelection}
                                className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden />
                                {clearLabel}
                            </button>
                        </div>

                        {searchable ? (
                            <div className="mt-3">
                                <UnifiedSearchInput
                                    label=""
                                    value={query}
                                    onChange={setQuery}
                                    placeholder={searchPlaceholder}
                                    hideLabel
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* Select All */}
                    <div className="border-b border-slate-100 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(input) => {
                                    if (input) input.indeterminate = someSelected;
                                }}
                                onChange={(event) =>
                                    onChange(event.target.checked ? normalizedOptions.map((o) => o.id) : [])
                                }
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950"
                            />
                            <span>Select All</span>
                        </label>
                    </div>

                    {/* Option list */}
                    <div
                        className="custom-scrollbar overflow-y-auto px-2 py-2"
                        style={{ maxHeight: `${dropdownLayout.listMaxHeight}px` }}
                    >
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-6 text-center">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    No matching options
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Try a different keyword.
                                </p>
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <label
                                    key={option.id}
                                    role="option"
                                    aria-selected={selected.includes(option.id)}
                                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition-colors duration-150 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(option.id)}
                                        onChange={() => {
                                            const next = selected.includes(option.id)
                                                ? selected.filter((item) => item !== option.id)
                                                : [...selected, option.id];
                                            onChange(next);
                                        }}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950"
                                    />
                                    <span className="min-w-0 flex-1 truncate" title={option.label}>
                                        {option.label}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )
            : null;

    return (
        <div className="relative min-w-0">
            <label htmlFor={fieldId} className={labelClassName}>
                {label}
            </label>

            <button
                id={fieldId}
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-controls={isOpen ? listboxId : undefined}
                className={`${fieldClassName} flex items-center justify-between gap-3 ${
                    hasActiveSelection
                        ? 'border-blue-300 bg-blue-50/80 text-blue-700 shadow-md shadow-blue-100/60 dark:border-blue-500/50 dark:bg-blue-950/40 dark:text-blue-200 dark:shadow-none'
                        : ''
                }`}
            >
                <span
                    className={`truncate text-left ${
                        selected.length === 0 ? 'text-slate-400 dark:text-slate-500' : ''
                    }`}
                >
                    {selectedLabel}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                    {hasActiveSelection ? (
                        <span
                            aria-hidden
                            className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                        >
                            {selected.length}
                        </span>
                    ) : null}
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                    />
                </div>
            </button>

            {dropdownContent}
        </div>
    );
};

// Re-export alias for backward compatibility
export const UnifiedMultiSelect = FilterDropdown;

// ─── UnifiedDateInput ─────────────────────────────────────────────────────────

export const UnifiedDateInput = ({ label, value, onChange }) => {
    const fieldId = useId();

    return (
        <div className="min-w-0">
            <label htmlFor={fieldId} className={labelClassName}>
                {label}
            </label>
            <div className="relative">
                <Calendar
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                />
                <input
                    id={fieldId}
                    type="date"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className={`${fieldClassName} pl-10`}
                />
            </div>
        </div>
    );
};

// ─── UnifiedSearchInput ───────────────────────────────────────────────────────

export const UnifiedSearchInput = ({
    label,
    value,
    onChange,
    placeholder = 'Search…',
    hideLabel   = false,
}) => {
    const fieldId = useId();

    return (
        <div className="min-w-0">
            {!hideLabel && label ? (
                <label htmlFor={fieldId} className={labelClassName}>
                    {label}
                </label>
            ) : null}
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                />
                <input
                    id={fieldId}
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    aria-label={hideLabel ? placeholder : undefined}
                    className={`${fieldClassName} pl-10`}
                />
            </div>
        </div>
    );
};

// ─── UnifiedFilterBar ─────────────────────────────────────────────────────────

export const UnifiedFilterBar = ({
    title = 'Filters',
    hasActiveFilters,
    onReset,
    children,
    actions = null,
    activeFilterLabels = [],
    collapsible = false,
    defaultCollapsed = false,
}) => {
    const panelId = useId();
    const [isCollapsed, setIsCollapsed] = useState(collapsible && defaultCollapsed);
    const showFields = !collapsible || !isCollapsed;

    return (
        <div className="overflow-visible rounded-[28px] border border-white/70 bg-white/90 shadow-md shadow-slate-200/70 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50">
            {/* Bar header */}
            <div className={`flex flex-col gap-3 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between ${showFields ? 'border-b border-slate-100' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-2.5 text-blue-600 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                        <Filter className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                            {title}
                        </h3>
                        {hasActiveFilters ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300">
                                Active
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Actions + Reset */}
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    {actions}
                    {collapsible ? (
                        <button
                            type="button"
                            onClick={() => setIsCollapsed((current) => !current)}
                            aria-expanded={showFields}
                            aria-controls={panelId}
                            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50 sm:w-auto"
                        >
                            <Filter className="h-3.5 w-3.5" aria-hidden />
                            {showFields ? 'Hide Filters' : 'Show Filters'}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onReset}
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 sm:w-auto"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        Reset Filters
                    </button>
                </div>
            </div>

            {/* Filter fields */}
            {showFields ? (
                <div id={panelId} className="min-w-0 p-5">
                    {activeFilterLabels.length > 0 ? (
                        <div className="mb-4 flex flex-wrap gap-2" aria-label="Active filters">
                            {activeFilterLabels.slice(0, 10).map((label) => (
                                <span
                                    key={label}
                                    className="inline-flex min-h-[32px] items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200"
                                >
                                    {label}
                                </span>
                            ))}
                            {activeFilterLabels.length > 10 ? (
                                <span className="inline-flex min-h-[32px] items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    +{activeFilterLabels.length - 10} more
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                    {children}
                </div>
            ) : null}
        </div>
    );
};
