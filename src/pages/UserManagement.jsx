import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../config/apiClient';
import {
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit3,
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
import {
    AnalyticsDataTable,
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
} from '../components/analytics/DashboardPrimitives';
import { UnifiedFilterBar, UnifiedMultiSelect, UnifiedSearchInput } from '../components/UnifiedFilters';

const CREATE_ROLE_OPTIONS = ['Admin', 'Teacher'];
const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const PAGE_SIZE = 8;

const INPUT_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all duration-300 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400/20';
const READONLY_CLASS_NAME =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:shadow-none';

const formatDate = (value) => {
    if (!value) return 'Not available';

    return new Date(value).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const getRoleBadgeTone = (role) => {
    if (role === 'Super Admin') return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/10 dark:text-purple-200';
    if (role === 'Admin') return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200';
    if (role === 'Teacher') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200';
    return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
};

const RoleBadge = ({ role }) => (
    <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeTone(
            role
        )}`}
    >
        {role || 'Staff'}
    </span>
);

const ActionButton = ({ icon: Icon, label, tone = 'slate', onClick }) => {
    const toneClassName = {
        slate: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
        blue: 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-100',
        red: 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-100',
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${toneClassName}`}
            aria-label={label}
            title={label}
        >
            <Icon size={16} />
        </button>
    );
};

