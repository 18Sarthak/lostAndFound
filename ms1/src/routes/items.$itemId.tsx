import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MapPin, Calendar, ArrowLeft, Flag, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useItem, useItemClaims, useSubmitClaim, useMarkReturned } from "@/hooks/use-api";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Claim, Item } from "@/lib/types";

export const Route = createFileRoute("/items/$itemId")({
  head: () => ({ meta: [{ title: "Item | Campus Find" }] }),
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { itemId } = Route.useParams();
  const { user } = useAuthStore();
  const { data: item, isLoading } = useItem(itemId);
  const isOwner = user?.id === item?.userId;

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!item) return <div className="py-24 text-center text-muted-foreground">Item not found.</div>;

  const isLost = item.type === "LOST";
  const primaryImg = item.images[0]?.url;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left */}
        <div>
          <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
            {primaryImg ? (
              <img src={primaryImg} alt={item.title} className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center text-6xl opacity-20">📦</div>
            )}
            <span
              className={cn(
                "absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase text-white",
                isLost ? "bg-primary" : "bg-success",
              )}
            >
              {isLost ? "Lost" : "Found"}
            </span>
          </div>

          {item.images.length > 1 && (
            <div className="mb-6 flex gap-2 overflow-x-auto">
              {item.images.map((img) => (
                <img
                  key={img.id}
                  src={img.url}
                  alt=""
                  className="size-20 flex-shrink-0 rounded-lg object-cover border border-border"
                />
              ))}
            </div>
          )}

          <h1 className="font-display text-3xl font-semibold">{item.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">{item.category.name}</span>
            <StatusBadge status={item.status} />
          </div>

          <p className="mt-4 text-foreground/80 leading-relaxed">{item.description}</p>

          <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            {item.locationName && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                <span>{item.locationName}</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
              <span>
                {isLost ? "Lost" : "Found"} on{" "}
                {new Date(item.eventDate).toLocaleDateString("en-IN", { dateStyle: "long" })}
              </span>
            </div>
            {item.handoverPoint && (
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-4 flex-shrink-0 text-success" />
                <span>
                  Kept at <strong>{item.handoverPoint.name}</strong>
                  {item.handoverPoint.openingHours && ` · ${item.handoverPoint.openingHours}`}
                </span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
              <span>
                Posted by <strong>{item.user.name}</strong> · {formatTimeAgo(item.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {isOwner && <OwnerActions item={item} itemId={itemId} />}

          {!isLost && !isOwner && item.status === "ACTIVE" && user && (
            <ClaimForm itemId={itemId} verificationQuestion={item.verificationQuestion} />
          )}

          {!isLost && !isOwner && item.status === "ACTIVE" && !user && (
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Sign in
                </Link>{" "}
                to claim this item
              </p>
            </div>
          )}

          {isOwner && !isLost && <ClaimsPanel itemId={itemId} />}

          {!isOwner && user && <ReportButton itemId={itemId} />}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Active", cls: "bg-success/10 text-success" },
    CLAIMED: { label: "Claimed", cls: "bg-warning/10 text-warning-foreground" },
    RETURNED: { label: "Returned ✓", cls: "bg-success/20 text-success" },
    PENDING_REVIEW: { label: "Under review", cls: "bg-muted text-muted-foreground" },
    EXPIRED: { label: "Expired", cls: "bg-muted text-muted-foreground" },
    REMOVED: { label: "Removed", cls: "bg-destructive/10 text-destructive" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("rounded-full px-3 py-1", cls)}>{label}</span>;
}

function OwnerActions({ item, itemId }: { item: Item; itemId: string }) {
  const { mutateAsync: markReturned, isPending } = useMarkReturned();

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Your listing</p>
      <StatusBadge status={item.status} />
      {item.status === "CLAIMED" && (
        <button
          onClick={async () => {
            try {
              await markReturned(itemId);
              toast.success("Marked as returned! Karma awarded.");
            } catch (err: unknown) {
              toast.error((err as Error).message);
            }
          }}
          disabled={isPending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-success py-2.5 text-sm font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}✓ Mark as returned
        </button>
      )}
    </div>
  );
}

function ClaimForm({
  itemId,
  verificationQuestion,
}: {
  itemId: string;
  verificationQuestion: string | null;
}) {
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { mutateAsync, isPending } = useSubmitClaim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutateAsync({ itemId, answer: answer.trim(), ...(note.trim() && { note: note.trim() }) });
      toast.success("Claim submitted! The finder will review it.");
      setSubmitted(true);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to submit claim");
    }
  }

  if (submitted)
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center">
        <CheckCircle className="mx-auto mb-2 size-8 text-success" />
        <p className="font-semibold text-success">Claim submitted!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The finder will review your claim and contact you via secure chat.
        </p>
      </div>
    );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-lg font-semibold">Claim this item</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {verificationQuestion && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {verificationQuestion} <span className="text-destructive">*</span>
            </label>
            <input
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Any extra details…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || (!!verificationQuestion && !answer.trim())}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-success py-2.5 text-sm font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Submit claim
        </button>
      </form>
    </div>
  );
}

function ClaimsPanel({ itemId }: { itemId: string }) {
  const { data: claims = [], isLoading } = useItemClaims(itemId);
  const qc = useQueryClient();
  const { mutateAsync: decide, isPending } = useMutation({
    mutationFn: ({ claimId, status }: { claimId: string; status: "APPROVED" | "REJECTED" }) =>
      api.claims.decide(claimId, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Decision saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (claims.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        No claims yet.
      </div>
    );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-lg font-semibold">Claims ({claims.length})</h2>
      <div className="space-y-3">
        {claims.map((c: Claim) => (
          <div key={c.id} className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                  c.status === "APPROVED"
                    ? "bg-success/10 text-success"
                    : c.status === "REJECTED"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {c.status}
              </span>
              {c.answerMatches !== null && (
                <span
                  className={cn("text-xs font-semibold", c.answerMatches ? "text-success" : "text-destructive")}
                >
                  {c.answerMatches ? "✓ Answer matched" : "✗ Wrong answer"}
                </span>
              )}
            </div>
            {c.note && <p className="mb-3 text-sm text-foreground/70">{c.note}</p>}
            {c.status === "PENDING" && (
              <div className="flex gap-2">
                <button
                  onClick={() => void decide({ claimId: c.id, status: "APPROVED" })}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-success py-1.5 text-xs font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-60 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => void decide({ claimId: c.id, status: "REJECTED" })}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-destructive py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60 transition-colors"
                >
                  Reject
                </button>
                <Link
                  to="/claims/$claimId/chat"
                  params={{ claimId: c.id }}
                  className="flex-1 rounded-lg border border-border py-1.5 text-center text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Chat
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportButton({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.apiFetch(`/items/${itemId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason, details }),
      });
      toast.success("Report submitted.");
      setOpen(false);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <Flag className="size-3.5" /> Report this item
      </button>
    );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold">Report item</h3>
      <form onSubmit={submit} className="space-y-3">
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
        >
          {["SPAM", "FAKE_CLAIM", "INAPPROPRIATE", "PRIVACY_VIOLATION", "OTHER"].map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <textarea
          rows={2}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Details (optional)"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-destructive py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 transition-colors"
          >
            Submit report
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-lg border border-border py-2 text-xs hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
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
