import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      organization: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setOrganization: (organization) => set({ organization }),

      login: async (email: string, password: string) => {
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Login failed');
        }

        const { data } = await response.json();
        set({
          user: data.user,
          isAuthenticated: true,
        });

        // Fetch organizations
        const orgsResponse = await fetch('/api/v1/users/me/organizations', {
          credentials: 'include',
        });

        if (orgsResponse.ok) {
          const { data: orgs } = await orgsResponse.json();
          if (orgs.length > 0) {
            set({ organization: orgs[0] });
          }
        }
      },

      logout: async () => {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });

        set({
          user: null,
          organization: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await fetch('/api/v1/users/me', {
            credentials: 'include',
          });

          if (response.ok) {
            const { data } = await response.json();
            set({
              user: data,
              isAuthenticated: true,
              isLoading: false,
            });

            // Fetch organizations
            const orgsResponse = await fetch('/api/v1/users/me/organizations', {
              credentials: 'include',
            });

            if (orgsResponse.ok) {
              const { data: orgs } = await orgsResponse.json();
              if (orgs.length > 0) {
                set({ organization: orgs[0] });
              }
            }
          } else {
            set({
              user: null,
              organization: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
          set({
            user: null,
            organization: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'booked-auth',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
