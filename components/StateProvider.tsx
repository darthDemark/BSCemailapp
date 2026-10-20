"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_STATE, STORAGE_KEY, type AppState } from "@/lib/state";

interface AppStateContextValue {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  reset: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const loadedRef = useRef(false);

  // Hydrate from localStorage once on mount (client-only; the initial
  // render uses DEFAULT_STATE on both server and client).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        // One-time hydration from an external system (localStorage) —
        // the legitimate effect use case; there is no subscription to
        // re-enter, and reading storage during render would mismatch SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch {
      // Corrupt storage: fall back to the demo defaults.
    }
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full/blocked: app keeps working in-memory.
    }
  }, [state]);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const value = useMemo(
    () => ({ state, update, reset }),
    [state, update, reset]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside StateProvider");
  return ctx;
}
