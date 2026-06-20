import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../config/apiClient';
import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    Edit3,
    Eye,
    EyeOff,
    Loader2,
    Plus,
    RefreshCw,
    Shield,
    KeyRound,
    Trash2,
    UserCheck,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT } from '../lib/validators';
import {
    AnalyticsDataTable,
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
} from '../components/analytics/DashboardPrimitives';
import { UnifiedFilterBar, UnifiedMultiSelect, UnifiedSearchInput } from '../components/UnifiedFilters';
import BulkDeleteControls from '../components/BulkDeleteControls';
import { normalizeRole } from '../utils/roles';
import { buildAcademicYearOptions, formatDisplayValue } from '../utils/analytics';

const EDITABLE_ROLE_OPTIONS = ['Admin', 'Teacher'];
const getCreateRoleOptions = (role) => (role === 'Super Admin' ? EDITABLE_ROLE_OPTIONS : ['Teacher']);
const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const PAGE_SIZE = 8;

const INPUT_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all duration-300 placeholder:text-slate-400 invalid:border-red-400 invalid:ring-2 invalid:ring-red-100 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-none dark:invalid:border-red-500 dark:invalid:ring-red-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';
const READONLY_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:shadow-none';

const getRoleGroup = (role) => {
    const normalizedRole = normalizeRole(role);
    if (['Super Admin', 'Admin'].includes(normalizedRole)) return 'Admin';
    return 'Teacher';
};
const isStrongPassword = (password) =>
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH;

const formatDate = (value) => {
    if (!value) return 'Not available';

    return new Date(value).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const getPassedOutYear = (student) => {
    const history = Array.isArray(student?.history) ? student.history : [];
    const passedOutEntry = [...history].reverse().find((entry) => entry?.status === 'Passed Out');
    return passedOutEntry?.academicYear || (student?.status === 'Passed Out' ? student?.academicYear : '') || 'N/A';
};

const getRoleBadgeTone = (role) => {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === 'Super Admin') return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/10 dark:text-purple-200';
    if (normalizedRole === 'Admin') return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200';
    if (normalizedRole === 'Teacher') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200';
    return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
};

const RoleBadge = ({ role }) => {
    const normalizedRole = normalizeRole(role);
    return (
    <span className="inline-flex flex-col items-start gap-1">
        <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeTone(
                role
            )}`}
        >
            {formatDisplayValue(normalizedRole || 'Teacher')}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            {getRoleGroup(role)}
        </span>
    </span>
    );
};

const ActionButton = ({ icon: Icon, label, tone = 'slate', onClick }) => {
    const toneClassName = {
        slate: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white focus-visible:ring-slate-400',
        blue: 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-100 focus-visible:ring-blue-400',
        red: 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-100 focus-visible:ring-rose-400',
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${toneClassName}`}
            aria-label={label}
            title={label}
        >
            <Icon size={16} aria-hidden="true" />
        </button>
    );
};

