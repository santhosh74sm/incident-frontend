import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import {
    AlertCircle,
    AlertTriangle,
    CalendarDays,
    Camera,
    Check,
    Clock3,
    FileImage,
    FileText,
    History,
    Loader2,
    Mail,
    Pencil,
    PlusCircle,
    Save,
    Search,
    Send,
    ShieldCheck,
    Sparkles,
    Tag,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import { isAdminRole, isTeacherRole } from '../utils/roles';
import { formatDisplayValue } from '../utils/analytics';
import useFocusFirstInvalid from '../hooks/useFocusFirstInvalid';
import {
    clearCreateIncidentDraft,
    getCreateIncidentDraft,
    setCreateIncidentDraft,
} from '../utils/createIncidentDraftStore';

dayjs.extend(customParseFormat);


const emptyLetterPermission = {
    open: false,
    templates: null,
    shouldGenerate: null,
    manualTiming: null,
    categoryId: null,
    categoryName: '',
};

const getOptionId = (option) => option?._id || option?.id || option || '';
const getOptionLabel = (option) => formatDisplayValue(option?.name || option?.label || option || '');
const hasAvailableLetterTemplate = (templates) => Boolean(templates?.en || templates?.ta);
const findOptionByValue = (options, value) =>
    options.find((option) => String(getOptionId(option)) === String(value) || getOptionLabel(option) === value);

const createEmptyEvidenceEntry = () => ({ evidenceType: '', file: null, preview: null });
const buildEvidenceTypeDisplayLabels = (entries = []) => {
    const totals = new Map();

    entries.forEach((entry) => {
        const evidenceType = entry?.evidenceType || '';
        if (!evidenceType) return;
        totals.set(evidenceType, (totals.get(evidenceType) || 0) + 1);
    });

    const occurrences = new Map();
    return entries.map((entry) => {
        const evidenceType = entry?.evidenceType || '';
        if (!evidenceType) return '';

        const occurrence = (occurrences.get(evidenceType) || 0) + 1;
        occurrences.set(evidenceType, occurrence);

        return totals.get(evidenceType) > 1 && occurrence > 1
            ? `${evidenceType} (${occurrence})`
            : evidenceType;
    });
};
const createInitialFormData = () => ({
    description: '',
    category: '',
    class: '',
    section: '',
    location: '',
    assignedHandler: '',
    isHighPriority: false,
});

const createInitialManualSetup = () => ({
    status: 'Pending',
    openedAt: null,
    closedAt: null,
});

const createInitialCategoryTemplateStatus = () => ({
    loading: false,
    templates: null,
    checkedCategory: '',
    categoryId: null,
    message: '',
    error: '',
});

const createEvidenceEntriesFromDraft = (entries = []) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return [createEmptyEvidenceEntry()];
    }

    const hydratedEntries = entries.map((entry) => {
        const file = entry?.file || null;
        return {
            evidenceType: entry?.evidenceType || '',
            file,
            preview: file && file.type?.startsWith('image/') ? URL.createObjectURL(file) : null,
        };
    });

    return hydratedEntries.length ? hydratedEntries : [createEmptyEvidenceEntry()];
};

const serializeEvidenceEntriesForDraft = (entries = []) =>
    entries.map((entry) => ({
        evidenceType: entry?.evidenceType || '',
        file: entry?.file || null,
    }));

const hasDraftableEvidence = (entries = []) =>
    entries.some((entry) => entry?.evidenceType || entry?.file);

const hasCreateIncidentDraftContent = ({
    formData,
    manualTiming,
    selectedCategoryId,
    evidenceEntries,
    studentSearch,
    selectedStudent,
    letterInfo,
    behavioralInsight,
}) =>
    Boolean(
        formData?.description ||
        formData?.category ||
        formData?.class ||
        formData?.section ||
        formData?.location ||
        formData?.assignedHandler ||
        formData?.isHighPriority ||
        manualTiming ||
        selectedCategoryId ||
        hasDraftableEvidence(evidenceEntries) ||
        studentSearch ||
        selectedStudent?._id ||
        letterInfo ||
        behavioralInsight
    );

const createManualValue = (date = dayjs().format('YYYY-MM-DD')) => ({
    date,
    hour: '',
    minute: '',
    ampm: '',
});

const normalizeManualValue = (value, fallbackDate = dayjs().format('YYYY-MM-DD')) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {
            date: value.date || fallbackDate,
            hour: value.hour || '',
            minute: value.minute || '',
            ampm: value.ampm || '',
        };
    }

    if (typeof value === 'string') {
        const parsed = dayjs(value);
        return {
            date: parsed.isValid() ? parsed.format('YYYY-MM-DD') : fallbackDate,
            hour: '',
            minute: '',
            ampm: '',
        };
    }

    return createManualValue(fallbackDate);
};

const manualValueToDayjs = (value) => {
    if (!value?.date) return null;

    const hour = value.hour || '12';
    const minute = value.minute || '01';
    const ampm = value.ampm || 'AM';
    const parsed = dayjs(`${value.date} ${hour}:${minute} ${ampm}`, 'YYYY-MM-DD hh:mm A');

    return parsed.isValid() ? parsed : null;
};

const formatManualSummary = (value) => {
    const parsed = manualValueToDayjs(value);
    return parsed ? parsed.format('DD MMM YYYY, hh:mm A') : 'Not set';
};

const SectionCard = ({ icon: Icon, title, description, action, children, className = '', step }) => (
    <section className={`create-section-card min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className}`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/50 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                {step ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                        {step}
                    </div>
                ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                        <Icon className="h-[18px] w-[18px] text-blue-600" />
                    </div>
                )}
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900">{title}</h2>
                    {description && <p className="mt-0.5 break-words text-xs text-slate-500">{description}</p>}
                </div>
            </div>
            {action}
        </div>
        <div className="p-4">{children}</div>
    </section>
);

const StatusBanner = ({ type = 'info', children }) => {
    const styles = {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        error: 'border-red-200 bg-red-50 text-red-900',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        info: 'border-blue-200 bg-blue-50 text-blue-900',
    };

    const icons = {
        success: Check,
        error: AlertCircle,
        warning: AlertTriangle,
        info: Sparkles,
    };

    const Icon = icons[type] || icons.info;

    return (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles[type] || styles.info}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">{children}</div>
        </div>
    );
};

