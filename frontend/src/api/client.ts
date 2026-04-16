import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.DEV ? "/api" : "";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(cb: () => void) {
  onUnauthorized = cb;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const user = localStorage.getItem("gs_user");
  if (user) {
    config.headers.set("X-User-Id", user);
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export function extractError(ex: unknown): string {
  if (axios.isAxiosError(ex)) {
    const detail = (ex.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
    return ex.message;
  }
  return String(ex);
}
