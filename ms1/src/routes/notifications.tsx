import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useNotifications, useMarkAllRead } from "@/hooks/use-api";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications | Campus Find" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useNotifications();
  const { mutateAsync: markAll } = useMarkAllRead();

  if (!user) {
    void navigate({ to: "/login" });
    return null;
  }

  const notifications: Notification[] = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  async function handleMarkAll() {
    try {
      await markAll();
      toast.success("All notifications marked as read");
      void refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  async function handleMarkOne(id: string) {
    try {
      await api.notifications.markRead(id);
      void refetch();
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Bell className="size-6" /> Notifications
          </h1>
          {unread > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <button onClick={handleMarkAll}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
            <BellOff className="size-4" /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Bell className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={() => void handleMarkOne(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

const iconMap: Record<string, string> = {
  MATCH_FOUND: "🎯",
  CLAIM_RECEIVED: "📨",
  CLAIM_APPROVED: "✅",
  CLAIM_REJECTED: "❌",
  NEW_MESSAGE: "💬",
  ITEM_RETURNED: "🎉",
  ITEM_EXPIRING: "⚠️",
  SYSTEM: "📢",
};

function NotificationItem({ notification: n, onRead }: { notification: Notification; onRead: () => void }) {
  return (
    <div
      onClick={onRead}
      className={cn(
        "flex cursor-pointer items-start gap-4 rounded-xl border px-4 py-3.5 transition-all hover:border-primary/30",
        n.isRead ? "border-border bg-card opacity-70" : "border-primary/20 bg-primary/5",
      )}
    >
      <span className="text-2xl flex-shrink-0">{iconMap[n.type] ?? "🔔"}</span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", !n.isRead && "font-semibold")}>{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">{formatTimeAgo(n.createdAt)}</p>
      </div>
      {!n.isRead && <span className="mt-1.5 size-2 flex-shrink-0 rounded-full bg-primary" />}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
