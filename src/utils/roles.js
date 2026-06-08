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
