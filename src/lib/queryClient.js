/**
 * queryClient.js
 * Singleton React Query client with production-safe defaults.
 *
 * Defaults:
 * - staleTime: 60s  — data is fresh for 60 seconds before background refetch
 * - retry: 1        — retries once on error (GET only by default)
 * - refetchOnWindowFocus: true — refetch when tab regains focus
 *
 * Override per-query with individual useQuery options.
 */

import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
        },
        mutations: {
            retry: 0,
        },
    },
});

export default queryClient;
