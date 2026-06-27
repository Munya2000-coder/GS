import { useStore } from "../store/store";
import { Badge, Button, Card, Empty } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";
import type { NotificationItem } from "../data/types";

const TYPE_META: Record<NotificationItem["type"], { icon: IconName; tone: "red" | "amber" | "blue" | "green" | "violet" | "grey" }> = {
  escalation: { icon: "alert", tone: "red" },
  approval: { icon: "upload", tone: "blue" },
  expiry: { icon: "clock", tone: "amber" },
  review: { icon: "clipboard", tone: "violet" },
  booking: { icon: "calendar", tone: "green" },
  system: { icon: "bell", tone: "grey" },
};

const CHANNEL_ICON: Record<string, IconName> = { Email: "mail", SMS: "phone", "In-system": "bell" };

function ago(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Notifications() {
  const { notifications, markAllNotificationsRead } = useStore();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>Multi-channel alerts — email, SMS and in-system — for expiring training, approvals, escalations and reviews.</p>
        </div>
        {unread > 0 && (
          <Button icon="check" onClick={markAllNotificationsRead}>Mark all read</Button>
        )}
      </div>

      <Card>
        {notifications.length === 0 ? (
          <Empty icon="bell" title="No notifications" />
        ) : (
          <div>
            {notifications.map((n) => {
              const m = TYPE_META[n.type];
              return (
                <div
                  key={n.id}
                  className="row gap-14 items-start"
                  style={{
                    padding: "16px 18px",
                    borderBottom: "1px solid var(--border)",
                    background: n.read ? "transparent" : "var(--brand-50)",
                  }}
                >
                  <span className={`kpi-icon`} style={{ background: `var(--${m.tone === "grey" ? "surface-3" : m.tone + "-bg"})`, color: `var(--${m.tone === "grey" ? "muted" : m.tone + "-ink"})`, flexShrink: 0 }}>
                    <Icon name={m.icon} size={19} />
                  </span>
                  <div className="flex-1">
                    <div className="row gap-8 wrap" style={{ alignItems: "center" }}>
                      <b style={{ fontSize: 13.5 }}>{n.title}</b>
                      {n.priority === "high" && <Badge tone="red">High</Badge>}
                      {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand-500)" }} />}
                    </div>
                    <p className="small muted" style={{ margin: "3px 0 8px" }}>{n.body}</p>
                    <div className="row gap-10 small muted">
                      <span>{ago(n.time)}</span>
                      <span style={{ color: "var(--border-strong)" }}>·</span>
                      {n.channel.map((c) => (
                        <span key={c} className="row gap-4">
                          <Icon name={CHANNEL_ICON[c]} size={12} /> {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
