/**
 * Auth store — JWT access/refresh tokens + user profile.
 *
 * Tokens persist in LocalStorage (`q-tools-auth`) so a page reload keeps
 * the session. The store exposes `register`, `login`, `logout`, `refresh`,
 * `loadMe`, and `restore` actions. Other stores (favorites, presets) read
 * `isAuthenticated` to decide whether to sync with the backend.
 *
 * No UI is provided by this store — login/register screens are a separate
 * concern. The store is the single source of truth for auth state.
 */
import { defineStore } from 'pinia';
import type {
  UserProfile,
  RegisterRequest,
  LoginRequest,
} from '@q-tools/shared';
import { api, ApiError } from '@/utils/api';

const STORAGE_KEY = 'q-tools-auth';

interface PersistedAuth {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const DEFAULTS: PersistedAuth = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

function readPersisted(): PersistedAuth {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(auth: PersistedAuth): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

function clearPersisted(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthSuccessResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

interface MeResponse {
  user: UserProfile;
}

export const useAuthStore = defineStore('auth', {
  state: (): PersistedAuth => readPersisted(),
  getters: {
    isAuthenticated: (state): boolean => !!state.accessToken,
  },
  actions: {
    /** Persist current state to LocalStorage. */
    _persist() {
      persist({
        user: this.user,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      });
    },

    /** Register a new account; stores tokens + user on success. */
    async register(payload: RegisterRequest): Promise<UserProfile> {
      const { data } = await api.post<AuthSuccessResponse>(
        '/api/auth/register',
        payload,
        { skipAuth: true },
      );
      this.user = data.user;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this._persist();
      return data.user;
    },

    /** Log in with email + password; stores tokens + user on success. */
    async login(payload: LoginRequest): Promise<UserProfile> {
      const { data } = await api.post<AuthSuccessResponse>(
        '/api/auth/login',
        payload,
        { skipAuth: true },
      );
      this.user = data.user;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this._persist();
      return data.user;
    },

    /** Log out and clear all stored credentials. */
    logout() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
      clearPersisted();
    },

    /** Exchange the refresh token for a new token pair. */
    async refresh(): Promise<void> {
      if (!this.refreshToken) {
        this.logout();
        throw new Error('No refresh token');
      }
      try {
        const { data } = await api.post<RefreshResponse>(
          '/api/auth/refresh',
          { refreshToken: this.refreshToken },
          { skipAuth: true },
        );
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
        this._persist();
      } catch (err) {
        this.logout();
        throw err;
      }
    },

    /** Re-fetch the current user's profile (validates the access token). */
    async loadMe(): Promise<UserProfile | null> {
      if (!this.accessToken) return null;
      try {
        const { data } = await api.get<MeResponse>('/api/auth/me');
        this.user = data.user;
        this._persist();
        return data.user;
      } catch (err) {
        // 401/403 → access token invalid; try refresh once, else log out.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          try {
            await this.refresh();
            const { data } = await api.get<MeResponse>('/api/auth/me');
            this.user = data.user;
            this._persist();
            return data.user;
          } catch {
            this.logout();
            return null;
          }
        }
        throw err;
      }
    },

    /**
     * Rehydrate from LocalStorage and validate the session. Safe to call
     * on boot — no-ops when no tokens are stored.
     */
    async restore(): Promise<UserProfile | null> {
      if (!this.accessToken) return null;
      return this.loadMe();
    },
  },
});