const PaginationFooter = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => {
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-semibold text-slate-800 dark:text-slate-100">{start}</span>–
                <span className="font-semibold text-slate-800 dark:text-slate-100">{end}</span> of{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-100">{totalItems}</span> records
            </p>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                    <ChevronLeft size={14} aria-hidden="true" />
                    Previous
                </button>

                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
                </span>

                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                    Next
                    <ChevronRight size={14} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};

const PreviewField = ({ label, value }) => (
    <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
        </label>
        <div className={READONLY_CLASS_NAME}>{value || 'Not available'}</div>
    </div>
);

const UserManagement = () => {
    const { user, restoreAuth } = useAuth();
    const { addToast } = useToast();

    const [usersList, setUsersList] = useState([]);
    const [studentRegistry, setStudentRegistry] = useState([]);
    const [temporaryPasswordResult, setTemporaryPasswordResult] = useState(null);
    const [temporaryPasswordCopied, setTemporaryPasswordCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const [activeTab, setActiveTab] = useState('staff');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState([]);
    const [classFilter, setClassFilter] = useState([]);
    const [sectionFilter, setSectionFilter] = useState([]);
    const [academicYearFilter, setAcademicYearFilter] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [staffPage, setStaffPage] = useState(1);
    const [studentPage, setStudentPage] = useState(1);
    const [studentPagination, setStudentPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [studentFilterOptions, setStudentFilterOptions] = useState({ classes: [], sections: [] });
    const [studentDirectoryTotal, setStudentDirectoryTotal] = useState(0);

    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    const [detailModal, setDetailModal] = useState({ open: false, type: 'staff', record: null });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, type: 'staff', label: '', record: null, preview: null, loadingPreview: false });

    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Teacher', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', admissionNo: '', className: '', section: '' });
    const [editStaff, setEditStaff] = useState({ _id: '', name: '', email: '', role: '' });
    const [editStudent, setEditStudent] = useState({ _id: '', name: '', admissionNo: '', className: '', section: '', academicYear: '', status: 'Active' });
    const [submittingUser, setSubmittingUser] = useState(false);
    const [submittingStudent, setSubmittingStudent] = useState(false);
    const [submittingEditStaff, setSubmittingEditStaff] = useState(false);
    const [submittingEditStudent, setSubmittingEditStudent] = useState(false);
    const [resettingPasswordId, setResettingPasswordId] = useState(null);

    const config = useMemo(() => ({ headers: {} }), []);
    const currentRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
    const createRoleOptions = useMemo(() => getCreateRoleOptions(currentRole), [currentRole]);
    const getCurrentUserId = useCallback(() => String(user?._id || user?.id || ''), [user?._id, user?.id]);
    const isSelfRecord = useCallback(
        (record) => {
            const recordId = String(record?._id || record?.id || '');
            return Boolean(recordId && recordId === getCurrentUserId());
        },
        [getCurrentUserId]
    );
    const canEditStaffUser = useCallback(
        (record) => {
            if (!record) return false;
            if (currentRole === 'Super Admin') return true;
            return isSelfRecord(record);
        },
        [currentRole, isSelfRecord]
    );
    const canDeleteStaffUser = useCallback(
        (record) => Boolean(record && currentRole === 'Super Admin' && !isSelfRecord(record)),
        [currentRole, isSelfRecord]
    );

    const copyTemporaryPassword = useCallback(async () => {
        if (!temporaryPasswordResult?.temporaryPassword) return;

        try {
            await navigator.clipboard.writeText(temporaryPasswordResult.temporaryPassword);
            setTemporaryPasswordCopied(true);
            addToast('Copied successfully.', 'success');
        } catch {
            setTemporaryPasswordCopied(false);
            addToast('Copy failed. Select the password manually.', 'error');
        }
    }, [addToast, temporaryPasswordResult?.temporaryPassword]);

    const closeTemporaryPasswordModal = useCallback(() => {
        setTemporaryPasswordResult(null);
        setTemporaryPasswordCopied(false);
    }, []);

    const loadUsers = useCallback(async () => {
        const { data } = await apiClient.get('/api/auth/users', config);
        return Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : [];
    }, [config]);

    const currentStudentStatus = activeTab === 'passedOut' ? 'Passed Out' : 'Active';

    const loadStudents = useCallback(async (selectedAcademicYear = academicYearFilter, status = currentStudentStatus) => {
        const shouldRequestYearProjection = Boolean(selectedAcademicYear);
        const params = {
            ...(shouldRequestYearProjection ? { academicYear: selectedAcademicYear } : {}),
            status,
            page: studentPage,
            limit: PAGE_SIZE,
            ...(studentSearchQuery.trim() ? { search: studentSearchQuery.trim() } : {}),
            ...(classFilter.length ? { className: classFilter.join(',') } : {}),
            ...(sectionFilter.length ? { section: sectionFilter.join(',') } : {}),
        };
        const requestConfig = { ...config, params };
        const [{ data }, { data: filterData }, { data: directoryData }] = await Promise.all([
            apiClient.get('/api/students', requestConfig),
            apiClient.get('/api/students/filters', { ...config, params: {
                ...(shouldRequestYearProjection ? { academicYear: selectedAcademicYear } : {}),
                status,
            } }),
            apiClient.get('/api/students', { ...config, params: {
                ...(shouldRequestYearProjection ? { academicYear: selectedAcademicYear } : {}),
                status,
                page: 1,
                limit: 1,
            } }),
        ]);
        return {
            students: Array.isArray(data?.data) ? data.data : [],
            pagination: data?.pagination || { page: 1, total: 0, totalPages: 1 },
            filterOptions: { classes: filterData?.classes || [], sections: filterData?.sections || [] },
            directoryTotal: directoryData?.pagination?.total || 0,
        };
    }, [academicYearFilter, classFilter, config, currentStudentStatus, sectionFilter, studentPage, studentSearchQuery]);

    const loadAcademicYears = useCallback(async () => {
        const { data } = await apiClient.get('/api/auth/academic-years', config);
        return {
            currentAcademicYear: data?.currentAcademicYear || '',
            academicYears: Array.isArray(data?.academicYears) ? data.academicYears : [],
        };
    }, [config]);

    const fetchData = useCallback(
        async (showLoader = true, options = {}) => {
            if (!user?._id) return;
            const isMounted = options.isMounted || (() => true);

            if (showLoader) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            setError(null);

            try {
                const yearResult = await Promise.allSettled([loadAcademicYears()]).then(([result]) => result);
                if (!isMounted()) return;

                let effectiveAcademicYear = academicYearFilter || currentAcademicYear;
                if (yearResult.status === 'fulfilled') {
                    setAcademicYears(yearResult.value.academicYears);
                    setCurrentAcademicYear(yearResult.value.currentAcademicYear);
                    effectiveAcademicYear = effectiveAcademicYear || yearResult.value.currentAcademicYear || yearResult.value.academicYears[yearResult.value.academicYears.length - 1] || '';
                    setAcademicYearFilter((current) => current || effectiveAcademicYear);
                }

                const [userResult, studentResult] = await Promise.allSettled([
                    loadUsers(),
                    loadStudents(effectiveAcademicYear, currentStudentStatus),
                ]);
                if (!isMounted()) return;

                if (userResult.status === 'fulfilled') {
                    setUsersList(userResult.value);
                } else {
                    setUsersList([]);
                }

                if (studentResult.status === 'fulfilled') {
                    setStudentRegistry(studentResult.value.students);
                    setStudentPagination(studentResult.value.pagination);
                    setStudentFilterOptions(studentResult.value.filterOptions);
                    setStudentDirectoryTotal(studentResult.value.directoryTotal);
                } else {
                    setStudentRegistry([]);
                }

                if (userResult.status === 'rejected') {
                    throw userResult.reason;
                }

                if (studentResult.status === 'rejected') {
                    setError(studentResult.reason?.response?.data?.message || 'Student registry could not be loaded.');
                }
            } catch (requestError) {
                if (!isMounted()) return;
                setUsersList([]);
                setError(requestError.response?.data?.message || 'Failed to load management data.');
            } finally {
                if (!isMounted()) return;
                if (showLoader) {
                    setLoading(false);
                } else {
                    setRefreshing(false);
                }
            }
        },
        [academicYearFilter, currentAcademicYear, currentStudentStatus, loadAcademicYears, loadStudents, loadUsers, user?._id]
    );

    useEffect(() => {
        let mounted = true;
        void fetchData(true, { isMounted: () => mounted });
        return () => {
            mounted = false;
        };
    }, [fetchData]);

    const summary = useMemo(() => {
        const administrationCount = usersList.filter((entry) => getRoleGroup(entry.role) === 'Admin').length;
        const teacherCount = usersList.filter((entry) => normalizeRole(entry.role) === 'Teacher').length;
        const staffCount = usersList.filter((entry) => getRoleGroup(entry.role) !== 'Admin').length;
        const passedOutCount = currentStudentStatus === 'Passed Out' ? studentPagination.total : 0;

        return {
            totalUsers: usersList.length,
            administrationCount,
            teacherCount,
            staffCount,
            totalStudents: studentDirectoryTotal,
            passedOutCount,
        };
    }, [currentStudentStatus, studentDirectoryTotal, studentPagination.total, usersList]);

    // Convert role filter options to {id, label} shape for the dropdown
    const roleFilterOptionObjects = useMemo(
        () => ['Admin', 'Teacher'].map((roleGroup) => ({ id: roleGroup, label: roleGroup })),
        []
    );

    const classFilterOptions = useMemo(
        () => studentFilterOptions.classes,
        [studentFilterOptions.classes]
    );

    const sectionFilterOptions = useMemo(
        () => studentFilterOptions.sections,
        [studentFilterOptions.sections]
    );
    const academicYearOptions = useMemo(
        () => buildAcademicYearOptions(academicYears, currentAcademicYear),
        [academicYears, currentAcademicYear]
    );

    const filteredUsers = useMemo(() => {
        let nextUsers = [...usersList];

        if (staffSearchQuery.trim()) {
            const normalizedQuery = staffSearchQuery.trim().toLowerCase();
            nextUsers = nextUsers.filter(
                (entry) =>
                    entry.name?.toLowerCase().includes(normalizedQuery) ||
                    entry.email?.toLowerCase().includes(normalizedQuery) ||
                    entry.role?.toLowerCase().includes(normalizedQuery)
            );
        }

        if (roleFilter.length > 0) {
            nextUsers = nextUsers.filter((entry) => roleFilter.includes(getRoleGroup(entry.role)));
        }

        return nextUsers;
    }, [roleFilter, staffSearchQuery, usersList]);

    const filteredStudents = studentRegistry;

    useEffect(() => {
        setStaffPage(1);
    }, [filteredUsers.length]);

    useEffect(() => {
        setStudentPage(1);
    }, [academicYearFilter, classFilter, currentStudentStatus, sectionFilter, studentSearchQuery]);

    useEffect(() => {
        if (!createRoleOptions.includes(newUser.role)) {
            setNewUser((current) => ({ ...current, role: createRoleOptions[0] || 'Teacher' }));
        }
    }, [createRoleOptions, newUser.role]);

    const totalStaffPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 0;
    const totalStudentPages = studentPagination.totalPages;

    const paginatedUsers = useMemo(
        () => filteredUsers.slice((staffPage - 1) * PAGE_SIZE, staffPage * PAGE_SIZE),
        [filteredUsers, staffPage]
    );

    const paginatedStudents = filteredStudents;

    const hasActiveStaffFilters = Boolean(staffSearchQuery.trim()) || roleFilter.length > 0;
    const hasActiveStudentFilters =
        Boolean(studentSearchQuery.trim()) || classFilter.length > 0 || sectionFilter.length > 0 || academicYearFilter !== currentAcademicYear;

    const clearStaffFilters = useCallback(() => {
        setStaffSearchQuery('');
        setRoleFilter([]);
    }, []);

    const clearStudentFilters = useCallback(() => {
        setStudentSearchQuery('');
        setClassFilter([]);
        setSectionFilter([]);
        setAcademicYearFilter(currentAcademicYear);
    }, [currentAcademicYear]);

    const applyUpdatedStudentRecord = useCallback((updatedStudent) => {
        const studentId = String(updatedStudent?._id || updatedStudent?.id || '');
        if (!studentId) return;

        setStudentRegistry((current) =>
            current.map((student) => {
                const currentId = String(student?._id || student?.id || '');
                if (currentId !== studentId) return student;

                return {
                    ...student,
                    ...updatedStudent,
                    _id: updatedStudent._id || student._id,
                    id: updatedStudent.id || student.id,
                };
            })
        );
    }, []);

    const handleAddUser = async (event) => {
        event.preventDefault();

        if (!isStrongPassword(newUser.password)) {
            addToast('Password must be at least 8 characters.', 'error');
            return;
        }

        setSubmittingUser(true);

        try {
            await apiClient.post('/api/auth/users', newUser, config);
            addToast('User created successfully.', 'success');
            setShowAddUserModal(false);
            setNewUser({ name: '', email: '', role: 'Teacher', password: '' });
            setShowPassword(false);
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to create user.', 'error');
        } finally {
            setSubmittingUser(false);
        }
    };

    const resetStaffPassword = useCallback(async (record) => {
        const staffId = record?._id || record?.id;
        if (!staffId) {
            addToast('Unable to reset password because this staff record has no ID.', 'error');
            return;
        }

        setResettingPasswordId(staffId);
        try {
            const { data } = await apiClient.post(`/api/auth/users/${staffId}/reset-password`, {}, config);
            if (!data?.temporaryPassword) {
                throw new Error('The temporary password could not be generated. Please try again.');
            }
            setTemporaryPasswordCopied(false);
            setTemporaryPasswordResult({
                ...data,
                user: data.user || record,
            });
            addToast('Temporary password generated.', 'success');
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to reset password.', 'error');
        } finally {
            setResettingPasswordId(null);
        }
    }, [addToast, config, fetchData]);

    const handleAddStudent = async (event) => {
        event.preventDefault();
        setSubmittingStudent(true);

        try {
            await apiClient.post('/api/students', newStudent, config);
            addToast('Student created successfully.', 'success');
            setShowAddStudentModal(false);
            setNewStudent({ name: '', admissionNo: '', className: '', section: '' });
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to create student.', 'error');
        } finally {
            setSubmittingStudent(false);
        }
    };

    const openDeleteDialog = useCallback((record, type) => {
        setDeleteDialog({
            open: true,
            id: record._id,
            type,
            label: type === 'staff' ? record.name : `${record.name} (${record.admissionNo})`,
            record,
            preview: null,
            loadingPreview: type === 'student',
        });
        if (type === 'student') {
            apiClient.get(`/api/students/${record._id}/delete-preview`, config)
                .then(({ data }) => {
                    setDeleteDialog((current) =>
                        current.open && current.id === record._id
                            ? { ...current, preview: data, loadingPreview: false }
                            : current
                    );
                })
                .catch((requestError) => {
                    addToast(requestError.response?.data?.message || 'Unable to prepare delete confirmation.', 'error');
                    setDeleteDialog((current) =>
                        current.open && current.id === record._id
                            ? { ...current, loadingPreview: false }
                            : current
                    );
                });
        }
    }, [addToast, config]);

    const confirmDelete = useCallback(async () => {
        try {
            const endpoint =
                deleteDialog.type === 'staff'
                    ? `/api/auth/users/${deleteDialog.id}`
                    : `/api/students/${deleteDialog.id}`;

            const { data } = await apiClient.delete(endpoint, config);
            addToast(
                data?.message || `${deleteDialog.type === 'staff' ? 'User' : 'Student'} deleted successfully.`,
                'success'
            );
            setDeleteDialog({ open: false, id: null, type: 'staff', label: '', record: null, preview: null, loadingPreview: false });
            setDetailModal({ open: false, type: 'staff', record: null });
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to delete this record.', 'error');
        }
    }, [addToast, config, deleteDialog.id, deleteDialog.type, fetchData]);

    const openDetailModal = useCallback((record, type) => {
        setDetailModal({ open: true, type, record });
        if (type === 'staff' && temporaryPasswordResult?.user?._id !== record?._id) {
            setTemporaryPasswordResult(null);
        }
        if (type === 'staff') {
            setEditStaff({
                _id: record._id || record.id,
                name: record.name || '',
                email: record.email || '',
                role: normalizeRole(record.role) || 'Teacher',
            });
        }
        if (type === 'student') {
            setEditStudent({
                _id: record._id,
                name: record.name,
                admissionNo: record.admissionNo,
                className: record.className,
                section: record.section,
                academicYear: academicYearFilter || record.academicYear || '',
                status: record.status || 'Active'
            });
        }
    }, [academicYearFilter, temporaryPasswordResult?.user?._id]);

    const handleEditStaff = async (event) => {
        event.preventDefault();
        if (!editStaff._id) return;

        const payload = {
            name: editStaff.name.trim(),
            email: editStaff.email.trim(),
        };

        const isSelf = isSelfRecord(detailModal.record);
        if (currentRole === 'Super Admin' && !isSelf) {
            payload.role = editStaff.role;
        }

        setSubmittingEditStaff(true);

        try {
            const { data } = await apiClient.put(`/api/auth/users/${editStaff._id}`, payload, config);
            addToast('User updated successfully.', 'success');
            setDetailModal({ open: false, type: 'staff', record: null });
            await fetchData(false);
            if (isSelf) {
                await restoreAuth({ silent: true });
            }
            if (data?.user && temporaryPasswordResult?.user?._id === editStaff._id) {
                setTemporaryPasswordResult((current) => current ? { ...current, user: data.user } : current);
            }
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to update user.', 'error');
        } finally {
            setSubmittingEditStaff(false);
        }
    };

    const handleEditStudent = async (event) => {
        event.preventDefault();
        setSubmittingEditStudent(true);

        try {
            const selectedEditAcademicYear = editStudent.academicYear || academicYearFilter || currentAcademicYear;
            const payload = {
                ...editStudent,
                academicYear: selectedEditAcademicYear || undefined,
                status: editStudent.status || undefined,
            };
            const { data } = await apiClient.put(`/api/students/${editStudent._id}`, payload, config);
            applyUpdatedStudentRecord(data);
            addToast('Student updated successfully.', 'success');
            setDetailModal({ open: false, type: 'student', record: null });
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to update student.', 'error');
        } finally {
            setSubmittingEditStudent(false);
        }
    };

    const staffColumns = useMemo(
        () => [
            {
                key: 'name',
                label: 'Staff Member',
                render: (row) => (
                    <div className="min-w-0 text-left">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{row?.name || 'Staff member'}</p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{row?.email || 'Email not available'}</p>
                    </div>
                ),
            },
            {
                key: 'role',
                label: 'Role',
                render: (row) => <RoleBadge role={row.role} />,
            },
            {
                key: 'createdAt',
                label: 'Joined',
                render: (row) => <span className="text-sm text-slate-600 dark:text-slate-300">{formatDate(row.createdAt)}</span>,
            },
            {
                key: 'actions',
                label: 'Actions',
                className: 'whitespace-nowrap',
                render: (row) => (
                    <div className="flex items-center gap-1">
                        <ActionButton
                            icon={Edit3}
                            label="Edit User"
                            tone="blue"
                            onClick={() => openDetailModal(row, 'staff')}
                        />
                        {canDeleteStaffUser(row) ? (
                            <ActionButton
                                icon={Trash2}
                                label="Delete User"
                                tone="red"
                                onClick={() => openDeleteDialog(row, 'staff')}
                            />
                        ) : null}
                    </div>
                ),
            },
        ],
        [canDeleteStaffUser, openDeleteDialog, openDetailModal]
    );

    const studentColumns = useMemo(
        () => [
            {
                key: 'name',
                label: 'Student',
                render: (row) => (
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">Admission Number: {row.admissionNo}</p>
                    </div>
                ),
            },
            {
                key: 'className',
                label: 'Class',
                render: (row) => <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Class {row.className}</span>,
            },
            {
                key: 'section',
                label: 'Section',
                render: (row) => (
                    <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                        Section {row.section}
                    </span>
                ),
            },
            {
                key: 'academicYear',
                label: 'Academic Year',
                render: (row) => <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{row.academicYear || 'N/A'}</span>,
            },
            ...(activeTab === 'passedOut' ? [
                {
                    key: 'passedOutYear',
                    label: 'Passed Out Year',
                    render: (row) => <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{getPassedOutYear(row)}</span>,
                },
                {
                    key: 'status',
                    label: 'Status',
                    render: (row) => (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                            {row.status || 'Passed Out'}
                        </span>
                    ),
                },
            ] : []),
            {
                key: 'createdAt',
                label: 'Added',
                render: (row) => <span className="text-sm text-slate-600 dark:text-slate-300">{formatDate(row.createdAt)}</span>,
            },
            {
                key: 'actions',
                label: 'Actions',
                className: 'whitespace-nowrap',
                render: (row) => (
                    <div className="flex items-center gap-1">
                        <ActionButton
                            icon={Edit3}
                            label="View Student Details"
                            tone="blue"
                            onClick={() => openDetailModal(row, 'student')}
                        />
                        <ActionButton
                            icon={Trash2}
                            label="Delete Student"
                            tone="red"
                            onClick={() => openDeleteDialog(row, 'student')}
                        />
                    </div>
                ),
            },
        ],
        [activeTab, openDeleteDialog, openDetailModal]
    );

    if (loading) {
        return (
            <div className="flex min-h-screen bg-slate-100 text-slate-800 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="mx-auto max-w-[1600px]">
                            <DashboardPageSkeleton />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100 text-slate-800 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Admin"
                            title="User Management"
                            description="Manage users, roles, and student records."
                            icon={Users}
                            actions={(
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddUserModal(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-all duration-300 hover:bg-blue-50 dark:bg-slate-100 dark:text-slate-950"
                                    >
                                        <UserPlus size={16} />
                                        {currentRole === 'Super Admin' ? 'Add New Admin/Teacher' : 'Add New Teacher'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddStudentModal(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/15"
                                    >
                                        <Plus size={16} />
                                        Add Student
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fetchData(false)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/15"
                                    >
                                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                                        Refresh
                                    </button>
                                </>
                            )}
                            meta={(
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                                        {summary.totalUsers} total staff accounts
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                                        {summary.totalStudents} registered students
                                    </span>
                                </div>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <DashboardStatCard title="Total Users" value={summary.totalUsers} icon={Users} tone="blue" />
                            <DashboardStatCard title="Admin" value={summary.administrationCount} icon={Shield} tone="slate" />
                            <DashboardStatCard title="Teachers" value={summary.teacherCount} icon={UserPlus} tone="emerald" />
                            <DashboardStatCard title="Students" value={summary.totalStudents} icon={UserCheck} tone="amber" />
                        </div>

                        {error ? (
                            <div className="rounded-[28px] border border-rose-200 bg-rose-50/90 px-5 py-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-2xl bg-rose-100 p-2 text-rose-600">
                                        <AlertCircle size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-rose-700">Unable to Load All Records</p>
                                        <p className="mt-1 text-sm text-rose-600">{error}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <section className="rounded-[28px] border border-white/80 bg-white/85 p-2 shadow-lg shadow-slate-200/70 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/50">
                            <div className="grid gap-2 md:grid-cols-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('staff')}
                                    aria-pressed={activeTab === 'staff'}
                                    className={`rounded-[22px] px-5 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 ${
                                        activeTab === 'staff'
                                            ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)]'
                                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                activeTab === 'staff'
                                                    ? 'bg-white/10 text-white'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Staff & Admin Directory</p>
                                            <p
                                                className={`mt-1 text-xs ${
                                                    activeTab === 'staff' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                Manage roles, access, and active staff accounts.
                                            </p>
                                        </div>
                                    </div>
                                 </button>

                                 <button
                                     type="button"
                                     onClick={() => setActiveTab('students')}
                                    aria-pressed={activeTab === 'students'}
                                    className={`rounded-[22px] px-5 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                                        activeTab === 'students'
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_18px_34px_rgba(59,130,246,0.22)]'
                                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                 >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                activeTab === 'students'
                                                    ? 'bg-white/10 text-white'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            <UserCheck size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Student Registry</p>
                                            <p
                                                className={`mt-1 text-xs ${
                                                    activeTab === 'students' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                Review admission records, classes, and sections.
                                            </p>
                                        </div>
                                    </div>
                                 </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('passedOut')}
                                    aria-pressed={activeTab === 'passedOut'}
                                    className={`rounded-[22px] px-5 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
                                        activeTab === 'passedOut'
                                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-[0_18px_34px_rgba(245,158,11,0.2)]'
                                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                activeTab === 'passedOut'
                                                    ? 'bg-white/10 text-white'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            <UserCheck size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Passed Out Students</p>
                                            <p
                                                className={`mt-1 text-xs ${
                                                    activeTab === 'passedOut' ? 'text-amber-100' : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                Review passed-out students with preserved history.
                                            </p>
                                        </div>
                                    </div>
                                </button>
                             </div>
                         </section>

                        {activeTab === 'staff' ? (
                            <DashboardPanel
                                title="Staff Directory"
                                description={`${filteredUsers.length} user record${filteredUsers.length === 1 ? '' : 's'} in scope`}
                                icon={Shield}
                                bodyClassName="space-y-5"
                            >
                                <UnifiedFilterBar
                                    title="Staff Filters"
                                    hasActiveFilters={hasActiveStaffFilters}
                                    onReset={clearStaffFilters}
                                >
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        <UnifiedSearchInput
                                            label="Search"
                                            value={staffSearchQuery}
                                            onChange={setStaffSearchQuery}
                                            placeholder="Search by name, email, or role"
                                        />
                                        <UnifiedMultiSelect
                                            label="Role"
                                            options={roleFilterOptionObjects}
                                            selected={roleFilter}
                                            onChange={setRoleFilter}
                                            placeholder="All roles"
                                        />
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/80">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                Coverage
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {summary.staffCount} non-admin staff account{summary.staffCount === 1 ? '' : 's'}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Includes teachers and other operational roles.
                                            </p>
                                        </div>
                                    </div>
                                </UnifiedFilterBar>

                                <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
                                    <div className="overflow-x-auto">
                                    <AnalyticsDataTable
                                        columns={staffColumns}
                                        rows={paginatedUsers}
                                        emptyMessage="No staff records match your search. Try a different name, email, or role."
                                    />
                                    </div>
                                    <PaginationFooter
                                        currentPage={staffPage}
                                        totalPages={totalStaffPages}
                                        totalItems={filteredUsers.length}
                                        pageSize={PAGE_SIZE}
                                        onPageChange={setStaffPage}
                                    />
                                </div>
                            </DashboardPanel>
                        ) : (
                            <DashboardPanel
                                title={activeTab === 'passedOut' ? 'Passed Out Students' : 'Student Registry'}
                                description={`${studentPagination.total} student record${studentPagination.total === 1 ? '' : 's'} in scope`}
                                icon={UserCheck}
                                bodyClassName="space-y-5"
                            >
                                <UnifiedFilterBar
                                    title="Student Filters"
                                    hasActiveFilters={hasActiveStudentFilters}
                                    onReset={clearStudentFilters}
                                    actions={currentRole === 'Super Admin' ? (
                                        <BulkDeleteControls
                                            moduleName="students"
                                            filteredIds={filteredStudents.map((student) => student._id).filter(Boolean)}
                                            allCount={studentPagination.total}
                                            source={{ page: 'UserManagement', tab: activeTab, filteredCount: studentPagination.total }}
                                            status={currentStudentStatus}
                                            addToast={addToast}
                                            onComplete={() => fetchData(false)}
                                        />
                                    ) : null}
                                >
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                        <UnifiedSearchInput
                                            label="Search"
                                            value={studentSearchQuery}
                                            onChange={setStudentSearchQuery}
                                            placeholder="Search by name, admission number, class, or section"
                                        />
                                        <label className="min-w-0">
                                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                Academic Year
                                            </span>
                                            <select
                                                value={academicYearFilter}
                                                onChange={(event) => setAcademicYearFilter(event.target.value)}
                                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                            >
                                                {academicYearOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <UnifiedMultiSelect
                                            label="Class"
                                            options={classFilterOptions}
                                            selected={classFilter}
                                            onChange={setClassFilter}
                                            placeholder="All classes"
                                        />
                                        <UnifiedMultiSelect
                                            label="Section"
                                            options={sectionFilterOptions}
                                            selected={sectionFilter}
                                            onChange={setSectionFilter}
                                            placeholder="All sections"
                                        />
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/80">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                Coverage
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                 {activeTab === 'passedOut'
                                                    ? `${studentPagination.total} passed-out student${studentPagination.total === 1 ? '' : 's'}`
                                                    : `${summary.totalStudents} active student${summary.totalStudents === 1 ? '' : 's'}`}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Filter by class, section, or student identity for fast lookup.
                                            </p>
                                        </div>
                                    </div>
                                </UnifiedFilterBar>

                                <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
                                    <div className="overflow-x-auto">
                                    <AnalyticsDataTable
                                        columns={studentColumns}
                                        rows={paginatedStudents}
                                        emptyMessage="No student records match your search. Try a different name, admission number, class, or section."
                                    />
                                    </div>
                                    <PaginationFooter
                                        currentPage={studentPage}
                                        totalPages={totalStudentPages}
                                        totalItems={studentPagination.total}
                                        pageSize={PAGE_SIZE}
                                        onPageChange={setStudentPage}
                                    />
                                </div>
                            </DashboardPanel>
                        )}
                    </div>
                </main>
            </div>

            {showAddUserModal ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-8 py-6 dark:border-slate-800">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{currentRole === 'Super Admin' ? 'Add New Admin/Teacher' : 'Add New Teacher'}</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Add login access for staff. Super Admins can create Admins and Teachers; Admins can create Teachers only.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowAddUserModal(false); setShowPassword(false); }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddUser} className="space-y-5 p-8">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={newUser.name}
                                        onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                                        placeholder="Enter full name"
                                        className={INPUT_CLASS_NAME}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email Address</label>
                                    <input
                                        required
                                        type="email"
                                        value={newUser.email}
                                        onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                                        placeholder="Enter email address"
                                        className={INPUT_CLASS_NAME}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Role</label>
                                    <div className="relative">
                                        <select
                                            required
                                            value={newUser.role}
                                            onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
                                            className={`${INPUT_CLASS_NAME} appearance-none pr-10`}
                                        >
                                            {createRoleOptions.map((role) => (
                                                <option key={role} value={role}>
                                                    {role}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Temporary Password</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type={showPassword ? 'text' : 'password'}
                                            value={newUser.password}
                                            onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                                            placeholder="Create a temporary password"
                                            minLength={PASSWORD_MIN_LENGTH}
                                            className={INPUT_CLASS_NAME}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{PASSWORD_POLICY_TEXT}</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                {currentRole === 'Super Admin' ? (
                                    <>
                                        Super Admin can create <span className="font-semibold">Admin</span> and{' '}
                                        <span className="font-semibold">Teacher</span> accounts. Super Admin accounts are limited to the first setup owner.
                                    </>
                                ) : (
                                    <>
                                        Admin accounts can create <span className="font-semibold">Teacher</span> accounts only.
                                    </>
                                )}
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddUserModal(false); setShowPassword(false); }}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingUser}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {submittingUser ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                    {currentRole === 'Super Admin' ? 'Create Admin/Teacher' : 'Create Teacher'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {showAddStudentModal ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-8 py-6 dark:border-slate-800">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add Student</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Add students to the school directory—name, admission number, class, and section.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddStudentModal(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddStudent} className="space-y-5 p-8">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Admission Number</label>
                                    <input
                                        required
                                        type="text"
                                        value={newStudent.admissionNo}
                                        onChange={(event) =>
                                            setNewStudent((current) => ({ ...current, admissionNo: event.target.value }))
                                        }
                                        placeholder="e.g., 2024-001"
                                        className={INPUT_CLASS_NAME}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Student Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={newStudent.name}
                                        onChange={(event) => setNewStudent((current) => ({ ...current, name: event.target.value }))}
                                        placeholder="Enter student name"
                                        className={INPUT_CLASS_NAME}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Class</label>
                                    <div className="relative">
                                        <select
                                            required
                                            value={newStudent.className}
                                            onChange={(event) =>
                                                setNewStudent((current) => ({ ...current, className: event.target.value }))
                                            }
                                            className={`${INPUT_CLASS_NAME} appearance-none pr-10`}
                                        >
                                            <option value="">Select class</option>
                                            {CLASS_OPTIONS.map((option) => (
                                                <option key={option} value={option}>
                                                    Class {option}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Section</label>
                                    <input
                                        required
                                        type="text"
                                        value={newStudent.section}
                                        onChange={(event) =>
                                            setNewStudent((current) => ({
                                                ...current,
                                                section: event.target.value.toUpperCase(),
                                            }))
                                        }
                                        placeholder="e.g., A"
                                        className={INPUT_CLASS_NAME}
                                        inputMode="text"
                                        autoCapitalize="characters"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowAddStudentModal(false)}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingStudent}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {submittingStudent ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Add Student
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {detailModal.open && detailModal.record ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-8 py-6 dark:border-slate-800">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                    {detailModal.type === 'staff' ? 'User Details' : 'Edit Student'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {detailModal.type === 'staff'
                                        ? 'Overview of this account.'
                                        : 'Update the student information. The Admission Number must remain unique.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailModal({ open: false, type: 'staff', record: null })}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {detailModal.type === 'staff' ? (
                            <form onSubmit={handleEditStaff} className="space-y-6 p-8">
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={editStaff.name}
                                            onChange={(event) => setEditStaff((current) => ({ ...current, name: event.target.value }))}
                                            disabled={!canEditStaffUser(detailModal.record)}
                                            className={canEditStaffUser(detailModal.record) ? INPUT_CLASS_NAME : READONLY_CLASS_NAME}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            value={editStaff.email}
                                            onChange={(event) => setEditStaff((current) => ({ ...current, email: event.target.value }))}
                                            disabled={!canEditStaffUser(detailModal.record)}
                                            className={canEditStaffUser(detailModal.record) ? INPUT_CLASS_NAME : READONLY_CLASS_NAME}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Role</label>
                                        {currentRole === 'Super Admin' && !isSelfRecord(detailModal.record) ? (
                                            <div className="relative">
                                                <select
                                                    value={editStaff.role}
                                                    onChange={(event) => setEditStaff((current) => ({ ...current, role: event.target.value }))}
                                                    className={`${INPUT_CLASS_NAME} appearance-none pr-10`}
                                                >
                                                    {EDITABLE_ROLE_OPTIONS.map((role) => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            </div>
                                        ) : (
                                            <input type="text" value={normalizeRole(editStaff.role) || 'Teacher'} readOnly className={READONLY_CLASS_NAME} />
                                        )}
                                    </div>
                                    <PreviewField label="Joined" value={formatDate(detailModal.record.createdAt)} />
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    Users can update their own name and email. Only the Super Admin can edit other users and change roles.
                                </div>
                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setDetailModal({ open: false, type: 'staff', record: null })}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Close
                                    </button>
                                    {currentRole === 'Super Admin' ? (
                                        <button
                                            type="button"
                                            onClick={() => resetStaffPassword(detailModal.record)}
                                            disabled={resettingPasswordId === (detailModal.record._id || detailModal.record.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {resettingPasswordId === (detailModal.record._id || detailModal.record.id) ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <KeyRound size={16} />
                                            )}
                                            {resettingPasswordId === (detailModal.record._id || detailModal.record.id)
                                                ? 'Generating…'
                                                : 'Generate Temporary Password'}
                                        </button>
                                    ) : null}
                                    {canDeleteStaffUser(detailModal.record) ? (
                                        <button
                                            type="button"
                                            onClick={() => openDeleteDialog(detailModal.record, detailModal.type)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-rose-700"
                                        >
                                            <Trash2 size={16} />
                                            Delete User
                                        </button>
                                    ) : null}
                                    {canEditStaffUser(detailModal.record) ? (
                                        <button
                                            type="submit"
                                            disabled={submittingEditStaff}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {submittingEditStaff ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                            Save Changes
                                        </button>
                                    ) : null}
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleEditStudent} className="space-y-6 p-8">
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Admission Number</label>
                                        <input
                                            required
                                            type="text"
                                            value={editStudent.admissionNo}
                                            onChange={(event) => setEditStudent((current) => ({ ...current, admissionNo: event.target.value }))}
                                            className={INPUT_CLASS_NAME}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Student Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={editStudent.name}
                                            onChange={(event) => setEditStudent((current) => ({ ...current, name: event.target.value }))}
                                            className={INPUT_CLASS_NAME}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Academic Year</label>
                                        <select
                                            value={editStudent.academicYear || ''}
                                            onChange={(event) => setEditStudent((current) => ({ ...current, academicYear: event.target.value }))}
                                            className={`${INPUT_CLASS_NAME} appearance-none`}
                                        >
                                            <option value="">Current Academic Year</option>
                                            {academicYears.map((year) => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Status</label>
                                        <select
                                            value={editStudent.status || 'Active'}
                                            onChange={(event) => setEditStudent((current) => ({ ...current, status: event.target.value }))}
                                            className={`${INPUT_CLASS_NAME} appearance-none`}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Passed Out">Passed out</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Class</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={editStudent.className}
                                                onChange={(event) => setEditStudent((current) => ({ ...current, className: event.target.value }))}
                                                className={`${INPUT_CLASS_NAME} appearance-none pr-10`}
                                            >
                                                <option value="">Select class</option>
                                                {CLASS_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>Class {option}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Section</label>
                                        <input
                                            required
                                            type="text"
                                            value={editStudent.section}
                                            onChange={(event) =>
                                                setEditStudent((current) => ({
                                                    ...current,
                                                    section: event.target.value.toUpperCase(),
                                                }))
                                            }
                                            placeholder="e.g., A"
                                            className={INPUT_CLASS_NAME}
                                            inputMode="text"
                                            autoCapitalize="characters"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => openDeleteDialog(detailModal.record, detailModal.type)}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 text-rose-600 px-4 py-3 text-sm font-semibold transition-all duration-200 hover:bg-rose-100 sm:mr-auto"
                                    >
                                        <Trash2 size={16} />
                                        Delete Student
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDetailModal({ open: false, type: 'staff', record: null })}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingEditStudent}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {submittingEditStudent ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16} />}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            ) : null}

            {temporaryPasswordResult?.temporaryPassword ? (
                <div className="fixed inset-0 z-[110] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
                                    <KeyRound size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Temporary Password Generated
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        Share it through a trusted channel. This staff member must change it at next login.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeTemporaryPasswordModal}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                aria-label="Close temporary password popup"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-5 px-5 py-6 sm:px-7">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Staff Account
                                </p>
                                <p className="mt-2 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {temporaryPasswordResult.user?.name || 'Staff member'}
                                    {temporaryPasswordResult.user?.email ? (
                                        <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                                            {temporaryPasswordResult.user.email}
                                        </span>
                                    ) : null}
                                </p>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Generated Password
                                </label>
                                <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-400/30 dark:bg-emerald-500/10 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-center font-mono text-xl font-black tracking-wide text-slate-950 shadow-sm dark:bg-slate-950 dark:text-emerald-100">
                                        {temporaryPasswordResult.temporaryPassword}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={copyTemporaryPassword}
                                        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                                    >
                                        {temporaryPasswordCopied ? <Check size={16} /> : <Copy size={16} />}
                                        {temporaryPasswordCopied ? 'Copied Successfully' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeTemporaryPasswordModal}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {deleteDialog.open ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]">
                        <div className="px-8 py-8 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <Trash2 size={22} />
                            </div>
                            <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-100">Confirm Deletion</h3>
                            {deleteDialog.type === 'student' ? (
                                <div className="mt-4 space-y-4 text-left">
                                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        Permanently delete <span className="font-semibold text-slate-700 dark:text-slate-200">{deleteDialog.label}</span>. This removes the student record, academic history, incidents, letters, notifications, and directly related logs.
                                    </p>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <PreviewField label="Student Name" value={deleteDialog.preview?.student?.name || deleteDialog.record?.name} />
                                            <PreviewField label="Admission Number" value={deleteDialog.preview?.student?.admissionNo || deleteDialog.record?.admissionNo} />
                                            <PreviewField label="Academic Year" value={deleteDialog.preview?.student?.academicYear || deleteDialog.record?.academicYear} />
                                            <PreviewField label="Status" value={formatDisplayValue(deleteDialog.preview?.student?.status || deleteDialog.record?.status)} />
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                                        {deleteDialog.loadingPreview ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 size={16} className="animate-spin" />
                                                Calculating affected records…
                                            </div>
                                        ) : (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {Object.entries(deleteDialog.preview?.affectedRecords || {}).map(([key, value]) => (
                                                    <div key={key} className="flex items-center justify-between gap-3">
                                                        <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                        <span className="font-bold">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    You are about to delete <span className="font-semibold text-slate-700 dark:text-slate-200">{deleteDialog.label}</span>. This action cannot be undone.
                                </p>
                            )}

                            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                                <button
                                    type="button"
                                    onClick={() => setDeleteDialog({ open: false, id: null, type: 'staff', label: '', record: null, preview: null, loadingPreview: false })}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    disabled={deleteDialog.type === 'student' && deleteDialog.loadingPreview}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Trash2 size={16} />
                                    {deleteDialog.type === 'staff' ? 'Delete User' : 'Delete Student'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default UserManagement;
