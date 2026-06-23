import React, { useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../config/apiClient';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Command,
    FileText,
    LayoutDashboard,
    List,
    Loader2,
    Mail,
    PlusCircle,
    Search,
    User,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRecordId } from '../utils/ids';
import { normalizeRole } from '../utils/roles';

// ─── Static maps ──────────────────────────────────────────────────────────────

const typeIconMap = {
    student : User,
    incident: AlertTriangle,
    letter  : FileText,
    command : Command,
};

const commandIconByTitle = {
    'Go to Dashboard'          : LayoutDashboard,
    'Create Incident'          : PlusCircle,
    'View Incident List'       : List,
    'School Analytics'         : BarChart3,
    'Student Analytics'        : User,
    'View Issued Letters'      : Mail,
};

const commandSections = [
    { key: 'student',  label: 'Students' },
    { key: 'incident', label: 'Incidents' },
    { key: 'letter',   label: 'Letters' },
    { key: 'command',  label: 'Quick Actions' },
];

const quickActionItems = [
    {
        title: 'Go to Dashboard',
        sub  : 'Open the school overview.',
        link : '/dashboard',
        type : 'command',
        roles: ['Super Admin', 'Admin', 'Teacher'],
    },
    {
        title: 'Create Incident',
        sub  : 'Start a new incident record.',
        link : '/create-incident',
        type : 'command',
        roles: ['Admin', 'Teacher'],
    },
    {
        title: 'View Incident List',
        sub  : 'Review active and past incidents.',
        link : '/incidents',
        type : 'command',
        roles: ['Super Admin', 'Admin', 'Teacher'],
    },
    {
        title: 'School Analytics',
        sub  : 'Open charts and summaries for the whole school.',
        link : '/analytics',
        type : 'command',
        roles: ['Super Admin', 'Admin', 'Teacher'],
    },
    {
        title: 'Student Analytics',
        sub  : 'Look up one student\'s involvement and history.',
        link : '/student-analytics',
        type : 'command',
        roles: ['Super Admin', 'Admin', 'Teacher'],
    },
    {
        title: 'View Issued Letters',
        sub  : 'See letters produced from incidents.',
        link : '/issued-letters',
        type : 'command',
        roles: ['Super Admin', 'Admin', 'Teacher'],
    },
];

// ─── CommandPalette ───────────────────────────────────────────────────────────

