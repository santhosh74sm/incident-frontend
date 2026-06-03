/**
 * useAuth.js
 * React Query mutations for auth flows.
 * Does NOT replace AuthContext — AuthContext stays as the session store.
 * These are stateless mutations called from form pages.
 */

import { useMutation } from '@tanstack/react-query';
import apiClient from '../config/apiClient';

export const useLogin = () =>
    useMutation({
        mutationFn: (credentials) =>
            apiClient.post('/api/auth/login', credentials).then((r) => r.data),
    });

export const useRegister = () =>
    useMutation({
        mutationFn: (data) =>
            apiClient.post('/api/auth/workspaces', data).then((r) => r.data),
    });
