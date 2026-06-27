import { useStore } from "../store/store";
import { Icon } from "./Icon";

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span className="ti">
            <Icon name={t.kind === "error" ? "x" : t.kind === "info" ? "bell" : "check"} size={13} />
          </span>
          <div>
            <b>{t.title}</b>
            {t.body && <span>{t.body}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
