import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types";
import { setAccessToken } from "./api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoaded: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState>(
    (set) => ({
      user: null,
      accessToken: null,
      isLoaded: false,
      setAuth: (user: User, accessToken: string) => {
        setAccessToken(accessToken);
        set({ user, accessToken, isLoaded: true });
      },
      clearAuth: () => {
        setAccessToken(null);
        set({ user: null, accessToken: null, isLoaded: true });
      },
      setUser: (user: User) => set({ user }),
    }),
    {
      name: "lf-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) setAccessToken(state.accessToken);
        if (state) state.isLoaded = true;
      },
    },
  ),
);
