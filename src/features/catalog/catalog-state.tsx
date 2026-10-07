"use client";
import { useEffect, useState, type ReactNode } from "react";
export function useData<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    data: T | undefined;
    error: string;
    loading: boolean;
  }>({ data: undefined, error: "", loading: true });
  useEffect(() => {
    let active = true;
    setState({ data: undefined, error: "", loading: true });
    load()
      .then((data) => {
        if (active) setState({ data, error: "", loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            data: undefined,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load. Please try again.",
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);
  return { ...state, refresh: () => setAttempt((n) => n + 1) };
}
export function CatalogState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <p className="gh-loading" role="status">
        Loading…
      </p>
    );
  if (error)
    return (
      <div className="gh-feedback" role="alert">
        <p>{error}</p>
        <button className="gh-action" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  return <>{children}</>;
}
