import { QueryClient } from "@tanstack/react-query";

/**
 * Shared React Query client. Admin pages cache what they load so coming back to a
 * page shows the last result instantly while a fresh copy loads in the background.
 * The cache is wiped whenever the admin token is set or cleared (login / logout /
 * expired session) so one admin never sees another's cached data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});
