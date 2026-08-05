import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../config/apiClient';
import mammoth from 'mammoth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { isSchoolUserRole } from '../utils/roles';
import { useMasterDataListener } from '../hooks/useMasterDataListener';
import { downloadBlob } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import { focusFirstInvalidField } from '../hooks/useFocusFirstInvalid';
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    Copy,
    Download,
    FileText,
    Globe2,
    Languages,
    LayoutGrid,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
    X,
} from 'lucide-react';


const DOCX_PREVIEW_STYLES = `
.doc-preview-container {
    color: #0f172a;
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.6;
}

.dark .doc-preview-container {
    color: #e5e7eb;
}

.doc-preview-container * {
    font-family: inherit !important;
    line-height: inherit !important;
}

.dark .doc-preview-container * {
    color: inherit !important;
}

.doc-preview-container .doc-placeholder-token {
    display: inline-block;
    border-radius: 6px;
    background: #eef2ff;
    color: #3730a3 !important;
    padding: 0 4px;
    font-weight: 700;
}

.dark .doc-preview-container .doc-placeholder-token {
    background: rgba(99, 102, 241, 0.24);
    color: #c7d2fe !important;
}

.doc-preview-container p {
    margin: 0 0 12pt;
    white-space: pre-wrap;
    word-break: break-word;
}

.doc-preview-container table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
}

.doc-preview-container td,
.doc-preview-container th {
    border: 1px solid #cbd5e1;
    padding: 8px;
}

.doc-preview-container img {
    max-width: 100%;
    height: auto;
}

.doc-preview-container ul,
.doc-preview-container ol {
    margin: 12pt 0 12pt 24pt;
}

.doc-preview-container h1,
.doc-preview-container h2,
.doc-preview-container h3,
.doc-preview-container h4 {
    margin: 14pt 0 10pt;
    font-weight: 700;
}

.doc-preview-container [align="center"],
.doc-preview-container [style*="text-align:center"],
.doc-preview-container [style*="text-align: center"] {
    text-align: center !important;
}

.doc-preview-container [align="right"],
.doc-preview-container [style*="text-align:right"],
.doc-preview-container [style*="text-align: right"] {
    text-align: right !important;
}
`;

const highlightPreviewPlaceholders = (html = '') => {
    if (typeof document === 'undefined' || !html) return html;

    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, window.NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
        const text = node.nodeValue || '';
        const matches = [...text.matchAll(/{{\s*[\w.]+\s*}}/g)];
        if (matches.length === 0) return;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach((match) => {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            const token = document.createElement('span');
            token.className = 'doc-placeholder-token';
            token.textContent = match[0];
            fragment.appendChild(token);
            lastIndex = match.index + match[0].length;
        });

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        node.parentNode?.replaceChild(fragment, node);
    });

    return template.innerHTML;
};

const LANGUAGE_META = {
    en: { label: 'English', short: 'EN' },
    ta: { label: 'Tamil', short: 'TA' },
};

const TAG_GROUPS = [
    {
        category: 'Student',
        items: [
            { tag: '{{studentName}}', description: 'Student Full Name' },
            { tag: '{{admissionNo}}', description: 'Admission Number' },
            { tag: '{{class}}', description: 'Class or Grade' },
            { tag: '{{section}}', description: 'Section' },
        ],
    },
    {
        category: 'Incident',
        items: [
            { tag: '{{incidentTitle}}', description: 'Incident Title' },
            { tag: '{{incidentDescription}}', description: 'Incident Description' },
            { tag: '{{location}}', description: 'Incident Location' },
            { tag: '{{date}}', description: 'Incident Date' },
        ],
    },
    {
        category: 'System',
        items: [
            { tag: '{{currentDate}}', description: 'Current Date' },
            { tag: '{{year}}', description: 'Current Year' },
        ],
    },
];

const buildTagGuideText = () =>
    [
        'Official Letter — Merge Fields Guide',
        '',
        'Copy these merge fields exactly into your Word (.docx) letter file.',
        'When you save an incident, the system fills them in automatically.',
        '',
        ...TAG_GROUPS.flatMap((group) => [
            `${group.category.toUpperCase()}`,
            ...group.items.map((item) => `${item.tag} - ${item.description}`),
            '',
        ]),
    ].join('\n');

