import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AnnualReview,
  AppUser,
  AuditEntry,
  ComputedRecord,
  NotificationItem,
  Staff,
  TrainingModule,
  TrainingRecord,
} from "../data/types";
import {
  AUDIT,
  MODULES,
  NOTIFICATIONS,
  RECORDS,
  REVIEWS,
  STAFF,
} from "../data/seed";
import { ROLE_LABELS, addByFrequency, computeRag, iso, parse } from "../lib/domain";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
}

interface StoreShape {
  user: AppUser | null;
  inspectionMode: boolean;
  staff: Staff[];
  modules: TrainingModule[];
  records: TrainingRecord[];
  reviews: AnnualReview[];
  audit: AuditEntry[];
  notifications: NotificationItem[];
  toasts: Toast[];

  // derived
  computed: ComputedRecord[];

  // auth
  login: (u: AppUser, inspection?: boolean) => void;
  logout: () => void;

  // mutations
  approveRecord: (recordId: string) => void;
  rejectRecord: (recordId: string, reason: string) => void;
  uploadEvidence: (staffId: string, moduleId: string, fileName: string) => void;
  addStaff: (s: Omit<Staff, "id" | "roleLabel" | "avatarColor">) => void;
  addModule: (m: Omit<TrainingModule, "id">) => void;
  toggleModuleRetired: (moduleId: string) => void;
  markAllNotificationsRead: () => void;
  signOffReview: (reviewId: string) => void;

  // toast
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<StoreShape | null>(null);

let toastSeq = 1;
let auditSeq = 1000;
let idSeq = 5000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [staff, setStaff] = useState<Staff[]>(STAFF);
  const [modules, setModules] = useState<TrainingModule[]>(MODULES);
  const [records, setRecords] = useState<TrainingRecord[]>(RECORDS);
  const [reviews, setReviews] = useState<AnnualReview[]>(REVIEWS);
  const [audit, setAudit] = useState<AuditEntry[]>(AUDIT);
  const [notifications, setNotifications] = useState<NotificationItem[]>(NOTIFICATIONS);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = toastSeq++;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const logAudit = useCallback((entry: Omit<AuditEntry, "id" | "timestamp">) => {
    const e: AuditEntry = {
      ...entry,
      id: `a${auditSeq++}`,
      timestamp: new Date("2026-06-27T09:30:00Z").toISOString(),
    };
    setAudit((prev) => [e, ...prev]);
  }, []);

  const moduleById = useCallback(
    (id: string) => modules.find((m) => m.id === id)!,
    [modules],
  );
  const staffById = useCallback((id: string) => staff.find((s) => s.id === id)!, [staff]);

  const computed: ComputedRecord[] = useMemo(() => {
    return records
      .map((r) => {
        const module = modules.find((m) => m.id === r.moduleId);
        const st = staff.find((s) => s.id === r.staffId);
        if (!module || !st) return null;
        const { rag, recordStatus, days } = computeRag(r);
        return { ...r, module, staff: st, rag, recordStatus, daysToExpiry: days };
      })
      .filter(Boolean) as ComputedRecord[];
  }, [records, modules, staff]);

  const login = useCallback((u: AppUser, inspection = false) => {
    setUser(u);
    setInspectionMode(inspection);
  }, []);
  const logout = useCallback(() => {
    setUser(null);
    setInspectionMode(false);
  }, []);

