import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Star, Package, ClipboardList, Bell } from "lucide-react";
import { toast } from "sonner";
import { useMyItems, useMyClaims, useMarkReturned, useDeleteItem } from "@/hooks/use-api";
import { useAuthStore } from "@/lib/auth-store";
import type { Item, Claim } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | Campus Find" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  if (!user) {
    void navigate({ to: "/login" });
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Welcome, {user.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Star className="size-4 text-warning fill-warning" />
              <strong className="text-foreground">{user.karmaPoints}</strong> karma points
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium uppercase">{user.role}</span>
          </div>
        </div>
        <Link to="/report"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="size-4" /> Report item
        </Link>
      </div>

      {/* Quick links */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: "/", label: "Browse items", icon: <Package className="size-5" /> },
          { to: "/report", label: "New report", icon: <Plus className="size-5" /> },
          { to: "/notifications", label: "Notifications", icon: <Bell className="size-5" /> },
          { to: "/dashboard", label: "My claims", icon: <ClipboardList className="size-5" /> },
        ].map((link) => (
          <Link key={link.to} to={link.to}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm font-medium hover:border-primary/40 hover:bg-muted transition-all">
            <span className="text-primary">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <MyItemsPanel />
        <MyClaimsPanel />
      </div>
    </div>
  );
}

function MyItemsPanel() {
  const { data, isLoading } = useMyItems();
  const { mutateAsync: markReturned } = useMarkReturned();
  const { mutateAsync: deleteItem } = useDeleteItem();
  const items: Item[] = data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Package className="size-5" /> My Items</h2>
        <Link to="/report" className="text-sm text-primary hover:underline">+ New</Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">You haven't reported any items yet.</p>
          <Link to="/report" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" /> Report now
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item) => (
            <div key={item.id} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-all">
              <div className="size-12 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                {item.images[0] ? (
                  <img src={item.images[0].url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center text-lg">{item.category?.icon ?? "📦"}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link to="/items/$itemId" params={{ itemId: item.id }} className="font-medium hover:text-primary line-clamp-1 transition-colors">
                  {item.title}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn("text-[11px] font-bold uppercase rounded-full px-2 py-0.5",
                    item.type === "LOST" ? "bg-primary/10 text-primary" : "bg-success/10 text-success")}>
                    {item.type}
                  </span>
                  <ItemStatusDot status={item.status} />
                </div>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.status === "CLAIMED" && (
                  <button onClick={async () => {
                    try { await markReturned(item.id); toast.success("Marked returned!"); } catch (e) { toast.error((e as Error).message); }
                  }} className="rounded-md bg-success/10 px-2 py-1 text-[10px] font-semibold text-success hover:bg-success/20 transition-colors">
                    Mark returned
                  </button>
                )}
                <button onClick={async () => {
                  if (!confirm("Delete this item?")) return;
                  try { await deleteItem(item.id); toast.success("Deleted."); } catch (e) { toast.error((e as Error).message); }
                }} className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/20 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyClaimsPanel() {
  const { data, isLoading } = useMyClaims();
  const claims: Claim[] = data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><ClipboardList className="size-5" /> My Claims</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : claims.length === 0 ? (
        <div className="rounded-xl border border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">You haven't claimed any found items yet.</p>
          <Link to="/" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            Browse found items →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.slice(0, 8).map((claim) => (
            <div key={claim.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Claim #{claim.id.slice(0, 8)}…</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(claim.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ClaimStatusBadge status={claim.status} />
                {(claim.status === "PENDING" || claim.status === "APPROVED") && (
                  <Link to="/claims/$claimId/chat" params={{ claimId: claim.id }}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted transition-colors">
                    Chat
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "text-success",
    CLAIMED: "text-warning-foreground",
    RETURNED: "text-success",
    PENDING_REVIEW: "text-muted-foreground",
    EXPIRED: "text-muted-foreground",
  };
  return <span className={cn("text-[11px] capitalize", map[status] ?? "text-muted-foreground")}>{status.toLowerCase().replace(/_/g, " ")}</span>;
}

function ClaimStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-warning/10 text-warning-foreground",
    APPROVED: "bg-success/10 text-success",
    REJECTED: "bg-destructive/10 text-destructive",
    CANCELLED: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}