const sanitizeFilename = (value = 'letter') =>
    String(value)
        .trim()
        .replace(/[^a-zA-Z0-9.-]/g, '_');

const formatDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getVariantMeta = (template, language) => {
    if (!template) {
        return {
            hasDocx: false,
            hasVersion: false,
            file: null,
        };
    }

    return language === 'ta'
        ? {
            hasDocx: Boolean(template.hasTamilDocx),
            hasVersion: Boolean(template.hasTamilVersion),
            file: template.tamilTemplateFile || null,
        }
        : {
            hasDocx: Boolean(template.hasEnglishDocx),
            hasVersion: Boolean(template.hasEnglishVersion),
            file: template.englishTemplateFile || null,
        };
};

const pickPreferredLanguage = (template) => {
    if (template?.hasEnglishDocx) return 'en';
    if (template?.hasTamilDocx) return 'ta';
    return 'en';
};

const MetricCard = ({ label, value, description, tone = 'slate' }) => {
    const tones = {
        slate: 'border-slate-200 bg-slate-50 text-slate-900 ',
        blue: 'border-blue-200 bg-blue-50 text-blue-900 ',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900 ',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 ',
    };

    return (
        <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">{label}</p>
            <p className="mt-3 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-slate-600 ">{description}</p>
        </div>
    );
};

const VariantBadge = ({ template, language }) => {
    const meta = getVariantMeta(template, language);
    const label = meta.hasDocx ? 'UPLOADED' : 'MISSING';
    const badgeClassName = meta.hasDocx
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 '
        : 'border-rose-200 bg-rose-50 text-rose-800 ';

    return (
        <div className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 ${badgeClassName}`}>
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{LANGUAGE_META[language].short}</p>
                <p className="mt-1 text-xs font-bold">{label}</p>
            </div>
            {meta.hasDocx ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
    );
};

const TemplateCard = ({ template, selected, onSelect }) => (
    <button
        type="button"
        onClick={() => onSelect(template)}
        aria-pressed={selected}
        className={`w-full rounded-3xl border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            selected
                ? 'border-indigo-300 bg-indigo-50 shadow-lg shadow-indigo-100/60 '
                : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md '
        }`}
    >
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Template</p>
                <h3 className="mt-2 truncate text-lg font-semibold text-slate-900 ">{template.title}</h3>
                <p className="mt-1 text-sm font-medium text-blue-700 ">{template.incidentCategory}</p>
            </div>
            <span
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 '
                }`}
            >
                {selected ? 'Active' : 'Ready'}
            </span>
        </div>

        <p className="mt-4 min-h-[2.75rem] text-sm leading-6 text-slate-600 ">
            {template.description || 'No short description has been added yet.'}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <VariantBadge template={template} language="en" />
            <VariantBadge template={template} language="ta" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500 ">
            <span>Updated {formatDate(template.updatedAt || template.createdAt)}</span>
            <span className="font-semibold text-slate-700 ">Open Workspace</span>
        </div>
    </button>
);