  const approveRecord = useCallback(
    (recordId: string) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== recordId) return r;
          const m = moduleById(r.moduleId);
          const completion = r.completionDate
            ? parse(r.completionDate)!
            : parse("2026-06-27")!;
          const exp = addByFrequency(completion, m.refresh);
          return {
            ...r,
            approval: "approved",
            completionDate: r.completionDate ?? iso(completion),
            expiryDate: exp ? iso(exp) : null,
            evidence: r.evidence ? { ...r.evidence, verified: true } : r.evidence,
          };
        }),
      );
      const rec = records.find((r) => r.id === recordId);
      if (rec) {
        const m = moduleById(rec.moduleId);
        const s = staffById(rec.staffId);
        logAudit({
          user: user?.name ?? "System",
          action: "Approved certificate",
          entity: `${m.title} · ${s.firstName} ${s.lastName}`,
          category: "evidence",
          field: "Approval",
          previous: "Pending",
          next: "Approved",
        });
      }
      pushToast({ kind: "success", title: "Certificate approved", body: "Training status updated and expiry recalculated." });
    },
    [records, moduleById, staffById, logAudit, pushToast, user],
  );

  const rejectRecord = useCallback(
    (recordId: string, reason: string) => {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, approval: "rejected", notes: reason } : r,
        ),
      );
      const rec = records.find((r) => r.id === recordId);
      if (rec) {
        const m = moduleById(rec.moduleId);
        const s = staffById(rec.staffId);
        logAudit({
          user: user?.name ?? "System",
          action: "Rejected certificate",
          entity: `${m.title} · ${s.firstName} ${s.lastName}`,
          category: "evidence",
          field: "Approval",
          previous: "Pending",
          next: "Rejected",
        });
      }
      pushToast({ kind: "info", title: "Certificate returned", body: "Staff member notified to re-submit." });
    },
    [records, moduleById, staffById, logAudit, pushToast, user],
  );

  const uploadEvidence = useCallback(
    (staffId: string, moduleId: string, fileName: string) => {
      const s = staffById(staffId);
      const m = moduleById(moduleId);
      setRecords((prev) => {
        const existing = prev.find((r) => r.staffId === staffId && r.moduleId === moduleId);
        const evidence = {
          id: `e${idSeq++}`,
          fileName,
          fileType: "PDF" as const,
          uploadedBy: `${s.firstName} ${s.lastName}`,
          uploadedAt: "2026-06-27",
          verified: false,
        };
        if (existing) {
          return prev.map((r) =>
            r.id === existing.id
              ? { ...r, approval: "pending" as const, completionDate: "2026-06-27", evidence }
              : r,
          );
        }
        return [
          ...prev,
          {
            id: `r${idSeq++}`,
            staffId,
            moduleId,
            completionDate: "2026-06-27",
            expiryDate: null,
            approval: "pending" as const,
            evidence,
          },
        ];
      });
      logAudit({
        user: user?.name ?? s.firstName,
        action: "Uploaded certificate",
        entity: `${m.title} · ${s.firstName} ${s.lastName}`,
        category: "evidence",
        field: "Evidence",
        previous: "—",
        next: fileName,
      });
      pushToast({ kind: "success", title: "Evidence uploaded", body: "Submitted for approval by the Operations Manager." });
    },
    [staffById, moduleById, logAudit, pushToast, user],
  );

  const addStaff = useCallback(
    (s: Omit<Staff, "id" | "roleLabel" | "avatarColor">) => {
      const id = `s${idSeq++}`;
      const newStaff: Staff = {
        ...s,
        id,
        roleLabel: ROLE_LABELS[s.role],
        avatarColor: ["#0f766e", "#2563eb", "#db2777", "#7c3aed", "#d97706"][idSeq % 5],
      };
      setStaff((prev) => [...prev, newStaff]);
      logAudit({
        user: user?.name ?? "System",
        action: "Created staff profile",
        entity: `${s.firstName} ${s.lastName}`,
        category: "staff",
        field: "Profile",
        previous: "—",
        next: "Created",
      });
      pushToast({ kind: "success", title: "Staff member added", body: `${s.firstName} ${s.lastName} added to the register.` });
    },
    [logAudit, pushToast, user],
  );

  const addModule = useCallback(
    (m: Omit<TrainingModule, "id">) => {
      const id = `m${idSeq++}`;
      setModules((prev) => [...prev, { ...m, id }]);
      logAudit({
        user: user?.name ?? "System",
        action: "Added training module",
        entity: `${m.title} (${m.code})`,
        category: "matrix",
        field: "Module",
        previous: "—",
        next: "Created",
      });
      pushToast({ kind: "success", title: "Module created", body: `${m.title} added to the catalogue.` });
    },
    [logAudit, pushToast, user],
  );

  const toggleModuleRetired = useCallback(
    (moduleId: string) => {
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, retired: !m.retired } : m)),
      );
    },
    [],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const signOffReview = useCallback(
    (reviewId: string) => {
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: "Approved" } : r)),
      );
      logAudit({
        user: user?.name ?? "System",
        action: "Signed off annual review",
        entity: reviews.find((r) => r.id === reviewId)?.scope ?? "Annual review",
        category: "review",
        field: "Status",
        previous: "Awaiting sign-off",
        next: "Approved",
      });
      pushToast({ kind: "success", title: "Review approved", body: "Annual review signed off and logged." });
    },
    [reviews, logAudit, pushToast, user],
  );

  const value: StoreShape = {
    user,
    inspectionMode,
    staff,
    modules,
    records,
    reviews,
    audit,
    notifications,
    toasts,
    computed,
    login,
    logout,
    approveRecord,
    rejectRecord,
    uploadEvidence,
    addStaff,
    addModule,
    toggleModuleRetired,
    markAllNotificationsRead,
    signOffReview,
    pushToast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
