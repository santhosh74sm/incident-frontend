export const normalizeRole = (role) => {
    const roleMap = {
        admin: 'Admin',
        teacher: 'Teacher',
        super_admin: 'Super Admin',
        'super admin': 'Super Admin',
    };
    return roleMap[String(role || '').trim().toLowerCase()] || role;
};

export const isAdminRole = (role) => ['Super Admin', 'Admin'].includes(normalizeRole(role));

export const isSuperAdminRole = (role) => normalizeRole(role) === 'Super Admin';

export const isTeacherRole = (role) => normalizeRole(role) === 'Teacher';

export const isIncidentReporterRole = (role) => ['Super Admin', 'Admin', 'Teacher'].includes(normalizeRole(role));

export const isSchoolUserRole = (role) => ['Super Admin', 'Admin', 'Teacher'].includes(normalizeRole(role));