const MetricCard = ({ icon: Icon, label, value, tone = 'slate' }) => {
    const tones = {
        slate: 'bg-slate-50 text-slate-800 ring-slate-200',
        blue: 'bg-blue-50 text-blue-800 ring-blue-200',
        indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
        emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    };

    return (
        <div className={`rounded-xl px-4 py-3 ring-1 ${tones[tone] || tones.slate}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <Icon className="h-4 w-4" />
                {label}
            </div>
            <p className="mt-2 text-lg font-bold">{value}</p>
        </div>
    );
};

const ManualDateTimeField = ({ label, description, required, value, onChange }) => {
    const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

    return (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
                <label className="text-sm font-semibold text-slate-800">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            </div>

            <div className="grid min-w-0 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <input
                    type="date"
                    value={value?.date || ''}
                    onChange={(event) => onChange({ ...value, date: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />

                <div className="grid min-w-0 grid-cols-3 gap-2">
                    <select
                        value={value?.hour || ''}
                        onChange={(event) => onChange({ ...value, hour: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    >
                        <option value="">HH</option>
                        {hours.map((hour) => (
                            <option key={hour} value={hour}>
                                {hour}
                            </option>
                        ))}
                    </select>

                    <select
                        value={value?.minute || ''}
                        onChange={(event) => onChange({ ...value, minute: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    >
                        <option value="">MM</option>
                        {minutes.map((minute) => (
                            <option key={minute} value={minute}>
                                {minute}
                            </option>
                        ))}
                    </select>

                    <select
                        value={value?.ampm || ''}
                        onChange={(event) => onChange({ ...value, ampm: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    >
                        <option value="">AM/PM</option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
            </div>

            <p className="text-xs text-slate-500">{description}</p>
        </div>
    );
};

const CreateIncident = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const shownInsightsRef = useRef(new Set());
    const studentScopeRef = useRef({ className: '', section: '' });
    const studentClassCacheRef = useRef(new Map());
    const isRestoringStudentRef = useRef(false);
    const restoredStudentRef = useRef(null);
    const formRef = useRef(null);

    const [formData, setFormData] = useState(createInitialFormData);
    const [manualTiming, setManualTiming] = useState(false);
    const [manualSetup, setManualSetup] = useState(createInitialManualSetup);
    const [isManualTimeFinalized, setIsManualTimeFinalized] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [evidenceEntries, setEvidenceEntries] = useState([{ evidenceType: '', file: null, preview: null }]);
    const evidenceEntriesRef = useRef(evidenceEntries);
    evidenceEntriesRef.current = evidenceEntries;
    const [dbOptions, setDbOptions] = useState({ classes: [], sections: [] });
    const [staffList, setStaffList] = useState([]);
    const [students, setStudents] = useState([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [evidenceTypes, setEvidenceTypes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingStudents, setFetchingStudents] = useState(false);
    const [modal, setModal] = useState({ open: false, type: '', value: '', mode: 'add', target: null });
    const [errors, setErrors] = useState({});
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [letterInfo, setLetterInfo] = useState(null);
    const [letterPermission, setLetterPermission] = useState({ ...emptyLetterPermission });
    const [letterLanguage, setLetterLanguage] = useState('en');
    const [behavioralInsight, setBehavioralInsight] = useState(null);
    const [categoryTemplateStatus, setCategoryTemplateStatus] = useState(createInitialCategoryTemplateStatus);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [isDraftHydrated, setIsDraftHydrated] = useState(false);
    useFocusFirstInvalid(errors, formRef);

    const config = useMemo(() => ({ headers: {} }), []);
    const isAdministrationUser = isAdminRole(user?.role);
    const canUseManualTiming = isAdministrationUser || isTeacherRole(user?.role);
    const isPrivilegedUser = isAdministrationUser || isTeacherRole(user?.role);
    const handleHighPriorityToggle = useCallback((checked) => {
        setFormData((current) => {
            if (current.isHighPriority === checked) {
                return current;
            }
            return {
                ...current,
                isHighPriority: checked,
            };
        });
    }, []);

    const selectedCategory = useMemo(
        () => findOptionByValue(categories, selectedCategoryId || formData.category) || null,
        [categories, formData.category, selectedCategoryId]
    );
    const evidenceTypeDisplayLabels = useMemo(
        () => buildEvidenceTypeDisplayLabels(evidenceEntries),
        [evidenceEntries]
    );
    const wizardSteps = useMemo(() => {
        const studentComplete = Boolean(selectedStudent?._id);
        const incidentDetailsComplete = Boolean(formData.category);
        const handlerComplete = canUseManualTiming
            ? Boolean(!manualTiming || isManualTimeFinalized)
            : true;
        const evidenceTouched = evidenceEntries.some((entry) => entry.evidenceType || entry.file);
        const evidenceComplete = !evidenceTouched || evidenceEntries.every((entry) => {
            if (!entry.evidenceType && !entry.file) return true;
            return Boolean(entry.evidenceType && entry.file);
        });
        const completed = [
            studentComplete,
            studentComplete && incidentDetailsComplete,
            studentComplete && incidentDetailsComplete && handlerComplete,
            studentComplete && incidentDetailsComplete && handlerComplete && evidenceComplete,
            false,
        ];
        const activeIndex = completed.findIndex((isComplete) => !isComplete);

        return [
            ['Select Student', 'Choose student'],
            ['Incident Details', 'Provide incident information'],
            ['Handler Assignment', 'Assign and set priority'],
            ['Evidence', 'Add supporting evidence'],
            ['Review & Submit', 'Review and submit'],
        ].map(([label, helper], index) => ({
            label,
            helper,
            complete: completed[index],
            active: index === (activeIndex === -1 ? 4 : activeIndex),
        }));
    }, [canUseManualTiming, evidenceEntries, formData.category, isManualTimeFinalized, manualTiming, selectedStudent]);

    const sectionFilteredStudents = useMemo(() => {
        if (!formData.section) return students;
        return students.filter((student) => String(student.section || '') === String(formData.section || ''));
    }, [formData.section, students]);

    const filteredStudents = useMemo(() => {
        const search = studentSearch.trim().toLowerCase();
        if (!search) return sectionFilteredStudents;

        return sectionFilteredStudents.filter((student) => {
            const nameMatch = (student.name || '').toLowerCase().includes(search);
            const admissionMatch = (student.admissionNo || '').toLowerCase().includes(search);
            return nameMatch || admissionMatch;
        });
    }, [sectionFilteredStudents, studentSearch]);
    const emptyStudentListMessage = useMemo(() => {
        if (formData.section && sectionFilteredStudents.length === 0) {
            return 'No students available in this section.';
        }
        if (studentSearch.trim()) {
            return 'No students match the current search.';
        }
        return 'No students match the current filters.';
    }, [formData.section, sectionFilteredStudents.length, studentSearch]);

    const checkLetterTemplate = useCallback(
        async (categoryName) => {
            if (!categoryName) return null;

            try {
                const response = await apiClient.get(
                    `/api/letter-templates/category/${encodeURIComponent(categoryName)}`,
                    config
                );
                const template = response.data;

                if (!template) {
                    return { en: null, ta: null, message: 'No official letter file is set up for this category yet.' };
                }

                return {
                    en: template.hasEnglishDocx ? template : null,
                    ta: template.hasTamilDocx ? template : null,
                    message:
                        template.message ||
                        (template.hasEnglishDocx || template.hasTamilDocx
                            ? 'Official letter file ready'
                            : 'No official letter file for this category'),
                };
            } catch (error) {
                if (error.response?.status === 404) {
                    return { en: null, ta: null, message: 'No official letter file is set up for this category yet.' };
                }

                return {
                    en: null,
                    ta: null,
                    error: 'We could not check the letter file for this category right now. You can still save the incident.',
                };
            }
        },
        [config]
    );

    const fetchAllData = useCallback(async (options = {}) => {
        if (!user?._id) return;
        const isMounted = options.isMounted || (() => true);

        try {
            const [filtersResponse, categoryResponse, locationResponse, staffResponse, evidenceResponse] =
                await Promise.all([
                    apiClient.get(`/api/students/filters`, config).catch(() => ({ data: { classes: [], sections: [] } })),
                    apiClient.get(`/api/incidents/categories`, config).catch(() => ({ data: [] })),
                    apiClient.get(`/api/incidents/locations`, config).catch(() => ({ data: [] })),
                    apiClient.get(`/api/auth/users/investigators`, config).catch(() => ({ data: [] })),
                    apiClient.get(`/api/evidence-types`, config).catch(() => ({ data: [] })),
                ]);

            if (!isMounted()) return;
            setDbOptions(filtersResponse.data || { classes: [], sections: [] });
            setCategories(categoryResponse.data || []);
            setLocations(locationResponse.data || []);
            setStaffList(Array.isArray(staffResponse.data) ? staffResponse.data : []);
            setEvidenceTypes(evidenceResponse.data || []);
        } catch (error) {
            if (!isMounted()) return;
            addToast('We could not load all incident form options. Please refresh and try again.', 'error');
        }
    }, [addToast, config, user?._id]);

    const persistDraft = useCallback(() => {
        if (submitSuccess || !user?._id) return;

        const hasContent = hasCreateIncidentDraftContent({
            formData,
            manualTiming,
            selectedCategoryId,
            evidenceEntries,
            studentSearch,
            selectedStudent,
            letterInfo,
            behavioralInsight,
        });

        if (!hasContent) {
            void clearCreateIncidentDraft(user);
            return;
        }

        void setCreateIncidentDraft(user, {
            formData,
            manualTiming,
            manualSetup,
            isManualTimeFinalized,
            selectedCategoryId,
            evidenceEntries: serializeEvidenceEntriesForDraft(evidenceEntries),
            studentSearch,
            selectedStudent,
            errors,
            letterInfo,
            letterPermission,
            letterLanguage,
            behavioralInsight,
            categoryTemplateStatus,
            scrollPosition,
        });
    }, [
        behavioralInsight,
        categoryTemplateStatus,
        errors,
        evidenceEntries,
        formData,
        isManualTimeFinalized,
        letterInfo,
        letterLanguage,
        letterPermission,
        manualSetup,
        manualTiming,
        scrollPosition,
        selectedCategoryId,
        selectedStudent,
        studentSearch,
        submitSuccess,
        user,
    ]);

    const handleSaveDraft = useCallback(() => {
        persistDraft();
        addToast('Draft saved.', 'success');
    }, [addToast, persistDraft]);

    useEffect(() => {
        let active = true;

        const hydrateDraft = async () => {
            if (!user?._id) {
                setIsDraftHydrated(true);
                return;
            }

            const savedDraft = await getCreateIncidentDraft(user);
            if (!active) return;

            if (!savedDraft) {
                setIsDraftHydrated(true);
                return;
            }

            const nextFormData = { ...savedDraft.formData };
            const restoredStudent = savedDraft.selectedStudent || null;
            studentScopeRef.current = {
                className: nextFormData.class || '',
                section: nextFormData.section || '',
            };
            restoredStudentRef.current = restoredStudent;
            isRestoringStudentRef.current = Boolean(restoredStudent?._id);

            setFormData((current) => ({ ...current, ...nextFormData }));
        setManualTiming(Boolean(savedDraft.manualTiming));
            setManualSetup(savedDraft.manualSetup || createInitialManualSetup());
            setIsManualTimeFinalized(Boolean(savedDraft.isManualTimeFinalized));
            setSelectedCategoryId(savedDraft.selectedCategoryId || '');
            setEvidenceEntries(createEvidenceEntriesFromDraft(savedDraft.evidenceEntries));
            setStudentSearch(savedDraft.studentSearch || '');
            setSelectedStudent(restoredStudent);
            setErrors(savedDraft.errors || {});
            setLetterInfo(savedDraft.letterInfo || null);
            setLetterPermission(savedDraft.letterPermission || { ...emptyLetterPermission });
            setLetterLanguage(savedDraft.letterLanguage || 'en');
            setBehavioralInsight(savedDraft.behavioralInsight || null);
            setCategoryTemplateStatus(savedDraft.categoryTemplateStatus || createInitialCategoryTemplateStatus());
            setScrollPosition(savedDraft.scrollPosition || 0);

            requestAnimationFrame(() => {
                window.scrollTo({ top: savedDraft.scrollPosition || 0, behavior: 'auto' });
            });

            setIsDraftHydrated(true);
        };

        void hydrateDraft();

        return () => {
            active = false;
        };
    }, [user]);

    useEffect(() => {
        let active = true;

        const loadPageOptions = async () => {
            if (!active) return;
            await fetchAllData({ isMounted: () => active });
        };

        void loadPageOptions();

        return () => {
            active = false;
        };
    }, [fetchAllData]);

    useEffect(() => {
        if (!isDraftHydrated) return;
        persistDraft();
    }, [isDraftHydrated, persistDraft]);

    useEffect(() => {
        if (!isDraftHydrated) return undefined;

        let ticking = false;
        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                setScrollPosition(window.scrollY || 0);
                ticking = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isDraftHydrated]);

    useEffect(() => {
        return () => {
            evidenceEntriesRef.current.forEach((entry) => {
                if (entry.preview) {
                    URL.revokeObjectURL(entry.preview);
                }
            });
        };
    }, []);

    useEffect(() => {
        if (!isDraftHydrated) return;

        const nextScope = { className: formData.class, section: formData.section };
        const previousScope = studentScopeRef.current;
        studentScopeRef.current = nextScope;

        if (previousScope.className === nextScope.className && previousScope.section === nextScope.section) return;
        if (previousScope.className === nextScope.className) return;

        if (isRestoringStudentRef.current) {
            const restoredStudent = restoredStudentRef.current;
            const classMatches = String(restoredStudent?.className || '') === String(nextScope.className || '');
            const sectionMatches = String(restoredStudent?.section || '') === String(nextScope.section || '');
            if (classMatches && sectionMatches) {
                isRestoringStudentRef.current = false;
                restoredStudentRef.current = null;
                return;
            }
            isRestoringStudentRef.current = false;
            restoredStudentRef.current = null;
        }

        setSelectedStudent(null);
        setStudentSearch('');
        setBehavioralInsight(null);
        shownInsightsRef.current.clear();
        setErrors((current) => {
            if (!current.student) return current;
            const next = { ...current };
            delete next.student;
            return next;
        });
    }, [formData.class, formData.section, isDraftHydrated]);

    useEffect(() => {
        if (!formData.class || !user?._id) {
            setStudents([]);
            return;
        }

        let active = true;
        const controller = new AbortController();
        const className = formData.class;
        const cachedStudents = studentClassCacheRef.current.get(className);

        if (cachedStudents) {
            setStudents(cachedStudents);
            setFetchingStudents(false);
            return () => {
                active = false;
                controller.abort();
            };
        }

        setFetchingStudents(true);

        apiClient
            .get(`/api/students/filter?className=${encodeURIComponent(className)}`, {
                ...config,
                signal: controller.signal,
            })
            .then((response) => {
                if (!active) return;
                const nextStudents = Array.isArray(response.data) ? response.data : [];
                studentClassCacheRef.current.set(className, nextStudents);
                setStudents(nextStudents);
            })
            .catch((error) => {
                if (active && error?.code !== 'ERR_CANCELED') setStudents([]);
            })
            .finally(() => {
                if (active) setFetchingStudents(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [config, formData.class, user?._id]);

    useEffect(() => {
        if (!selectedStudent?._id) return;

        const classMatches = String(selectedStudent.className || '') === String(formData.class || '');
        const sectionMatches = !formData.section || String(selectedStudent.section || '') === String(formData.section || '');

        setErrors((current) => {
            const next = { ...current };
            if (classMatches && !sectionMatches) {
                next.student = 'Selected student is not in the chosen section. Please select another student.';
                return next;
            }

            if (next.student === 'Selected student is not in the chosen section. Please select another student.') {
                delete next.student;
            }
            return next;
        });
    }, [formData.class, formData.section, selectedStudent]);

    useEffect(() => {
        if (!formData.category) {
            setCategoryTemplateStatus(createInitialCategoryTemplateStatus());
            return;
        }

        let active = true;
        setCategoryTemplateStatus({
            loading: true,
            templates: null,
            checkedCategory: formData.category,
            categoryId: selectedCategoryId || null,
            message: '',
            error: '',
        });

        checkLetterTemplate(formData.category).then((templates) => {
            if (!active) return;

            setCategoryTemplateStatus({
                loading: false,
                templates,
                checkedCategory: formData.category,
                categoryId: selectedCategoryId || null,
                message: templates?.message || '',
                error: templates?.error || '',
            });
        }).catch(() => {
            if (!active) return;
            setCategoryTemplateStatus((current) => ({
                ...current,
                loading: false,
                error: 'We could not check the letter file right now.',
            }));
        });

        return () => {
            active = false;
        };
    }, [checkLetterTemplate, formData.category, selectedCategoryId]);

    useEffect(() => {
        if (!selectedCategoryId && selectedCategory) {
            setSelectedCategoryId(getOptionId(selectedCategory));
        }
    }, [selectedCategory, selectedCategoryId]);

    useEffect(() => {
        if (!letterPermission.open || !letterPermission.templates) return;
        if (letterPermission.templates[letterLanguage]) return;

        if (letterPermission.templates.en) {
            setLetterLanguage('en');
        } else if (letterPermission.templates.ta) {
            setLetterLanguage('ta');
        }
    }, [letterLanguage, letterPermission.open, letterPermission.templates]);

    const closeModal = () => setModal({ open: false, type: '', value: '', mode: 'add', target: null });

    const updateManualSetup = (updater) => {
        setIsManualTimeFinalized(false);
        setManualSetup(updater);
    };

    const removeFieldError = (field) => {
        setErrors((currentErrors) => {
            if (!currentErrors[field]) return currentErrors;
            const nextErrors = { ...currentErrors };
            delete nextErrors[field];
            return nextErrors;
        });
    };

    const openMetaModal = (type) => {
        setModal({ open: true, type, value: '', mode: 'add', target: null });
    };

    const openEditMetaModal = (type, option) => {
        if (!isPrivilegedUser || !option) return;

        setModal({
            open: true,
            type,
            value: getOptionLabel(option),
            mode: 'edit',
            target: {
                id: getOptionId(option),
                name: getOptionLabel(option),
            },
        });
    };

    const ensureManualSetupState = () => {
        setManualSetup((current) => ({
            status: current.status || 'Open',
            openedAt: normalizeManualValue(current.openedAt),
            inProgressAt: normalizeManualValue(current.inProgressAt),
            closedAt: normalizeManualValue(current.closedAt),
        }));
    };

    const openManualSetupModal = (mode = 'edit') => {
        setManualTiming(true);
        ensureManualSetupState();
        setModal({ open: true, type: 'manualTiming', value: '', mode });
        removeFieldError('manualTiming');
    };

    const clearManualSetup = () => {
        setManualTiming(false);
        setIsManualTimeFinalized(false);
        setManualSetup(createInitialManualSetup());
        removeFieldError('manualTiming');
    };

    const openLetterPermission = (templates, manualTimingPayload = null) => {
        setLetterPermission({
            open: true,
            templates,
            shouldGenerate: null,
            manualTiming: manualTimingPayload,
            categoryId: selectedCategoryId || getOptionId(selectedCategory) || null,
            categoryName: formData.category,
        });
    };

    const closeLetterPermission = () => setLetterPermission({ ...emptyLetterPermission });

    const handleDiscardDraft = async () => {
        await clearCreateIncidentDraft(user);

        evidenceEntriesRef.current.forEach((entry) => {
            if (entry.preview) {
                URL.revokeObjectURL(entry.preview);
            }
        });

        setFormData(createInitialFormData());
        setManualTiming(false);
        setManualSetup(createInitialManualSetup());
        setIsManualTimeFinalized(false);
        setSelectedCategoryId('');
        setEvidenceEntries([createEmptyEvidenceEntry()]);
        setStudentSearch('');
        setSelectedStudent(null);
        setErrors({});
        setSubmitSuccess(false);
        setLetterInfo(null);
        setLetterPermission({ ...emptyLetterPermission });
        setLetterLanguage('en');
        setBehavioralInsight(null);
        setCategoryTemplateStatus(createInitialCategoryTemplateStatus());
        setScrollPosition(0);
        studentScopeRef.current = { className: '', section: '' };
        restoredStudentRef.current = null;
        isRestoringStudentRef.current = false;
        shownInsightsRef.current.clear();
        window.scrollTo({ top: 0, behavior: 'auto' });
        addToast('Draft discarded.', 'success');
    };

    const handleCategoryChange = (value) => {
        const category = findOptionByValue(categories, value);
        setSelectedCategoryId(category ? getOptionId(category) : '');
        setFormData((current) => ({
            ...current,
            category: category ? getOptionLabel(category) : value,
        }));
        removeFieldError('category');
    };

    const getMetaOptions = (type) => {
        if (type === 'category') return categories;
        if (type === 'location') return locations;
        if (type === 'evidence') return evidenceTypes;
        return [];
    };

    const handleSaveMeta = async () => {
        const nextValue = modal.value.trim();
        if (!nextValue) {
            addToast('Please enter a name before saving.', 'warning');
            return;
        }

        const isEditMode = modal.mode === 'edit';

        if (isEditMode && !isPrivilegedUser) {
            addToast('Only administrators or teachers can rename category, location, and evidence options.', 'warning');
            return;
        }

        if (!isEditMode && !isPrivilegedUser) {
            addToast('Only administrators or teachers can update category, location, and evidence options.', 'warning');
            return;
        }

        const duplicate = getMetaOptions(modal.type).some((option) => {
            const optionId = String(getOptionId(option));
            const optionName = getOptionLabel(option).trim().toLowerCase();
            return optionName === nextValue.toLowerCase() && optionId !== String(modal.target?.id || '');
        });

        if (duplicate) {
            addToast('An option with this name already exists.', 'warning');
            return;
        }

        try {
            if (modal.type === 'category') {
                const { data } = isEditMode
                    ? await apiClient.put(`/api/incidents/categories/${modal.target.id}`, { name: nextValue }, config)
                    : await apiClient.post(`/api/incidents/categories`, { name: nextValue }, config);

                setCategories((current) =>
                    isEditMode
                        ? current.map((item) => (String(getOptionId(item)) === String(data._id) ? data : item))
                        : [...current, data]
                );

                if (isEditMode && formData.category === modal.target.name) {
                    setFormData((current) => ({ ...current, category: data.name }));
                    setSelectedCategoryId(data._id);
                }

                addToast(isEditMode ? 'Incident category renamed successfully.' : 'Incident category added successfully.', 'success');
            } else if (modal.type === 'location') {
                const { data } = isEditMode
                    ? await apiClient.put(`/api/incidents/locations/${modal.target.id}`, { name: nextValue }, config)
                    : await apiClient.post(`/api/incidents/locations`, { name: nextValue }, config);

                setLocations((current) =>
                    isEditMode
                        ? current.map((item) => (String(getOptionId(item)) === String(data._id) ? data : item))
                        : [...current, data]
                );

                if (isEditMode && formData.location === modal.target.name) {
                    setFormData((current) => ({ ...current, location: data.name }));
                }

                addToast(isEditMode ? 'Location renamed successfully.' : 'Location added successfully.', 'success');
            } else if (modal.type === 'evidence') {
                const { data } = isEditMode
                    ? await apiClient.put(`/api/evidence-types/${modal.target.id}`, { name: nextValue }, config)
                    : await apiClient.post(`/api/evidence-types`, { name: nextValue }, config);

                setEvidenceTypes((current) =>
                    isEditMode
                        ? current.map((item) => (String(getOptionId(item)) === String(data._id) ? data : item))
                        : [...current, data]
                );

                if (isEditMode) {
                    setEvidenceEntries((currentEntries) =>
                        currentEntries.map((entry) =>
                            entry.evidenceType === modal.target.name
                                ? { ...entry, evidenceType: data.name }
                                : entry
                        )
                    );
                }

                addToast(isEditMode ? 'Evidence type renamed successfully.' : 'Evidence type added successfully.', 'success');
            }

            closeModal();
        } catch (error) {
            addToast(error.response?.data?.message || 'Could not save this option right now. Please try again.', 'error');
        }
    };

    const handleDeleteMeta = async (type, id, name) => {
        if (!isPrivilegedUser) {
            addToast('Only administrators or teachers can remove category, location, and evidence options.', 'warning');
            return;
        }

        const confirmed = await confirm({
            tone: 'danger',
            title: 'Delete Master-List Option',
            description: `Delete "${name}" from the master list? Existing records keep their saved values, but this option will no longer be available for new selections.`,
            confirmLabel: 'Delete Option',
        });
        if (!confirmed) return;

        try {
            if (type === 'category') {
                await apiClient.delete(`/api/incidents/categories/${id}`, config);
                setCategories((current) => current.filter((item) => item._id !== id));

                if (formData.category === name) {
                    setFormData((current) => ({ ...current, category: '' }));
                    setSelectedCategoryId('');
                }

                addToast('Incident category deleted.', 'success');
            } else if (type === 'location') {
                await apiClient.delete(`/api/incidents/locations/${id}`, config);
                setLocations((current) => current.filter((item) => item._id !== id));

                if (formData.location === name) {
                    setFormData((current) => ({ ...current, location: '' }));
                }

                addToast('Location deleted.', 'success');
            } else if (type === 'evidence') {
                await apiClient.delete(`/api/evidence-types/${id}`, config);
                setEvidenceTypes((current) => current.filter((item) => item._id !== id));

                setEvidenceEntries((currentEntries) =>
                    currentEntries.map((entry) =>
                        entry.evidenceType === name
                            ? { ...entry, evidenceType: '' }
                            : entry
                    )
                );

                addToast('Evidence type deleted.', 'success');
            }
        } catch (error) {
            addToast('Could not delete this option right now. Please try again.', 'error');
        }
    };

    const handleAddEvidenceEntry = () => {
        setEvidenceEntries((currentEntries) => [
            ...currentEntries,
            createEmptyEvidenceEntry(),
        ]);
    };

    const handleRemoveEvidenceEntry = (index) => {
        setEvidenceEntries((currentEntries) => {
            const nextEntries = [...currentEntries];
            const removedEntry = nextEntries[index];
            if (removedEntry?.preview) {
                URL.revokeObjectURL(removedEntry.preview);
            }
            nextEntries.splice(index, 1);
            return nextEntries.length ? nextEntries : [createEmptyEvidenceEntry()];
        });
    };

    const handleEvidenceTypeChange = (index, evidenceType) => {
        removeFieldError('evidence');
        setEvidenceEntries((currentEntries) =>
            currentEntries.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, evidenceType } : entry
            )
        );
    };

    const handleEvidenceFileChange = (index, file) => {
        removeFieldError('evidence');
        setEvidenceEntries((currentEntries) =>
            currentEntries.map((entry, entryIndex) => {
                if (entryIndex !== index) return entry;

                if (entry.preview) {
                    URL.revokeObjectURL(entry.preview);
                }

                return {
                    ...entry,
                    file,
                    preview: file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                };
            })
        );
    };

    const handleRemoveEvidenceFile = (index) => {
        removeFieldError('evidence');
        setEvidenceEntries((currentEntries) =>
            currentEntries.map((entry, entryIndex) => {
                if (entryIndex !== index) return entry;

                if (entry.preview) {
                    URL.revokeObjectURL(entry.preview);
                }

                return {
                    ...entry,
                    file: null,
                    preview: null,
                };
            })
        );
    };

    const fetchBehavioralInsight = async (student) => {
        if (!student?._id || shownInsightsRef.current.has(student._id)) return;

        shownInsightsRef.current.add(student._id);

        try {
            const response = await apiClient.get(`/api/students/${student._id}/behavioral-summary`, config);
            const data = response.data;

            if (data.totalIncidents > 0 || data.totalLetters > 0) {
                setBehavioralInsight(data);
            }
        } catch (error) {
        }
    };

    const selectStudent = (student) => {
        setSelectedStudent(student);
        removeFieldError('student');
        fetchBehavioralInsight(student);
    };

    const validate = () => {
        const nextErrors = {};

        if (!selectedStudent?._id) {
            nextErrors.student = 'Please select a student.';
        } else if (String(selectedStudent.className || '') !== String(formData.class || '')) {
            nextErrors.student = 'The selected student is stale. Re-select a student from the current class.';
        } else if (formData.section && String(selectedStudent.section || '') !== String(formData.section || '')) {
            nextErrors.student = 'Selected student is not in the chosen section. Please select another student.';
        }

        if (!formData.category) {
            nextErrors.category = 'Choose the incident category to continue.';
        }

        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv']);
        let hasFileError = false;

        const hasEvidenceTypeWithoutFile = evidenceEntries.some((entry) => entry.evidenceType && !entry.file);
        if (hasEvidenceTypeWithoutFile) {
            nextErrors.evidence = 'Please upload the corresponding file for the selected evidence type.';
            hasFileError = true;
        } else if (evidenceEntries.some((entry) => entry.file && !entry.evidenceType)) {
            nextErrors.evidence = 'Please select an evidence type for each uploaded file.';
            hasFileError = true;
        }

        if (!hasFileError) {
            for (const entry of evidenceEntries) {
                if (entry.file) {
                    const ext = entry.file.name.slice(entry.file.name.lastIndexOf('.')).toLowerCase();
                    if (!allowedExtensions.has(ext)) {
                        nextErrors.evidence = `File type not allowed for file: ${entry.file.name}`;
                        break;
                    }
                    if (entry.file.size > maxFileSize) {
                        nextErrors.evidence = `File size exceeds 10MB limit: ${entry.file.name}`;
                        break;
                    }
                }
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const buildIncidentPayload = (shouldGenerateLetter, manualTimingPayload = null) => {
        const data = new FormData();
        Object.keys(formData).forEach((key) => {
            // Teachers cannot assign handlers — strip the field before sending.
            if (key === 'assignedHandler' && !isAdministrationUser) return;
            data.append(key, formData[key] ?? '');
        });

        data.append('studentId', selectedStudent?._id || '');
        data.append('admissionNo', selectedStudent?.admissionNo || '');
        data.append('title', formData.category);
        data.append('shouldGenerateLetter', shouldGenerateLetter ? 'true' : 'false');

        if (shouldGenerateLetter) {
            data.append('letterLanguage', letterLanguage);
        }

        if (manualTimingPayload) {
            data.append('manualTiming', 'true');
            data.append('initialStatus', manualTimingPayload.status);
            data.append('openedAt', manualTimingPayload.openedAt);
            if (manualTimingPayload.inProgressAt) data.append('inProgressAt', manualTimingPayload.inProgressAt);
            if (manualTimingPayload.closedAt) data.append('closedAt', manualTimingPayload.closedAt);
        }

        const uploadableEvidenceEntries = evidenceEntries.filter((entry) => entry.evidenceType && entry.file);
        const evidencePayload = uploadableEvidenceEntries.map((entry) => ({
            evidenceType: entry.evidenceType,
        }));

        data.append('evidenceDetails', JSON.stringify(evidencePayload));

        uploadableEvidenceEntries.forEach((entry) => data.append('evidence', entry.file));

        return data;
    };

    const handleSuccessResponse = (responseData, shouldGenerateLetter) => {
        if (responseData.success && responseData.createdCount === 0) {
            setErrors((current) => ({
                ...current,
                submit: 'Failed to create incident. No valid records were inserted.',
            }));
            setLoading(false);
            return;
        }

        setSubmitSuccess(true);
        void clearCreateIncidentDraft(user);

        if (responseData.letterGenerated) {
            setLetterInfo(responseData.letterGenerated);
            addToast(responseData.letterMessage || 'Incident and official letter created successfully.', 'success');
            setTimeout(() => navigate('/issued-letters'), 3000);
        } else {
            if (shouldGenerateLetter) {
                addToast('Incident saved, but the letter could not be created. Please try again or contact ICT support.', 'error');
            } else {
                addToast('Incident created successfully.', 'success');
            }
            setTimeout(() => navigate('/incidents'), 1200);
        }
    };

    const submitIncident = async (shouldGenerateLetter, manualTimingPayload = null) => {
        const confirmed = await confirm({
            tone: 'info',
            title: 'Submit Incident Report',
            description: `Submit an incident record for ${selectedStudent?.name || 'the selected student'}? You can add progress notes later from the incident detail page.`,
            confirmLabel: 'Submit Incident',
        });
        if (!confirmed) {
            return;
        }

        setLoading(true);
        setUploadProgress(0);
        setSubmitSuccess(false);
        setLetterInfo(null);
        closeLetterPermission();

        try {
            const data = buildIncidentPayload(shouldGenerateLetter, manualTimingPayload);
            const response = await apiClient.post(`/api/incidents`, data, {
                headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percentCompleted);
                    }
                }
            });
            handleSuccessResponse(response.data, shouldGenerateLetter);
        } catch (error) {
            setErrors((currentErrors) => ({
                ...currentErrors,
                submit: error.response?.data?.message || 'Failed to save this incident. Please review the form and try again.',
            }));
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const validateManualSetup = () => {
        if (!manualSetup.openedAt?.date) {
            return 'Opened date is required.';
        }

        if (manualSetup.status === 'Closed' && !manualSetup.closedAt?.date) {
            return 'Closed date is required when the status is Closed.';
        }

        return '';
    };

    const buildManualTimingPayload = () => ({
        status: manualSetup.status,
        openedAt: manualValueToDayjs(manualSetup.openedAt)?.toISOString(),
        closedAt: manualValueToDayjs(manualSetup.closedAt)?.toISOString(),
    });

    const handleManualSetupPrimary = async () => {
        const manualError = validateManualSetup();
        if (manualError) {
            setErrors((currentErrors) => ({ ...currentErrors, manualTiming: manualError }));
            return;
        }

        removeFieldError('manualTiming');

        const payload = buildManualTimingPayload();
        setManualTiming(true);
        setIsManualTimeFinalized(true);

        closeModal();

        if (modal.mode === 'edit') {
            addToast('Manual setup saved. It will be used when you submit the incident.', 'success');
            return;
        }

        const matchingTemplate =
            categoryTemplateStatus.checkedCategory === formData.category
                ? categoryTemplateStatus.templates
                : await checkLetterTemplate(formData.category);

        if (hasAvailableLetterTemplate(matchingTemplate)) {
            openLetterPermission(matchingTemplate, payload);
            return;
        }

        await submitIncident(false, payload);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrors({});

        if (!validate()) return;

        const matchingTemplate =
            categoryTemplateStatus.checkedCategory === formData.category
                ? categoryTemplateStatus.templates
                : await checkLetterTemplate(formData.category);

        if (manualTiming) {
            const manualError = validateManualSetup();
            if (manualError || !isManualTimeFinalized) {
                if (manualError) {
                    setErrors((currentErrors) => ({ ...currentErrors, manualTiming: manualError }));
                }
                openManualSetupModal('submit');
                return;
            }

            const manualTimingPayload = buildManualTimingPayload();

            if (hasAvailableLetterTemplate(matchingTemplate)) {
                openLetterPermission(matchingTemplate, manualTimingPayload);
                return;
            }

            await submitIncident(false, manualTimingPayload);
            return;
        }

        if (hasAvailableLetterTemplate(matchingTemplate)) {
            openLetterPermission(matchingTemplate);
            return;
        }

        await submitIncident(false);
    };

    const handleViewStudentDetails = () => {
        const admissionNo = selectedStudent?.admissionNo || behavioralInsight?.admissionNo;
        if (!admissionNo) {
            setBehavioralInsight(null);
            navigate('/student-analytics');
            return;
        }
        setBehavioralInsight(null);
        navigate(`/student-analytics/${encodeURIComponent(admissionNo)}`);
    };

    const categoryHasTemplate = hasAvailableLetterTemplate(categoryTemplateStatus.templates);

    return (
        <div className="flex bg-slate-100">
            <div className="flex min-w-0 flex-1 flex-col">

                {modal.open && ['category', 'location', 'evidence'].includes(modal.type) && (
                    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
                        <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-6 py-4">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    {modal.mode === 'edit' ? 'Rename ' : 'Add New '}
                                    {modal.type === 'category'
                                        ? 'Incident Category'
                                        : modal.type === 'location'
                                        ? 'Location'
                                        : 'Evidence Type'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    {modal.mode === 'edit'
                                        ? 'This renames the shared option and updates existing incident records that use it.'
                                        : 'This updates the shared master list used across the module.'}
                                </p>
                            </div>

                            <div className="space-y-4 p-6">
                                <input
                                    value={modal.value}
                                    onChange={(event) => setModal((current) => ({ ...current, value: event.target.value }))}
                                    placeholder={
                                        modal.type === 'category'
                                            ? 'e.g., Bullying'
                                            : modal.type === 'location'
                                            ? 'e.g., Corridor'
                                            : 'e.g., Parent Letter'
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                    autoFocus
                                />

                                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveMeta}
                                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                                    >
                                        {modal.mode === 'edit' ? 'Save Rename' : 'Save Option'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {modal.type === 'manualTiming' && modal.open && (
                    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
                        <div className="my-auto flex w-full max-w-3xl max-h-[min(92dvh,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                                        <Clock3 className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">Custom Date & Progress</h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Date is required; time is optional. If time is blank, midnight is used.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
                                {errors.manualTiming && <StatusBanner type="error">{errors.manualTiming}</StatusBanner>}

                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Initial Status</p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        {['Pending', 'Closed'].map((status) => {
                                            const isActive = manualSetup.status === status;
                                            return (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() =>
                                                        updateManualSetup((current) => ({
                                                            ...current,
                                                            status,
                                                        }))
                                                    }
                                                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                                        isActive
                                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {status}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <ManualDateTimeField
                                        label="Opened Timeline"
                                        required
                                        value={normalizeManualValue(manualSetup.openedAt)}
                                        onChange={(value) =>
                                            updateManualSetup((current) => ({
                                                ...current,
                                                openedAt: value,
                                            }))
                                        }
                                        description="When the incident was first reported. The date is required."
                                    />



                                    {manualSetup.status === 'Closed' && (
                                        <ManualDateTimeField
                                            label="Closed Timeline"
                                            required
                                            value={normalizeManualValue(manualSetup.closedAt)}
                                            onChange={(value) =>
                                                updateManualSetup((current) => ({
                                                    ...current,
                                                    closedAt: value,
                                                }))
                                            }
                                            description="When the incident was resolved."
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleManualSetupPrimary}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                                >
                                    <Check className="h-4 w-4" />
                                    {modal.mode === 'submit' ? 'Continue' : 'Save Dates'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {letterPermission.open && (
                    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
                        <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                                        <Mail className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">Create Official Letter?</h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            A letter file is available for {letterPermission.categoryName || 'this category'}.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5 p-6">
                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                                    <p>
                                        Create the official letter for{' '}
                                        <strong>{selectedStudent?.name || 'the selected student'}</strong> in the{' '}
                                        <strong>{letterPermission.categoryName}</strong> category?
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-800">Available Languages</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {letterPermission.templates?.en && (
                                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                English ready
                                            </span>
                                        )}
                                        {letterPermission.templates?.ta && (
                                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                Tamil ready
                                            </span>
                                        )}
                                        {!letterPermission.templates?.en && !letterPermission.templates?.ta && (
                                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                                No letter files are uploaded for this category yet.
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setLetterLanguage('en')}
                                            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                                letterLanguage === 'en'
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            English
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLetterLanguage('ta')}
                                            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                                letterLanguage === 'ta'
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            Tamil
                                        </button>
                                    </div>

                                    {!letterPermission.templates?.[letterLanguage] && (
                                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                                            {letterLanguage === 'ta'
                                                ? 'Tamil letter file is not available for this category.'
                                                : 'English letter file is not available for this category.'}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-3">
                                    <button
                                        type="button"
                                        disabled={!letterPermission.templates?.[letterLanguage] || loading}
                                        onClick={() => submitIncident(true, letterPermission.manualTiming)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                    >
                                        <Check className="h-4 w-4" />
                                        Create Letter and Submit
                                    </button>

                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => submitIncident(false, letterPermission.manualTiming)}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Submit Without Letter
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeLetterPermission();
                                        }}
                                        className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {behavioralInsight && (
                    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
                        <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                                        <History className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">Student Context</h3>
                                        <p className="mt-1 text-sm text-slate-600">{behavioralInsight.studentName}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 p-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <MetricCard
                                        icon={AlertTriangle}
                                        label="Total Incidents"
                                        value={behavioralInsight.totalIncidents || 0}
                                        tone="blue"
                                    />
                                    <MetricCard
                                        icon={Mail}
                                        label="Issued Letters"
                                        value={behavioralInsight.totalLetters || 0}
                                        tone="indigo"
                                    />
                                </div>

                                {behavioralInsight.riskLevel && (
                                    <div
                                        className={`rounded-xl border px-4 py-3 text-sm ${
                                            behavioralInsight.riskLevel === 'Red'
                                                ? 'border-red-200 bg-red-50 text-red-900'
                                                : behavioralInsight.riskLevel === 'Yellow'
                                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        }`}
                                    >
                                        <p className="font-semibold">Attention Level: {behavioralInsight.riskLevel}</p>
                                        <p className="mt-1 text-xs">
                                            {behavioralInsight.riskLevel === 'Red'
                                                ? 'High frequency of incidents recorded for this student.'
                                                : behavioralInsight.riskLevel === 'Yellow'
                                                ? 'Moderate incident history found for this student.'
                                                : 'Low incident history found for this student.'}
                                        </p>
                                    </div>
                                )}

                                {formData.category &&
                                    behavioralInsight.categoryBreakdown &&
                                    behavioralInsight.categoryBreakdown[formData.category] && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                                            <p className="font-semibold">Same Category Reminder</p>
                                            <p className="mt-1">
                                                Previous <strong>{formData.category}</strong> incidents:{' '}
                                                <strong>{behavioralInsight.categoryBreakdown[formData.category]}</strong>.
                                            </p>
                                        </div>
                                    )}

                                {behavioralInsight.lastIncident && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                        <p className="font-semibold text-slate-900">Most Recent Incident</p>
                                        <p className="mt-1">
                                            {behavioralInsight.lastIncident.category} on{' '}
                                            {dayjs(
                                                behavioralInsight.lastIncident.openedAt ||
                                                    behavioralInsight.lastIncident.createdAt
                                            ).format('DD MMM YYYY')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleViewStudentDetails}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                                    >
                                        View Details
                                    </button>
                                <button
                                    type="button"
                                    onClick={() => setBehavioralInsight(null)}
                                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                                >
                                    Acknowledge
                                </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <main className="create-incident-workspace min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:p-4 lg:p-6">
                    <div className="mx-auto w-full max-w-[1520px] min-w-0 space-y-4">
                        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_42px_rgba(15,23,42,0.07)]">
                            <div className="create-incident-hero px-5 py-5 sm:px-6">
                                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                                            <FileText className="h-3.5 w-3.5" />
                                            Incident Management
                                        </div>
                                        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Create Incident</h1>
                                        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
                                            Create and submit incident reports.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveDraft}
                                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                        >
                                            <Save className="h-4 w-4" />
                                            Save Draft
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDiscardDraft}
                                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Discard Draft
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="create-stepper grid gap-0 border-t border-slate-200 bg-white sm:grid-cols-5">
                                {wizardSteps.map((step, index) => (
                                    <div
                                        key={step.label}
                                        className={`relative flex min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                                            step.active ? 'bg-blue-50/60' : step.complete ? 'bg-emerald-50/40' : ''
                                        }`}
                                        aria-current={step.active ? 'step' : undefined}
                                    >
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                            step.complete
                                                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                                                : step.active
                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                                    : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {step.complete ? <Check className="h-4 w-4" /> : index + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className={`block truncate text-sm font-bold ${step.active ? 'text-blue-900' : step.complete ? 'text-emerald-900' : 'text-slate-700'}`}>{step.label}</span>
                                            <span className="mt-0.5 hidden truncate text-xs text-slate-500 md:block">{step.helper}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
                            {errors.submit && <StatusBanner type="error">{errors.submit}</StatusBanner>}

                            {submitSuccess && (
                                <StatusBanner type="success">
                                    Incident reported successfully. Redirecting now.
                                </StatusBanner>
                            )}

                            {letterInfo && (
                                <StatusBanner type="info">
                                    <p>
                                        Letter <strong>{letterInfo.letterNumber}</strong> was created with the layout{' '}
                                        <strong>{letterInfo.templateName}</strong>.
                                    </p>
                                </StatusBanner>
                            )}

                            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
                                <SectionCard
                                    icon={Users}
                                    title="Student Selection"
                                    description="Choose a class to load students, then optionally narrow by section or search."
                                    step={1}
                                >
                                    <div className="space-y-4">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-800">Class</label>
                                                <select
                                                    value={formData.class}
                                                    onChange={(event) =>
                                                        setFormData((current) => ({
                                                            ...current,
                                                            class: event.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                                >
                                                    <option value="">Select class</option>
                                                    {dbOptions.classes?.map((className) => (
                                                        <option key={className} value={className}>
                                                            {className}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-800">Section</label>
                                                <select
                                                    value={formData.section}
                                                    onChange={(event) =>
                                                        setFormData((current) => ({
                                                            ...current,
                                                            section: event.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                                >
                                                    <option value="">Select section</option>
                                                    {dbOptions.sections?.map((section) => (
                                                        <option key={section} value={section}>
                                                            {section}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <label className="mb-2 block text-sm font-semibold text-slate-800">Search Student</label>
                                            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={studentSearch}
                                                onChange={(event) => setStudentSearch(event.target.value)}
                                                placeholder="Search by student name or admission number"
                                                aria-invalid={Boolean(errors.student)}
                                                disabled={!formData.class}
                                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400"
                                            />
                                            {studentSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setStudentSearch('')}
                                                    className="absolute bottom-3 right-3 text-slate-400 transition hover:text-slate-600"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {selectedStudent && (
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-blue-900">Selected student</p>
                                                        <p className="mt-1 truncate text-sm text-blue-800">
                                                            {selectedStudent.name} #{selectedStudent.admissionNo}
                                                        </p>
                                                    </div>
                                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                                        {selectedStudent.className || formData.class}-{selectedStudent.section || formData.section || 'Section'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {!formData.class ? (
                                            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                                                    <Users className="h-5 w-5 text-indigo-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700">No students loaded yet.</p>
                                                    <p className="mt-1 text-xs text-slate-400">Select a class above to load the student list.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-semibold text-slate-500">Only one student can be selected.</p>
                                                    <p className="text-xs font-semibold text-slate-500">{filteredStudents.length} shown</p>
                                                </div>

                                                <div className="h-[260px] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-2 custom-scrollbar">
                                                    {fetchingStudents ? (
                                                        <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-slate-500">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Loading students…
                                                        </div>
                                                    ) : filteredStudents.length === 0 ? (
                                                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                                            {emptyStudentListMessage}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {filteredStudents.map((student) => {
                                                                const isSelected = selectedStudent?._id === student._id;

                                                                return (
                                                                    <button
                                                                        key={student._id}
                                                                        type="button"
                                                                        onClick={() => selectStudent(student)}
                                                                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                                                                            isSelected
                                                                                ? 'border-indigo-300 bg-indigo-600 text-white'
                                                                                : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-200 hover:bg-indigo-50'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                                                                                    <span className="truncate text-sm font-semibold">{student.name}</span>
                                                                                </div>
                                                                                <p
                                                                                    className={`mt-1 truncate text-xs ${
                                                                                        isSelected ? 'text-indigo-100' : 'text-slate-500'
                                                                                    }`}
                                                                                >
                                                                                    Admission Number: {student.admissionNo}
                                                                                </p>
                                                                            </div>

                                                                            <span
                                                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                                                    isSelected
                                                                                        ? 'bg-white/15 text-white'
                                                                                        : 'bg-slate-100 text-slate-600'
                                                                                }`}
                                                                            >
                                                                                {student.className || formData.class}-{student.section || formData.section}
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {errors.student && <p className="text-sm font-medium text-red-600">{errors.student}</p>}
                                            </div>
                                        )}
                                    </div>
                                </SectionCard>

                                <div className="space-y-4">
                                    <SectionCard
                                        icon={Tag}
                                        title="Incident Details"
                                        description="Category is required. Location and description are optional."
                                        step={2}
                                    >
                                        <div className="space-y-4">
                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-800">
                                                    Incident Category <span className="text-red-500">*</span>
                                                </label>

                                                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                                                    <select
                                                        value={selectedCategoryId || formData.category}
                                                        onChange={(event) => handleCategoryChange(event.target.value)}
                                                        aria-invalid={Boolean(errors.category)}
                                                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 ${
                                                            errors.category ? 'border-red-300' : 'border-slate-200'
                                                        }`}
                                                    >
                                                        <option value="">Select category</option>
                                                        {categories.map((category) => (
                                                            <option
                                                                key={String(getOptionId(category))}
                                                                value={String(getOptionId(category) || getOptionLabel(category))}
                                                            >
                                                                {getOptionLabel(category)}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openMetaModal('category')}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            <PlusCircle className="h-4 w-4" />
                                                            Add
                                                        </button>
                                                    )}

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            disabled={!selectedCategory}
                                                            onClick={() => openEditMetaModal('category', selectedCategory)}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </button>
                                                    )}

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            disabled={!formData.category}
                                                            onClick={() => {
                                                                const currentCategory = categories.find(
                                                                    (category) => getOptionLabel(category) === formData.category
                                                                );
                                                                if (currentCategory) {
                                                                    handleDeleteMeta(
                                                                        'category',
                                                                        currentCategory._id,
                                                                        currentCategory.name
                                                                    );
                                                                }
                                                            }}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>

                                                {errors.category && <p className="mt-2 text-sm font-medium text-red-600">{errors.category}</p>}

                                                <div
                                                    className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                                                        categoryTemplateStatus.loading
                                                            ? 'border-blue-200 bg-blue-50 text-blue-900'
                                                            : categoryTemplateStatus.error
                                                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                            : categoryHasTemplate
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                                            : 'border-slate-200 bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    {categoryTemplateStatus.loading ? (
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Checking whether an official letter is available for this category…
                                                        </div>
                                                    ) : categoryTemplateStatus.error ? (
                                                        <p>{categoryTemplateStatus.error}</p>
                                                    ) : categoryHasTemplate ? (
                                                        <div className="flex flex-col gap-2">
                                                            <p className="font-semibold">An official letter file is ready for this category.</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {categoryTemplateStatus.templates.en && (
                                                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                                                        English ready
                                                                    </span>
                                                                )}
                                                                {categoryTemplateStatus.templates.ta && (
                                                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                                                        Tamil ready
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : formData.category ? (
                                                        <p>
                                                            {categoryTemplateStatus.message ||
                                                                'No official letter file is set up for this category. The report can be saved without creating a letter.'}
                                                        </p>
                                                    ) : (
                                                        <p>Choose a category to see whether an official letter can be created.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-800">Location</label>

                                                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                                                    <select
                                                        value={formData.location}
                                                        onChange={(event) =>
                                                            setFormData((current) => ({
                                                                ...current,
                                                                location: event.target.value,
                                                            }))
                                                        }
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                                    >
                                                        <option value="">Select location</option>
                                                        {locations.map((location) => (
                                                            <option key={String(getOptionId(location))} value={getOptionLabel(location)}>
                                                                {getOptionLabel(location)}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openMetaModal('location')}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            <PlusCircle className="h-4 w-4" />
                                                            Add
                                                        </button>
                                                    )}

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            disabled={!formData.location}
                                                            onClick={() => {
                                                                const currentLocation = locations.find(
                                                                    (location) => getOptionLabel(location) === formData.location
                                                                );
                                                                if (currentLocation) {
                                                                    openEditMetaModal('location', currentLocation);
                                                                }
                                                            }}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </button>
                                                    )}

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            disabled={!formData.location}
                                                            onClick={() => {
                                                                const currentLocation = locations.find(
                                                                    (location) => getOptionLabel(location) === formData.location
                                                                );
                                                                if (currentLocation) {
                                                                    handleDeleteMeta(
                                                                        'location',
                                                                        currentLocation._id,
                                                                        currentLocation.name
                                                                    );
                                                                }
                                                            }}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-800">Description</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(event) =>
                                                        setFormData((current) => ({
                                                            ...current,
                                                            description: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Describe the incident in a clear and factual way."
                                                    className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onMouseDown={(e) => {
                                                    // Avoid focus-induced scroll jumps on toggle
                                                    e.preventDefault();
                                                }}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    handleHighPriorityToggle(!formData.isHighPriority);
                                                }}
                                                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                                                    formData.isHighPriority
                                                        ? 'border-amber-300 bg-amber-50'
                                                        : 'border-slate-200 bg-slate-50 hover:border-amber-200'
                                                }`}
                                                aria-pressed={formData.isHighPriority}
                                            >
                                                <span
                                                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border transition ${
                                                        formData.isHighPriority
                                                            ? 'border-amber-500 bg-amber-500 text-white'
                                                            : 'border-amber-300 bg-white text-transparent'
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </span>

                                                <span>
                                                    <span className="text-sm font-semibold text-slate-900">High Priority</span>
                                                    <span className="mt-1 block text-sm text-slate-600">
                                                        Flag this incident when it requires urgent administrative attention.
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                    </SectionCard>

                                    {canUseManualTiming && (
                                    <SectionCard
                                        icon={ShieldCheck}
                                        title={isAdministrationUser ? 'Handler Assignment' : 'Manual Time Setup'}
                                        description={isAdministrationUser ? 'Assign a handler or configure custom dates.' : 'Configure custom incident dates.'}
                                        step={3}
                                    >
                                        <div className="space-y-4">
                                            {isAdministrationUser && (
                                                <div>
                                                    <label className="mb-2 block text-sm font-semibold text-slate-800">Assigned Handler</label>
                                                    <select
                                                        value={formData.assignedHandler}
                                                        onChange={(event) =>
                                                            setFormData((current) => ({
                                                                ...current,
                                                                assignedHandler: event.target.value,
                                                            }))
                                                        }
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                                    >
                                                        <option value="">No assignment yet.</option>
                                                        {staffList.map((staff) => (
                                                            <option key={staff._id} value={staff._id}>
                                                                {staff.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="mt-1.5 text-xs text-slate-500">
                                                        Assign this incident to a teacher. Leave blank to keep it in the Admin pool.
                                                    </p>
                                                </div>
                                            )}

                                            <div
                                                    className={`rounded-xl border p-4 ${
                                                    manualTiming ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="max-w-xl">
                                                        <p className="text-base font-semibold text-slate-900">Custom Date & Progress</p>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Turn this on when the incident happened on an earlier date or you need to set the status dates yourself. The date is required; time is optional.
                                                        </p>

                                                        {manualTiming ? (
                                                            <div className="mt-4 grid gap-2 text-xs text-indigo-900">
                                                                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-indigo-200">
                                                                    Status: {manualSetup.status}
                                                                </span>
                                                                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-indigo-200">
                                                                    Opened: {formatManualSummary(manualSetup.openedAt)}
                                                                </span>

                                                                {manualSetup.status === 'Closed' && (
                                                                    <span className="rounded-full bg-white px-3 py-1 ring-1 ring-indigo-200">
                                                                        Closed: {formatManualSummary(manualSetup.closedAt)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                                                Automatic timeline is currently active. Open manual setup only when you need a custom date workflow.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                                                        <button
                                                            type="button"
                                                            onClick={() => openManualSetupModal('edit')}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                                                        >
                                                            <Clock3 className="h-4 w-4" />
                                                            {manualTiming ? 'Edit Dates & Progress' : 'Open Date & Progress'}
                                                        </button>

                                                        {manualTiming && (
                                                            <button
                                                                type="button"
                                                                onClick={clearManualSetup}
                                                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Remove Custom Dates
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </SectionCard>
                                    )}
                                </div>
                            </div>

                            <SectionCard
                                icon={FileImage}
                                title="Evidence & Attachments"
                                description="Optional. Map each file to an evidence type before submitting."
                                step={4}
                                action={
                                    isPrivilegedUser ? (
                                        <button
                                            type="button"
                                            onClick={() => openMetaModal('evidence')}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                            Add New Evidence Type
                                        </button>
                                    ) : null
                                }
                            >
                                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                    {evidenceEntries.map((entry, index) => {
                                        const selectedEvidenceTypeLabel = evidenceTypeDisplayLabels[index] || entry.evidenceType;

                                        return (
                                        <div key={`evidence-${index}`} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900">Evidence {index + 1}</p>
                                                    {selectedEvidenceTypeLabel ? (
                                                        <p className="mt-0.5 truncate text-xs font-semibold text-blue-700">{selectedEvidenceTypeLabel}</p>
                                                    ) : null}
                                                </div>
                                                {evidenceEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveEvidenceEntry(index)}
                                                        className="rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-red-600"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="mt-4 space-y-3">
                                                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
                                                    <select
                                                        value={entry.evidenceType}
                                                        onChange={(event) => handleEvidenceTypeChange(index, event.target.value)}
                                                        aria-invalid={Boolean(errors.evidence)}
                                                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 ${
                                                            errors.evidence ? 'border-red-300' : 'border-slate-200'
                                                        }`}
                                                    >
                                                        <option value="">Select Evidence Type</option>
                                                        {evidenceTypes.map((type) => {
                                                            const optionLabel = getOptionLabel(type);
                                                            const displayLabel = optionLabel === entry.evidenceType
                                                                ? selectedEvidenceTypeLabel
                                                                : optionLabel;

                                                            return (
                                                            <option key={String(getOptionId(type))} value={optionLabel}>
                                                                {displayLabel}
                                                            </option>
                                                            );
                                                        })}
                                                    </select>

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            disabled={!entry.evidenceType}
                                                            onClick={() => {
                                                                const currentType = evidenceTypes.find(
                                                                    (type) => getOptionLabel(type) === entry.evidenceType
                                                                );
                                                                if (currentType) {
                                                                    openEditMetaModal('evidence', currentType);
                                                                }
                                                            }}
                                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </button>
                                                    )}

                                                    {isPrivilegedUser && (
                                                        <button
                                                            type="button"
                                                            disabled={!entry.evidenceType}
                                                            onClick={() => {
                                                                const currentType = evidenceTypes.find(
                                                                    (type) => getOptionLabel(type) === entry.evidenceType
                                                                );
                                                                if (currentType) {
                                                                    handleDeleteMeta(
                                                                        'evidence',
                                                                        currentType._id,
                                                                        currentType.name
                                                                    );
                                                                }
                                                            }}
                                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>

                                                                <label className="group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-5 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/60 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                                                        <Camera className="h-5 w-5 text-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <p className="break-all text-sm font-semibold text-slate-800">
                                                            {entry.file ? entry.file.name : 'Click to attach file'}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-400">
                                                            Images, PDFs, Word, Excel, and CSV — maximum file size: 10 MB
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                                        className="sr-only"
                                                        aria-label={`Upload evidence file ${index + 1}`}
                                                        onChange={(event) => {
                                                            const nextFile = event.target.files?.[0];
                                                            if (nextFile) {
                                                                handleEvidenceFileChange(index, nextFile);
                                                            }
                                                            event.target.value = '';
                                                        }}
                                                    />
                                                </label>

                                                {entry.file && (
                                                    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="min-w-0">
                                                            <p className="break-all text-sm font-semibold text-slate-900">
                                                                {entry.file.name}
                                                            </p>
                                                            <p className="text-xs text-slate-500">Selected Attachment</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveEvidenceFile(index)}
                                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50"
                                                            aria-label={`Remove ${entry.file.name}`}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}

                                                {entry.preview && (
                                                    <img
                                                        src={entry.preview}
                                                        alt=""
                                                        className="h-36 w-full rounded-xl border border-slate-200 object-cover"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>

                                {errors.evidence && <p className="mt-3 text-sm font-medium text-red-600">{errors.evidence}</p>}

                                <button
                                    type="button"
                                    onClick={handleAddEvidenceEntry}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Add Another Evidence Item
                                </button>
                            </SectionCard>

                            <section aria-label="Submit incident" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3.5">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                                            5
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-base font-bold text-slate-900">Review & Submit</p>
                                            <p className="break-words text-xs text-slate-500">Confirm the summary, save a draft, or submit the report.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                                    <div className="grid min-w-0 gap-3 md:grid-cols-3">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Selected Student</p>
                                            <p className="mt-2 truncate text-sm font-bold text-slate-900">
                                                {selectedStudent ? selectedStudent.name : 'No student selected'}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-slate-500">
                                                {selectedStudent ? `Admission No: ${selectedStudent.admissionNo}` : 'Choose a student in step 1'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Incident Summary</p>
                                            <p className="mt-2 truncate text-sm font-bold text-slate-900">
                                                {formData.category || 'No category selected'}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-slate-500">
                                                {formData.location || 'No location selected'}{formData.isHighPriority ? ' | High priority' : ''}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence Count</p>
                                            <p className="mt-2 text-sm font-bold text-slate-900">
                                                {evidenceEntries.filter((entry) => entry.evidenceType && entry.file).length} ready
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {evidenceEntries.length} item{evidenceEntries.length === 1 ? '' : 's'} in the workspace
                                            </p>
                                        </div>
                                        <div className="hidden">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                                            selectedStudent
                                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-200 bg-slate-50 text-slate-500'
                                        }`}>
                                            <Users className="h-3.5 w-3.5" />
                                            {selectedStudent ? selectedStudent.name : 'No student selected'}
                                        </span>
                                        {formData.category && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                                <Tag className="h-3.5 w-3.5" />
                                                {formData.category}
                                            </span>
                                        )}
                                        </div>
                                        {uploadProgress > 0 && uploadProgress < 100 && (
                                            <div className="flex items-center gap-2 md:col-span-3">
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                                                    <div
                                                        className="h-full rounded-full bg-blue-500 transition-all duration-200"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-semibold tabular-nums text-slate-500">{uploadProgress}%</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSaveDraft}
                                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        Save Draft
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDiscardDraft}
                                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Discard Draft
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || submitSuccess}
                                        className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-blue-500/25 transition-all duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400 sm:w-auto"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                                        {loading
                                            ? uploadProgress > 0 && uploadProgress < 100
                                                ? `Uploading… ${uploadProgress}%`
                                                : uploadProgress === 100
                                                    ? 'Processing…'
                                                    : 'Creating Incident…'
                                            : submitSuccess
                                                ? 'Incident created ✓'
                                                : 'Submit Incident'}
                                    </button>
                                    </div>
                                </div>
                            </section>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CreateIncident;