const WorkspaceActionButton = ({ icon: Icon, children, variant = 'secondary', ...props }) => {
    const variants = {
        primary: 'border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
        secondary: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400',
        danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-400',
    };

    return (
        <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${variants[variant] || variants.secondary} disabled:cursor-not-allowed disabled:opacity-60`}
            {...props}
        >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {children}
        </button>
    );
};

const PreviewPanel = ({
    template,
    language,
    previewState,
    onUpload,
    onRetry,
}) => {
    if (!template) {
        return (
            <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center ">
                <div className="max-w-md">
                    <LayoutGrid className="mx-auto h-12 w-12 text-slate-300" />
                    <h3 className="mt-5 text-xl font-semibold text-slate-900 ">Choose a Letter File</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500 ">
                        Pick a card on the left to see language coverage, upload a Word file for each language, and preview the letter.
                    </p>
                </div>
            </div>
        );
    }

    const variant = getVariantMeta(template, language);

    if (!variant.hasDocx) {
        return (
            <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center ">
                <div className="max-w-md">
                    <Languages className="mx-auto h-12 w-12 text-slate-300" />
                    <h3 className="mt-5 text-xl font-semibold text-slate-900 ">
                        {LANGUAGE_META[language].label} letter file is missing.
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500 ">
                        {variant.hasVersion
                            ? 'This language was set up earlier, but the file is missing right now. Upload a new Word (.docx) file to continue.'
                            : 'This language does not have a letter file yet. Upload a Word (.docx) file when you are ready.'}
                    </p>
                    <button
                        type="button"
                        onClick={onUpload}
                        className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-700 bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                        <Upload className="h-4 w-4" />
                        Upload {LANGUAGE_META[language].label} Word File
                    </button>
                </div>
            </div>
        );
    }

    if (previewState.loading) {
        return (
            <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8 ">
                <div className="text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-500" />
                    <p className="mt-4 text-sm font-medium text-slate-600 ">Preparing letter preview…</p>
                </div>
            </div>
        );
    }

    if (previewState.error) {
        return (
            <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center ">
                <div className="max-w-lg">
                    <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
                    <h3 className="mt-5 text-xl font-semibold text-rose-900 ">Preview Unavailable</h3>
                    <p className="mt-2 text-sm leading-6 text-rose-700 ">{previewState.error}</p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <WorkspaceActionButton icon={RefreshCw} onClick={onRetry}>
                        Try Again
                        </WorkspaceActionButton>
                        <WorkspaceActionButton icon={Upload} variant="primary" onClick={onUpload}>
                        Re-upload File
                        </WorkspaceActionButton>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] ">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 ">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Preview</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-900 ">
                            {template.title} - {LANGUAGE_META[language].label}
                        </h3>
                    </div>
                    {previewState.imageWarning ? (
                        <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ">
                            Letters with many images may look slightly different here than in Word.
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="bg-slate-100/80 p-4 lg:p-8">
                <div className="mx-auto min-h-[520px] max-w-[840px] rounded-[24px] border border-slate-200 bg-white px-6 py-8 shadow-sm lg:px-12">
                    <div
                        className="doc-preview-container"
                        dangerouslySetInnerHTML={{ __html: previewState.html }}
                    />
                </div>
            </div>
        </div>
    );
};

const DetailsCard = ({ template }) => {
    if (!template) return null;

    const englishVariant = getVariantMeta(template, 'en');
    const tamilVariant = getVariantMeta(template, 'ta');

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ">
            <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-2 text-blue-700 ">
                    <Globe2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 ">Letter File Details</h3>
                    <p className="text-sm text-slate-500 ">Information shown here matches what staff see when letters are created.</p>
                </div>
            </div>

            <dl className="mt-5 space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4 ">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Incident Category</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900 ">{template.incidentCategory}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Created</dt>
                    <dd className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700 ">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {formatDate(template.createdAt)}
                    </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">English File</dt>
                    <dd className="mt-2 text-sm text-slate-700 ">
                        {englishVariant.file?.originalName || 'Missing'}
                    </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Tamil File</dt>
                    <dd className="mt-2 text-sm text-slate-700 ">
                        {tamilVariant.file?.originalName || 'Missing'}
                    </dd>
                </div>
            </dl>
        </section>
    );
};

const PlaceholderLibrary = ({ onCopyAll, onDownloadGuide, onCopyTag }) => (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 ">
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 ">Available Template Fields</h3>
                        <p className="text-sm text-slate-500 ">Copy each field exactly as shown into your Word (.docx) file. The system fills them in when a letter is generated.</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <WorkspaceActionButton icon={Copy} onClick={onCopyAll}>
                            Copy All
                </WorkspaceActionButton>
                <WorkspaceActionButton icon={Download} onClick={onDownloadGuide}>
                            Download Guide
                </WorkspaceActionButton>
            </div>
        </div>

        <div className="mt-5 space-y-5">
            {TAG_GROUPS.map((group) => (
                <div key={group.category}>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">{group.category}</p>
                    <div className="mt-3 space-y-2">
                        {group.items.map((item) => (
                            <div
                                key={item.tag}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-mono text-sm font-semibold text-slate-900 ">{item.tag}</p>
                                    <p className="mt-1 text-sm text-slate-500 ">{item.description}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onCopyTag(item.tag)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 "
                                >
                                    <Copy className="h-4 w-4" />
                                    Copy
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </section>
);

const CreateTemplateModal = ({
    categories,
    creating,
    formState,
    onClose,
    onChange,
    onSubmit,
}) => (
    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
        <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 ">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 ">Add New Template</h2>
                    <p className="mt-1 text-sm text-slate-500 ">Enter the details below. You can upload Word files after creating the template.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 "
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-5 px-6 py-6">
                <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Template Title</span>
                <input
                type="text"
                aria-invalid={formState.error === 'Please enter a title.'}
                value={formState.title}
                onChange={(event) => onChange('title', event.target.value)}
                    placeholder="Enter template title"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 "
                    />
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Incident Category</span>
                    <select
                        aria-invalid={formState.error === 'Please choose an incident category.'}
                        value={formState.incidentCategory}
                        onChange={(event) => onChange('incidentCategory', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 "
                    >
                        <option value="">Select a category</option>
                        {categories.map((category) => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Description</span>
                    <textarea
                        rows={4}
                        value={formState.description}
                        onChange={(event) => onChange('description', event.target.value)}
                        placeholder="Optional notes for staff who manage this letter file."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 "
                    />
                </label>

                {formState.error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ">
                        {formState.error}
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 "
                >
                    Cancel
                </button>
                <button
                type="button"
                onClick={onSubmit}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-700 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                    Add Template
                </button>
            </div>
        </div>
    </div>
);

const UploadVariantModal = ({ template, language, uploading, onClose, onUpload }) => {
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [error, setError] = useState('');

    const handleFileSelection = (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.docx')) {
            setSelectedFile(null);
            setError('Only .docx files are supported.');
            return;
        }

        setError('');
        setSelectedFile(file);
    };

    return (
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
            <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 ">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 ">
                            Upload {LANGUAGE_META[language].label} Letter File
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 ">{template?.title}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 "
                        aria-label="Close upload dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-6">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
                            selectedFile
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 '
                                : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 '
                        }`}
                    >
                        <Upload className="h-10 w-10" />
                        <p className="mt-4 text-base font-semibold">
                            {selectedFile ? selectedFile.name : 'Choose a Word (.docx) file'}
                        </p>
                        <p className="mt-2 text-sm">
                            Click to browse and replace the current {LANGUAGE_META[language].label.toLowerCase()} document.
                        </p>
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx"
                        className="hidden"
                        onChange={(event) => handleFileSelection(event.target.files?.[0])}
                    />

                    {error ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ">
                            {error}
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 "
                    >
                        Cancel
                    </button>
                    <button
                    type="button"
                    onClick={() => onUpload(selectedFile)}
                    disabled={!selectedFile || uploading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-700 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                        Upload Word File
                    </button>
                </div>
            </div>
        </div>
    );
};

const ConfirmModal = ({ title, description, confirmLabel, busy, onClose, onConfirm }) => (
    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
        <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
            <div className="border-b border-slate-200 px-6 py-5 ">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700">
                        <Trash2 className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 ">{title}</h2>
                </div>
            </div>
            <div className="px-6 py-6">
                <p className="text-sm leading-6 text-slate-600 ">{description}</p>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 "
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-700 bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

const LetterTemplates = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [activeLanguage, setActiveLanguage] = useState('en');
    const [previewState, setPreviewState] = useState({
        loading: false,
        html: '',
        error: '',
        imageWarning: false,
    });
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [uploadState, setUploadState] = useState({ open: false, template: null, language: 'en' });
    const [confirmState, setConfirmState] = useState({ open: false, mode: '', template: null, language: 'en' });
    const [createForm, setCreateForm] = useState({
        title: '',
        incidentCategory: '',
        description: '',
        error: '',
    });
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloadingKey, setDownloadingKey] = useState('');
    const previewRequestRef = useRef(0);

    const config = useMemo(() => ({ headers: {} }), []);

    const fetchTemplates = useCallback(async (showLoader = true) => {
        if (!user?._id) return;

        try {
            if (showLoader) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const response = await apiClient.get('/api/letter-templates', config);
            setTemplates(response.data || []);
        } catch (error) {
            addToast(error.response?.data?.message || 'Could not load letter files.', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [addToast, config, user?._id]);

    const fetchCategories = useCallback(async () => {
        if (!user?._id) return;

        try {
            const response = await apiClient.get('/api/letter-templates/categories', config);
            setCategories(response.data || []);
        } catch (error) {
            addToast('Failed to load incident categories.', 'error');
        }
    }, [addToast, config, user?._id]);

    useEffect(() => {
        fetchTemplates();
        fetchCategories();
    }, [fetchCategories, fetchTemplates]);

    useMasterDataListener(useCallback(() => {
        fetchTemplates();
        fetchCategories();
    }, [fetchCategories, fetchTemplates]));

    const filteredTemplates = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return templates;

        return templates.filter((template) =>
            [template.title, template.incidentCategory, template.description]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(query))
        );
    }, [searchTerm, templates]);

    useEffect(() => {
        if (!templates.length) {
            setSelectedTemplateId('');
            return;
        }

        if (selectedTemplateId && templates.some((template) => template._id === selectedTemplateId)) {
            return;
        }

        const fallback = templates[0];
        setSelectedTemplateId(fallback._id);
        setActiveLanguage(pickPreferredLanguage(fallback));
    }, [selectedTemplateId, templates]);

    useEffect(() => {
        if (!filteredTemplates.length) return;
        if (filteredTemplates.some((template) => template._id === selectedTemplateId)) return;

        const fallback = filteredTemplates[0];
        setSelectedTemplateId(fallback._id);
        setActiveLanguage(pickPreferredLanguage(fallback));
    }, [filteredTemplates, selectedTemplateId]);

    const selectedTemplate = useMemo(
        () => templates.find((template) => template._id === selectedTemplateId) || null,
        [selectedTemplateId, templates]
    );

    const templateMetrics = useMemo(() => ({
        total: templates.length,
        fullyReady: templates.filter((template) => template.hasEnglishDocx && template.hasTamilDocx).length,
        englishReady: templates.filter((template) => template.hasEnglishDocx).length,
        tamilReady: templates.filter((template) => template.hasTamilDocx).length,
    }), [templates]);

    const loadPreview = useCallback(async (template, language) => {
        if (!template) {
            setPreviewState({
                loading: false,
                html: '',
                error: '',
                imageWarning: false,
            });
            return;
        }

        const variant = getVariantMeta(template, language);
        if (!variant.hasDocx) {
            setPreviewState({
                loading: false,
                html: '',
                error: '',
                imageWarning: false,
            });
            return;
        }

        const requestId = previewRequestRef.current + 1;
        previewRequestRef.current = requestId;

        setPreviewState({
            loading: true,
            html: '',
            error: '',
            imageWarning: false,
        });

        try {
            const response = await apiClient.get(
                `/api/letter-templates/${template._id}/download`,
                {
                    ...config,
                    params: { lang: language },
                    responseType: 'arraybuffer',
                }
            );

            const result = await mammoth.convertToHtml({ arrayBuffer: response.data });
            const imageWarning = Boolean(
                result.messages?.find((message) => String(message.message || '').toLowerCase().includes('image'))
            );

            if (requestId !== previewRequestRef.current) return;

            setPreviewState({
                loading: false,
                html: highlightPreviewPlaceholders(result.value),
                error: '',
                imageWarning,
            });
        } catch (error) {
            if (requestId !== previewRequestRef.current) return;

            const status = error.response?.status;
            const message =
                status === 404
                    ? 'This file is listed as uploaded, but it could not be found. Please upload the Word (.docx) file again.'
                    : error.response?.data?.message || 'Preview generation failed for this document.';

            setPreviewState({
                loading: false,
                html: '',
                error: message,
                imageWarning: false,
            });
        }
    }, [config]);

    useEffect(() => {
        loadPreview(selectedTemplate, activeLanguage);
    }, [activeLanguage, loadPreview, selectedTemplate]);

    const handleSelectTemplate = (template) => {
        setSelectedTemplateId(template._id);
        setActiveLanguage(pickPreferredLanguage(template));
    };

    const handleCreateTemplate = async () => {
        const trimmedTitle = createForm.title.trim();

        if (!trimmedTitle) {
            setCreateForm((current) => ({ ...current, error: 'Please enter a title.' }));
            window.requestAnimationFrame(() => focusFirstInvalidField());
            return;
        }

        if (!createForm.incidentCategory) {
            setCreateForm((current) => ({ ...current, error: 'Please choose an incident category.' }));
            window.requestAnimationFrame(() => focusFirstInvalidField());
            return;
        }

        try {
            setCreating(true);
            await apiClient.post(
                '/api/letter-templates',
                {
                    title: trimmedTitle,
                    incidentCategory: createForm.incidentCategory,
                    description: createForm.description || '',
                },
                config
            );

            setCreateModalOpen(false);
            setCreateForm({
                title: '',
                incidentCategory: '',
                description: '',
                error: '',
            });
            await fetchTemplates(false);
            addToast('Letter file created successfully.');
        } catch (error) {
            const message = error.response?.data?.message || 'Could not add the letter file.';
            setCreateForm((current) => ({ ...current, error: message }));
            addToast(message, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleUploadVariant = async (file) => {
        if (!uploadState.template || !file) return;

        const formData = new FormData();
        formData.append('docx', file);
        formData.append('language', uploadState.language);

        try {
            setUploading(true);
            await apiClient.put(
                `/api/letter-templates/${uploadState.template._id}/upload`,
                formData,
                {
                    ...config,
                    headers: {
                        ...config.headers,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setUploadState({ open: false, template: null, language: 'en' });
            await fetchTemplates(false);
            setSelectedTemplateId(uploadState.template._id);
            setActiveLanguage(uploadState.language);
            addToast(`${LANGUAGE_META[uploadState.language].label} letter file uploaded.`);
        } catch (error) {
            addToast(error.response?.data?.message || 'Could not upload the letter file.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const downloadVariant = async (template, language) => {
        const variant = getVariantMeta(template, language);
        if (!variant.hasDocx) {
            addToast(`No ${LANGUAGE_META[language].label.toLowerCase()} file is available yet.`, 'error');
            return;
        }

        const loadingKey = `${template._id}-${language}-docx`;

        try {
            setDownloadingKey(loadingKey);

            const response = await apiClient.get(
                `/api/letter-templates/${template._id}/download`,
                {
                    ...config,
                    params: { lang: language },
                    responseType: 'blob',
                }
            );

            await withFeedback(
                addToast,
                () => downloadBlob(
                    new Blob([response.data]),
                    `${sanitizeFilename(template.title)}_${language}.docx`,
                    { title: `${LANGUAGE_META[language].label} Word file` }
                ),
                {
                    successMessage: `${LANGUAGE_META[language].label} Word file downloaded successfully.`,
                    errorMessage: 'Download failed.',
                }
            );
        } catch {
        } finally {
            setDownloadingKey('');
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!confirmState.template) return;

        try {
            setDeleting(true);

            if (confirmState.mode === 'variant') {
                await apiClient.delete(
                    `/api/letter-templates/${confirmState.template._id}`,
                    { ...config, params: { lang: confirmState.language } }
                );
                addToast(`${LANGUAGE_META[confirmState.language].label} letter file removed.`);
            } else {
                await apiClient.delete(
                    `/api/letter-templates/document/${confirmState.template._id}`,
                    config
                );
                addToast('Letter file removed successfully.');
            }

            setConfirmState({ open: false, mode: '', template: null, language: 'en' });
            await fetchTemplates(false);
        } catch (error) {
            addToast(error.response?.data?.message || 'Delete failed.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const copyToClipboard = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            addToast('Copied to clipboard.');
        } catch (error) {
            addToast('Copy failed on this browser.', 'error');
        }
    };

    const copyAllTags = () => {
        const tags = TAG_GROUPS.flatMap((group) => group.items.map((item) => item.tag)).join('\n');
        copyToClipboard(tags);
    };

    const downloadGuide = async () => {
        try {
            await withFeedback(
                addToast,
                () => downloadBlob(
                    new Blob([buildTagGuideText()], { type: 'text/plain;charset=utf-8' }),
                    'Letter_merge_fields_guide.txt',
                    { title: 'Letter Merge Fields Guide' }
                ),
                {
                    successMessage: 'Merge field guide downloaded successfully.',
                    errorMessage: 'Download failed.',
                }
            );
        } catch {
        }
    };

    const currentVariant = getVariantMeta(selectedTemplate, activeLanguage);

    if (!isSchoolUserRole(user?.role)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-700 ">
                Staff access is required to manage official letters.
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100 text-slate-900 ">
            <style>{DOCX_PREVIEW_STYLES}</style>

            <div className="flex min-w-0 flex-1 flex-col">

                <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-[1700px] flex-col gap-6">
                        <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white shadow-2xl shadow-slate-900/20">
                            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-center lg:px-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                                        <ShieldCheck className="h-4 w-4" />
                                        Official Letters
                                    </div>
                                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                                        Letter Templates
                                    </h1>
                                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                                        Manage official letter template files.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <WorkspaceActionButton
                                        icon={RefreshCw}
                                        onClick={() => {
                                            fetchTemplates(false);
                                            fetchCategories();
                                        }}
                                        disabled={refreshing}
                                    >
                                        {refreshing ? 'Refreshing…' : 'Refresh'}
                                    </WorkspaceActionButton>
                                    <WorkspaceActionButton icon={Download} onClick={downloadGuide}>
                                        Template Fields Guide
                                    </WorkspaceActionButton>
                                    <WorkspaceActionButton
                                        icon={Plus}
                                        variant="primary"
                                        onClick={() => setCreateModalOpen(true)}
                                    >
                                        New Letter File
                                    </WorkspaceActionButton>
                                </div>
                            </div>
                        </section>

                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                label="Total Templates"
                                value={templateMetrics.total}
                                description="Templates saved for incident categories."
                            />
                            <MetricCard
                                label="Both Languages Ready"
                                value={templateMetrics.fullyReady}
                                description="English and Tamil files are uploaded."
                                tone="emerald"
                            />
                            <MetricCard
                                label="English Uploaded"
                                value={templateMetrics.englishReady}
                                description="Templates with an English Word file."
                                tone="blue"
                            />
                            <MetricCard
                                label="Tamil Uploaded"
                                value={templateMetrics.tamilReady}
                                description="Templates with a Tamil Word file."
                                tone="indigo"
                            />
                        </section>

                        <section className="grid gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="space-y-6">
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900 ">All Templates</h2>
                                            <p className="mt-1 text-sm text-slate-500 ">
                                                Each card shows which languages have a Word file uploaded.
                                            </p>
                                        </div>
                                        <div className="relative w-full max-w-md">
                                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(event) => setSearchTerm(event.target.value)}
                                                placeholder="Search by title, category, or description…"
                                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 "
                                            />
                                        </div>
                                    </div>
                                </section>

                                {loading ? (
                                    <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm ">
                                        <div className="text-center">
                                            <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-500" />
                                            <p className="mt-4 text-sm font-medium text-slate-600 ">Loading letter files…</p>
                                        </div>
                                    </div>
                                ) : filteredTemplates.length === 0 ? (
                                    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm ">
                                        <FileText className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-5 text-xl font-semibold text-slate-900 ">No templates match your search.</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-500 ">
                                            Try different words in the search box, or add a new template for a category that is not covered yet.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
                                        {filteredTemplates.map((template) => (
                                            <TemplateCard
                                                key={template._id}
                                                template={template}
                                                selected={template._id === selectedTemplateId}
                                                onSelect={handleSelectTemplate}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <section className="rounded-3xl border border-slate-200 bg-white shadow-sm ">
                                    <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">
                                                    Template Workspace
                                                </p>
                                                <h2 className="mt-2 text-2xl font-semibold text-slate-900 ">
                                                    {selectedTemplate?.title || 'Choose a Template'}
                                                </h2>
                                                <p className="mt-2 text-sm text-slate-500 ">
                                                    {selectedTemplate
                                                        ? `${selectedTemplate.incidentCategory} — preview, upload, and download each language from here.`
                                                        : 'Select a template on the left to preview and manage its language files here.'}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(LANGUAGE_META).map(([language, meta]) => {
                                                    const variant = getVariantMeta(selectedTemplate, language);
                                                    const isActive = activeLanguage === language;
                                                    return (
                                                        <button
                                                            key={language}
                                                            type="button"
                                                            onClick={() => setActiveLanguage(language)}
                                                            aria-pressed={isActive}
                                                            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                                                isActive
                                                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 '
                                                            }`}
                                                        >
                                                            <Languages className="h-4 w-4" aria-hidden="true" />
                                                            {meta.label}
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                                    isActive
                                                                        ? variant.hasDocx
                                                                            ? 'bg-emerald-400/30 text-emerald-100'
                                                                            : 'bg-rose-400/30 text-rose-100'
                                                                        : variant.hasDocx
                                                                            ? 'bg-emerald-100 text-emerald-700 '
                                                                            : 'bg-rose-100 text-rose-700 '
                                                                }`}
                                                            >
                                                                {variant.hasDocx ? 'Uploaded' : 'Missing'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {selectedTemplate ? (
                                            <div className="mt-5 flex flex-wrap gap-3">
                                                <WorkspaceActionButton
                                                    icon={Upload}
                                                    variant="primary"
                                                    onClick={() =>
                                                        setUploadState({ open: true, template: selectedTemplate, language: activeLanguage })
                                                    }
                                                >
                                                    {currentVariant.hasDocx ? 'Replace Word file' : 'Upload Word file'}
                                                </WorkspaceActionButton>

                                                <WorkspaceActionButton
                                                    icon={Download}
                                                    className="btn-export"
                                                    onClick={() => downloadVariant(selectedTemplate, activeLanguage)}
                                                    disabled={!currentVariant.hasDocx || downloadingKey === `${selectedTemplate._id}-${activeLanguage}-docx`}
                                                >
                                                    {downloadingKey === `${selectedTemplate._id}-${activeLanguage}-docx` ? 'Downloading…' : 'Download Word File'}
                                                </WorkspaceActionButton>

                                                <WorkspaceActionButton
                                                    icon={Trash2}
                                                    variant="danger"
                                                    onClick={() =>
                                                        setConfirmState({
                                                            open: true,
                                                            mode: 'variant',
                                                            template: selectedTemplate,
                                                            language: activeLanguage,
                                                        })
                                                    }
                                                    disabled={!currentVariant.hasVersion && !currentVariant.hasDocx}
                                                >
                                                    Remove This Language
                                                </WorkspaceActionButton>

                                                <WorkspaceActionButton
                                                    icon={Trash2}
                                                    variant="danger"
                                                    onClick={() =>
                                                        setConfirmState({
                                                            open: true,
                                                            mode: 'template',
                                                            template: selectedTemplate,
                                                            language: activeLanguage,
                                                        })
                                                    }
                                                >
                                                    Remove Letter File
                                                </WorkspaceActionButton>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="p-4 sm:p-6">
                                        <PreviewPanel
                                            template={selectedTemplate}
                                            language={activeLanguage}
                                            previewState={previewState}
                                            onUpload={() =>
                                                selectedTemplate
                                                    ? setUploadState({ open: true, template: selectedTemplate, language: activeLanguage })
                                                    : null
                                            }
                                            onRetry={() => loadPreview(selectedTemplate, activeLanguage)}
                                        />
                                    </div>
                                </section>

                                <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                                    <DetailsCard template={selectedTemplate} />
                                    <PlaceholderLibrary
                                        onCopyAll={copyAllTags}
                                        onDownloadGuide={downloadGuide}
                                        onCopyTag={copyToClipboard}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            {createModalOpen ? (
                <CreateTemplateModal
                    categories={categories}
                    creating={creating}
                    formState={createForm}
                    onClose={() => {
                        setCreateModalOpen(false);
                        setCreateForm({
                            title: '',
                            incidentCategory: '',
                            description: '',
                            error: '',
                        });
                    }}
                    onChange={(field, value) =>
                        setCreateForm((current) => ({ ...current, [field]: value, error: '' }))
                    }
                    onSubmit={handleCreateTemplate}
                />
            ) : null}

            {uploadState.open ? (
                <UploadVariantModal
                    template={uploadState.template}
                    language={uploadState.language}
                    uploading={uploading}
                    onClose={() => setUploadState({ open: false, template: null, language: 'en' })}
                    onUpload={handleUploadVariant}
                />
            ) : null}

            {confirmState.open ? (
                <ConfirmModal
                    title={confirmState.mode === 'template' ? 'Remove Letter File' : 'Remove This Language'}
                    description={
                        confirmState.mode === 'template'
                            ? `This will remove "${confirmState.template?.title}" for both English and Tamil, including stored files.`
                            : `This will remove the ${LANGUAGE_META[confirmState.language].label.toLowerCase()} letter file from "${confirmState.template?.title}".`
                    }
                    confirmLabel={confirmState.mode === 'template' ? 'Remove Letter File' : 'Remove Language'}
                    busy={deleting}
                    onClose={() => setConfirmState({ open: false, mode: '', template: null, language: 'en' })}
                    onConfirm={handleDeleteConfirmed}
                />
            ) : null}
        </div>
    );
};

export default LetterTemplates;