const PaginationFooter = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => {
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-semibold text-slate-800 dark:text-slate-100">{start}</span>-
                <span className="font-semibold text-slate-800 dark:text-slate-100">{end}</span> of{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-100">{totalItems}</span> records
            </p>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                    <ChevronLeft size={14} />
                    Previous
                </button>

                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
                </span>

                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                    Next
                    <ChevronRight size={14} />
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
    const { user } = useAuth();
    const { addToast } = useToast();

    const [usersList, setUsersList] = useState([]);
    const [studentRegistry, setStudentRegistry] = useState([]);
    const [resetRequests, setResetRequests] = useState([]);
    const [temporaryPasswordResult, setTemporaryPasswordResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const [activeTab, setActiveTab] = useState('staff');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState([]);
    const [classFilter, setClassFilter] = useState([]);
    const [sectionFilter, setSectionFilter] = useState([]);
    const [staffPage, setStaffPage] = useState(1);
    const [studentPage, setStudentPage] = useState(1);

    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    const [detailModal, setDetailModal] = useState({ open: false, type: 'staff', record: null });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, type: 'staff', label: '' });

    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Teacher', password: '' });
    const [newStudent, setNewStudent] = useState({ name: '', admissionNo: '', className: '', section: '' });
    const [editStudent, setEditStudent] = useState({ _id: '', name: '', admissionNo: '', className: '', section: '' });
    const [submittingUser, setSubmittingUser] = useState(false);
    const [submittingStudent, setSubmittingStudent] = useState(false);
    const [submittingEditStudent, setSubmittingEditStudent] = useState(false);

    const config = useMemo(() => ({ headers: {} }), []);

    const loadUsers = useCallback(async () => {
        const { data } = await apiClient.get('/api/auth/users', config);
        return Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : [];
    }, [config]);

    const loadStudents = useCallback(async () => {
        const { data } = await apiClient.get('/api/students/all', config);
        return Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : [];
    }, [config]);

    const loadResetRequests = useCallback(async () => {
        if (user?.role !== 'Super Admin') return [];
        const { data } = await apiClient.get('/api/auth/password-reset-requests', config);
        return Array.isArray(data) ? data : [];
    }, [config, user?.role]);

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
                const [userData, studentData, resetData] = await Promise.all([loadUsers(), loadStudents(), loadResetRequests()]);
                if (!isMounted()) return;
                setUsersList(userData);
                setStudentRegistry(studentData);
                setResetRequests(resetData);
            } catch (requestError) {
                if (!isMounted()) return;
                setUsersList([]);
                setStudentRegistry([]);
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
        [loadResetRequests, loadStudents, loadUsers, user?._id]
    );

    useEffect(() => {
        let mounted = true;
        void fetchData(true, { isMounted: () => mounted });
        return () => {
            mounted = false;
        };
    }, [fetchData]);

    const summary = useMemo(() => {
        const superAdminCount = usersList.filter((entry) => entry.role === 'Super Admin').length;
        const adminCount = usersList.filter((entry) => entry.role === 'Admin').length;
        const teacherCount = usersList.filter((entry) => entry.role === 'Teacher').length;
        const staffCount = usersList.filter((entry) => entry.role !== 'Admin').length;

        return {
            totalUsers: usersList.length,
            superAdminCount,
            adminCount,
            teacherCount,
            staffCount,
            totalStudents: studentRegistry.length,
        };
    }, [studentRegistry.length, usersList]);

    const roleFilterOptions = useMemo(() => {
        // Map DB role values to display labels: 'Admin' → 'Administration'
        const values = new Set(['Super Admin', 'Admin', 'Teacher']);
        usersList.forEach((entry) => {
            if (entry.role) values.add(entry.role);
        });
        return Array.from(values);
    }, [usersList]);

    // Display label for the role filter (maps internal role value to UI label)
    const roleOptionLabels = useMemo(
        () => ({
            Admin: 'Administration',
            'Super Admin': 'Super Admin',
            Teacher: 'Teacher',
        }),
        []
    );

    // Convert role filter options to {id, label} shape for the dropdown
    const roleFilterOptionObjects = useMemo(
        () => roleFilterOptions.map((role) => ({ id: role, label: roleOptionLabels[role] || role })),
        [roleFilterOptions, roleOptionLabels]
    );

    const classFilterOptions = useMemo(
        () => Array.from(new Set(studentRegistry.map((entry) => entry.className).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
        [studentRegistry]
    );

    const sectionFilterOptions = useMemo(
        () => Array.from(new Set(studentRegistry.map((entry) => entry.section).filter(Boolean))).sort(),
        [studentRegistry]
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
            nextUsers = nextUsers.filter((entry) => roleFilter.includes(entry.role));
        }

        return nextUsers;
    }, [roleFilter, staffSearchQuery, usersList]);

    const filteredStudents = useMemo(() => {
        let nextStudents = [...studentRegistry];

        if (studentSearchQuery.trim()) {
            const normalizedQuery = studentSearchQuery.trim().toLowerCase();
            nextStudents = nextStudents.filter(
                (entry) =>
                    entry.name?.toLowerCase().includes(normalizedQuery) ||
                    entry.admissionNo?.toLowerCase().includes(normalizedQuery) ||
                    entry.className?.toLowerCase().includes(normalizedQuery) ||
                    entry.section?.toLowerCase().includes(normalizedQuery)
            );
        }

        if (classFilter.length > 0) {
            nextStudents = nextStudents.filter((entry) => classFilter.includes(entry.className));
        }

        if (sectionFilter.length > 0) {
            nextStudents = nextStudents.filter((entry) => sectionFilter.includes(entry.section));
        }

        return nextStudents;
    }, [classFilter, sectionFilter, studentRegistry, studentSearchQuery]);

    useEffect(() => {
        setStaffPage(1);
    }, [filteredUsers.length]);

    useEffect(() => {
        setStudentPage(1);
    }, [filteredStudents.length]);

    const totalStaffPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 0;
    const totalStudentPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 0;

    const paginatedUsers = useMemo(
        () => filteredUsers.slice((staffPage - 1) * PAGE_SIZE, staffPage * PAGE_SIZE),
        [filteredUsers, staffPage]
    );

    const paginatedStudents = useMemo(
        () => filteredStudents.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE),
        [filteredStudents, studentPage]
    );

    const hasActiveStaffFilters = Boolean(staffSearchQuery.trim()) || roleFilter.length > 0;
    const hasActiveStudentFilters =
        Boolean(studentSearchQuery.trim()) || classFilter.length > 0 || sectionFilter.length > 0;

    const clearStaffFilters = useCallback(() => {
        setStaffSearchQuery('');
        setRoleFilter([]);
    }, []);

    const clearStudentFilters = useCallback(() => {
        setStudentSearchQuery('');
        setClassFilter([]);
        setSectionFilter([]);
    }, []);

    const handleAddUser = async (event) => {
        event.preventDefault();
        setSubmittingUser(true);

        try {
            await apiClient.post('/api/auth/users', newUser, config);
            addToast('User created successfully.', 'success');
            setShowAddUserModal(false);
            setNewUser({ name: '', email: '', role: 'Teacher', password: '' });
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to create user.', 'error');
        } finally {
            setSubmittingUser(false);
        }
    };

    const completeResetRequest = async (requestId) => {
        try {
            const { data } = await apiClient.post(`/api/auth/password-reset-requests/${requestId}/complete`, {}, config);
            setTemporaryPasswordResult(data);
            addToast('Temporary password generated.', 'success');
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to reset password.', 'error');
        }
    };

    const rejectResetRequest = async (requestId) => {
        try {
            await apiClient.post(`/api/auth/password-reset-requests/${requestId}/reject`, {}, config);
            addToast('Password reset request rejected.', 'success');
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to reject request.', 'error');
        }
    };

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
        });
    }, []);

    const confirmDelete = useCallback(async () => {
        try {
            const endpoint =
                deleteDialog.type === 'staff'
                    ? `/api/auth/users/${deleteDialog.id}`
                    : `/api/students/${deleteDialog.id}`;

            await apiClient.delete(endpoint, config);
            addToast(`${deleteDialog.type === 'staff' ? 'User' : 'Student'} deleted successfully.`, 'success');
            setDeleteDialog({ open: false, id: null, type: 'staff', label: '' });
            setDetailModal({ open: false, type: 'staff', record: null });
            fetchData(false);
        } catch (requestError) {
            addToast(requestError.response?.data?.message || 'Unable to delete record.', 'error');
        }
    }, [addToast, config, deleteDialog.id, deleteDialog.type, fetchData]);

    const openDetailModal = useCallback((record, type) => {
        setDetailModal({ open: true, type, record });
        if (type === 'student') {
            setEditStudent({
                _id: record._id,
                name: record.name,
                admissionNo: record.admissionNo,
                className: record.className,
                section: record.section
            });
        }
    }, []);

    const handleEditStudent = async (event) => {
        event.preventDefault();
        setSubmittingEditStudent(true);

        try {
            await apiClient.put(`/api/students/${editStudent._id}`, editStudent, config);
            addToast('Student updated successfully.', 'success');
            setDetailModal({ open: false, type: 'staff', record: null });
            fetchData(false);
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
                            icon={Trash2}
                            label="Delete user"
                            tone="red"
                            onClick={() => openDeleteDialog(row, 'staff')}
                        />
                    </div>
                ),
            },
        ],
        [openDeleteDialog]
    );

    const studentColumns = useMemo(
        () => [
            {
                key: 'name',
                label: 'Student',
                render: (row) => (
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">Admission No: {row.admissionNo}</p>
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
                            label="View student details"
                            tone="blue"
                            onClick={() => openDetailModal(row, 'student')}
                        />
                        <ActionButton
                            icon={Trash2}
                            label="Delete student"
                            tone="red"
                            onClick={() => openDeleteDialog(row, 'student')}
                        />
                    </div>
                ),
            },
        ],
        [openDeleteDialog, openDetailModal]
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
                            eyebrow="Administration"
                            title="User Management"
                            description="Manage staff access, maintain the student registry, and keep administrative records aligned with the professional dashboard workspace."
                            icon={Users}
                            actions={(
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddUserModal(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-all duration-300 hover:bg-blue-50 dark:bg-slate-100 dark:text-slate-950"
                                    >
                                        <UserPlus size={16} />
                                        Add New User
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
                            <DashboardStatCard title="Administrators" value={summary.adminCount} icon={Shield} tone="slate" />
                            <DashboardStatCard title="Teachers" value={summary.teacherCount} icon={UserPlus} tone="emerald" />
                            <DashboardStatCard title="Students" value={summary.totalStudents} icon={UserCheck} tone="amber" />
                        </div>

                        {user?.role === 'Super Admin' ? (
                            <DashboardPanel
                                title="Password Reset Requests"
                                description="Generate temporary passwords for staff who requested account recovery."
                                icon={KeyRound}
                            >
                                {temporaryPasswordResult?.temporaryPassword ? (
                                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        Temporary password for <span className="font-semibold">{temporaryPasswordResult.user?.email}</span>:
                                        <span className="ml-2 rounded-lg bg-white px-2 py-1 font-mono font-semibold">{temporaryPasswordResult.temporaryPassword}</span>
                                    </div>
                                ) : null}
                                {resetRequests.length === 0 ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">No pending reset requests.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {resetRequests.map((request) => (
                                            <div key={request._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{request.user?.name || request.email}</p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">{request.email}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => completeResetRequest(request._id)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                                                        Generate Temporary Password
                                                    </button>
                                                    <button type="button" onClick={() => rejectResetRequest(request._id)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200">
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </DashboardPanel>
                        ) : null}

                        {error ? (
                            <div className="rounded-[28px] border border-rose-200 bg-rose-50/90 px-5 py-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-2xl bg-rose-100 p-2 text-rose-600">
                                        <AlertCircle size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-rose-700">Unable to load all records</p>
                                        <p className="mt-1 text-sm text-rose-600">{error}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <section className="rounded-[28px] border border-white/80 bg-white/85 p-2 shadow-lg shadow-slate-200/70 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/50">
                            <div className="grid gap-2 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('staff')}
                                    className={`rounded-[22px] px-5 py-4 text-left transition-all duration-200 ${
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
                                                Roles, access, and active account records
                                            </p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('students')}
                                    className={`rounded-[22px] px-5 py-4 text-left transition-all duration-200 ${
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
                                                Admission records, class, and section details
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
                                    actions={(
                                        <button
                                            type="button"
                                            onClick={() => fetchData(false)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                                        >
                                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                            Refresh
                                        </button>
                                    )}
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
                                            placeholder="All Roles"
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
                                        emptyMessage="No staff records match the current filters."
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
                                title="Student Registry"
                                description={`${filteredStudents.length} student record${filteredStudents.length === 1 ? '' : 's'} in scope`}
                                icon={UserCheck}
                                bodyClassName="space-y-5"
                            >
                                <UnifiedFilterBar
                                    title="Student Filters"
                                    hasActiveFilters={hasActiveStudentFilters}
                                    onReset={clearStudentFilters}
                                    actions={(
                                        <button
                                            type="button"
                                            onClick={() => fetchData(false)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                                        >
                                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                            Refresh
                                        </button>
                                    )}
                                >
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <UnifiedSearchInput
                                            label="Search"
                                            value={studentSearchQuery}
                                            onChange={setStudentSearchQuery}
                                            placeholder="Search by name, admission no, class, or section"
                                        />
                                        <UnifiedMultiSelect
                                            label="Class"
                                            options={classFilterOptions}
                                            selected={classFilter}
                                            onChange={setClassFilter}
                                            placeholder="All Classes"
                                        />
                                        <UnifiedMultiSelect
                                            label="Section"
                                            options={sectionFilterOptions}
                                            selected={sectionFilter}
                                            onChange={setSectionFilter}
                                            placeholder="All Sections"
                                        />
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/80">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                Coverage
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {summary.totalStudents} registered student{summary.totalStudents === 1 ? '' : 's'}
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
                                        emptyMessage="No student records match the current filters."
                                    />
                                    </div>
                                    <PaginationFooter
                                        currentPage={studentPage}
                                        totalPages={totalStudentPages}
                                        totalItems={filteredStudents.length}
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
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add New User</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Add login access for office or teaching staff. You can assign either an administrator or teacher role.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddUserModal(false)}
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
                                            {CREATE_ROLE_OPTIONS.map((role) => (
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
                                    <input
                                        required
                                        type="password"
                                        value={newUser.password}
                                        onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                                        placeholder="Create a temporary password"
                                        className={INPUT_CLASS_NAME}
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                Only <span className="font-semibold">Admin</span> and{' '}
                                <span className="font-semibold">Teacher</span> roles are available when creating accounts here.
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowAddUserModal(false)}
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
                                    Create User
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
                                        placeholder="e.g. 2024-001"
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
                                        placeholder="e.g. A"
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
                            <div className="space-y-6 p-8">
                                <div className="grid gap-5 md:grid-cols-2">
                                    <PreviewField label="Full Name" value={detailModal.record.name} />
                                    <PreviewField label="Email Address" value={detailModal.record.email} />
                                    <PreviewField label="Role" value={detailModal.record.role} />
                                    <PreviewField label="Joined" value={formatDate(detailModal.record.createdAt)} />
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    Editing staff accounts beyond create and delete happens outside this screen. Staff records can be removed here when someone leaves or no longer needs access.
                                </div>

                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setDetailModal({ open: false, type: 'staff', record: null })}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openDeleteDialog(detailModal.record, detailModal.type)}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-rose-700"
                                    >
                                        <Trash2 size={16} />
                                        Delete User
                                    </button>
                                </div>
                            </div>
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
                                            placeholder="e.g. A"
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
                                        Delete
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

            {deleteDialog.open ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]">
                        <div className="px-8 py-8 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <Trash2 size={22} />
                            </div>
                            <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-100">Confirm deletion</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                You are about to delete <span className="font-semibold text-slate-700 dark:text-slate-200">{deleteDialog.label}</span>.
                                This action cannot be undone.
                            </p>

                            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                                <button
                                    type="button"
                                    onClick={() => setDeleteDialog({ open: false, id: null, type: 'staff', label: '' })}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-rose-700"
                                >
                                    <Trash2 size={16} />
                                    Delete Record
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