const CommandPalette = () => {
    const { user }   = useAuth();
    const navigate   = useNavigate();
    const [isOpen, setIsOpen]       = useState(false);
    const [query, setQuery]         = useState('');
    const [results, setResults]     = useState([]);
    const [loading, setLoading]     = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef  = useRef(null);
    const listboxId = 'command-palette-results';

    const closePalette = () => {
        setIsOpen(false);
        setQuery('');
        setResults([]);
        setActiveIndex(0);
    };

    // ── Global keyboard toggle ─────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyboardToggle = (event) => {
            const isK = event.key?.toLowerCase() === 'k';
            if ((event.ctrlKey || event.metaKey) && isK) {
                event.preventDefault();
                setIsOpen((current) => !current);
            }
        };

        const handleOpenEvent = () => setIsOpen(true);

        window.addEventListener('keydown', handleKeyboardToggle);
        window.addEventListener('open-command-palette', handleOpenEvent);

        return () => {
            window.removeEventListener('keydown', handleKeyboardToggle);
            window.removeEventListener('open-command-palette', handleOpenEvent);
        };
    }, []);

    // ── Auto-focus input when opened ───────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return undefined;
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, [isOpen]);

    // ── Search (logic unchanged) ───────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen || !getRecordId(user)) return undefined;

        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            setLoading(false);
            setResults([]);
            setActiveIndex(0);
            return undefined;
        }

        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await apiClient.get('/api/search/global', {
                    params: { query: trimmedQuery },
                    headers: {},
                    signal: controller.signal,
                });
                setResults(response.data?.results || []);
                setActiveIndex(0);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [isOpen, query, user]);

    // ── Quick actions (filtered by role) ──────────────────────────────────────
    const normalizedRole = normalizeRole(user?.role);
    const quickActions = useMemo(
        () => quickActionItems.filter((item) => item.roles.includes(normalizedRole)),
        [normalizedRole]
    );

    const groupedResults = useMemo(() => {
        const buckets = { student: [], incident: [], letter: [], command: [] };
        (results || []).forEach((item) => {
            const key = item?.type || 'command';
            if (buckets[key]) buckets[key].push(item);
        });
        return buckets;
    }, [results]);

    const visibleSections = useMemo(() => {
        if (!query.trim()) {
            return quickActions.length
                ? [{ key: 'quick-actions', label: 'Quick Actions', items: quickActions }]
                : [];
        }
        return commandSections
            .map((section) => ({ ...section, items: groupedResults?.[section.key] || [] }))
            .filter((section) => section.items.length > 0);
    }, [groupedResults, query, quickActions]);

    const visibleItems = useMemo(
        () => visibleSections.flatMap((section) => section.items),
        [visibleSections]
    );

    // ── Arrow / Enter / Escape navigation ─────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePaletteKeys = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePalette();
                return;
            }
            if (!visibleItems.length) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % visibleItems.length);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + visibleItems.length) % visibleItems.length);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const selected = visibleItems[activeIndex];
                if (selected?.link) {
                    navigate(selected.link);
                    closePalette();
                }
            }
        };

        window.addEventListener('keydown', handlePaletteKeys);
        return () => window.removeEventListener('keydown', handlePaletteKeys);
    }, [activeIndex, isOpen, navigate, visibleItems]);

    if (!isOpen) return null;

    return (
                <div
                    className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/48 p-3 backdrop-blur-sm sm:p-4"
                    style={{ animation: 'commandPaletteFade 150ms ease-out' }}
                    onClick={closePalette}
                    aria-label="Command palette backdrop"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Command palette"
                        className="my-4 w-full max-w-3xl overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_36px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:my-8 sm:rounded-[30px]"
                        style={{ animation: 'commandPalettePanel 180ms ease-out' }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {/* ── Search header ─────────────────────────────────── */}
                        <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_65%)] px-5 py-4 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-800">
                                    <Command size={18} aria-hidden />
                                </div>

                                <div className="relative min-w-0 flex-1">
                                    <Search
                                        className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                        aria-hidden
                                    />
                                    <input
                                        ref={inputRef}
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Search students, incidents, letters, or jump to a page…"
                                        className="w-full border-none bg-transparent py-2 pl-7 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                                        role="combobox"
                                        aria-expanded={isOpen}
                                        aria-autocomplete="list"
                                        aria-controls={listboxId}
                                        aria-activedescendant={
                                            visibleItems[activeIndex]
                                                ? `cmd-item-${activeIndex}`
                                                : undefined
                                        }
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>

                                {/* ESC hint */}
                                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900 sm:flex">
                                    <kbd className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Esc
                                    </kbd>
                                </div>

                                <button
                                    type="button"
                                    onClick={closePalette}
                                    className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                    aria-label="Close search"
                                >
                                    <X size={18} aria-hidden />
                                </button>
                            </div>

                            {/* Keyboard hints */}
                            <div
                                className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
                                aria-hidden
                            >
                                <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
                                    ↑↓ Navigate
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
                                    ↵ Open
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
                                    Esc Close
                                </span>
                            </div>
                        </div>

                        {/* ── Results body ───────────────────────────────────── */}
                        <div
                            id={listboxId}
                            role="listbox"
                            aria-label="Search results"
                            className="max-h-[68vh] overflow-y-auto px-4 py-4"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                        >
                            {/* Onboarding hint — shown when no query typed */}
                            {!query.trim() ? (
                                <div className="mb-4 rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Jump to Anything
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Type to search students, incidents, and letters — or pick a quick action below.
                                    </p>
                                </div>
                            ) : null}

                            {/* Loading state */}
                            {loading ? (
                                <div
                                    aria-live="polite"
                                    aria-label="Searching…"
                                    className="flex items-center justify-center gap-2 px-2 py-10 text-sm text-slate-500"
                                >
                                    <Loader2 size={16} className="animate-spin text-blue-500" aria-hidden />
                                    Searching…
                                </div>
                            ) : visibleItems.length === 0 ? (
                                /* Empty / no-result state */
                                <div
                                    aria-live="polite"
                                    className="px-2 py-10 text-center"
                                >
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                        <Search size={18} aria-hidden />
                                    </div>
                                    {query.trim() ? (
                                        <>
                                            <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                No results for "{query.trim()}".
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Try a different keyword, or use a quick action below.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                No quick actions available.
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Start typing to search the workspace.
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                /* Result sections */
                                visibleSections.map((section) => (
                                    <div key={section.key} className="mb-4 last:mb-0">
                                        <p
                                            className="px-2 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400"
                                            aria-hidden
                                        >
                                            {section.label}
                                        </p>

                                        <div className="mt-1.5 space-y-1.5">
                                            {section.items.map((item) => {
                                                const index      = visibleItems.findIndex((entry) => entry === item);
                                                const BaseIcon   = typeIconMap[item?.type] || Command;
                                                const CommandIcon = item?.type === 'command' ? commandIconByTitle[item?.title] : null;
                                                const ResultIcon  = CommandIcon || BaseIcon;
                                                const isActive    = index === activeIndex;

                                                return (
                                                    <button
                                                        key={`${item?.type}-${item?.title}-${item?.sub}-${index}`}
                                                        id={`cmd-item-${index}`}
                                                        role="option"
                                                        aria-selected={isActive}
                                                        type="button"
                                                        onMouseEnter={() => setActiveIndex(index)}
                                                        onClick={() => {
                                                            if (item?.link) {
                                                                navigate(item.link);
                                                                closePalette();
                                                            }
                                                        }}
                                                        className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition-all duration-150 ${
                                                            isActive
                                                                ? 'border-indigo-200 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-950/40'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${
                                                                isActive
                                                                    ? 'bg-indigo-500 text-white'
                                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}
                                                            aria-hidden
                                                        >
                                                            <ResultIcon size={15} />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                                {item?.title || 'Untitled'}
                                                            </p>
                                                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                                {item?.sub || 'Open this workspace item.'}
                                                            </p>
                                                        </div>

                                                        <ArrowRight
                                                            size={14}
                                                            className={`shrink-0 transition-colors duration-150 ${
                                                                isActive ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'
                                                            }`}
                                                            aria-hidden
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
    );
};

export default CommandPalette;
