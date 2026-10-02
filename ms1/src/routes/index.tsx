import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, MapPin, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useInfiniteItems, useCategories } from "@/hooks/use-api";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "Campus Find | Lost & Found" },
      { name: "description", content: "Search and report lost or found items on campus — no phone numbers shared." },
    ],
  }),
  component: Index,
}));

type TabType = "ALL" | "LOST" | "FOUND";

function Index() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tab, setTab] = useState<TabType>("ALL");
  const [categoryId, setCategoryId] = useState<number | undefined>();

  const { data: categories = [] } = useCategories();

  const params = {
    ...(submitted && { q: submitted }),
    ...(tab !== "ALL" && { type: tab }),
    ...(categoryId && { categoryId }),
    limit: 12,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteItems(params);

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-success" />
          <span className="text-xs font-semibold uppercase text-foreground/50">Live board</span>
        </div>
        <h1 className="max-w-2xl font-display text-[42px] font-semibold leading-[1.04] sm:text-[52px]">
          Left something on campus?<br />
          <span className="italic text-primary">Let&apos;s get it home.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-6 text-foreground/60">
          Search active listings, report what you lost or found — no phone numbers, ever.
        </p>

        <form onSubmit={onSearch} className="mt-7 flex max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:flex-row sm:rounded-full">
          <label className="flex flex-1 items-center gap-2 border-b border-border px-4 sm:border-b-0 sm:border-r">
            <Search className="size-4 text-foreground/40" />
            <span className="sr-only">Search listings</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-foreground/40"
              placeholder="Search the board…"
            />
          </label>
          <label className="flex items-center border-b border-border px-4 sm:border-b-0 sm:border-r">
            <span className="sr-only">Category</span>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-transparent py-3.5 text-sm text-foreground/70 outline-none sm:w-auto"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button type="submit" className="h-auto bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground sm:rounded-r-full hover:bg-primary/90 transition-colors">
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-foreground/45">Popular:</span>
          {["AirPods", "Water bottle", "Student ID", "Keys"].map((term) => (
            <button key={term} onClick={() => { setQuery(term); setSubmitted(term); }}
              className="rounded-full border border-border px-3 py-1 hover:bg-muted transition-colors">
              {term}
            </button>
          ))}
        </div>
      </section>

      {/* Tab bar */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end gap-2 border-b border-border">
          {(["ALL", "LOST", "FOUND"] as TabType[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("h-11 rounded-none border-b-2 px-4 text-sm font-medium transition-colors sm:px-6",
                tab === t ? "border-primary text-primary" : "border-transparent text-foreground/55 hover:text-foreground")}>
              {t === "ALL" ? "All items" : t === "LOST" ? "Lost" : "Found"}
            </button>
          ))}
          <span className="ml-auto hidden pb-3 text-xs text-foreground/45 sm:block">Most recent</span>
        </div>
      </section>

      {/* Listings */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="border-y border-border py-16 text-center">
            <h3 className="font-display text-xl font-semibold">No items yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Be the first to report something.</p>
            <Link to="/report" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Report an item <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => <ItemCard key={item.id} item={item} />)}
            </div>
            {hasNextPage && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60">
                  {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-foreground/50 sm:flex-row">
          <span className="font-display font-semibold text-foreground/70">Campus Find · Lost & Found</span>
          <span>Reported items stay private — no phone numbers shared.</span>
          <Link to="/login" className="font-semibold text-primary hover:underline">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const isLost = item.type === "LOST";
  const img = item.images[0]?.url;
  const timeAgo = getTimeAgo(item.createdAt);

  return (
    <Link to="/items/$itemId" params={{ itemId: item.id }}>
      <article className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {img ? (
            <img src={img} alt={item.title} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="size-full flex items-center justify-center text-4xl text-muted-foreground/30">
              {item.category.icon ?? "📦"}
            </div>
          )}
          <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase text-white",
            isLost ? "bg-primary" : "bg-success")}>
            {isLost ? "Lost" : "Found"}
          </span>
          {item.status === "CLAIMED" && (
            <span className="absolute right-3 top-3 rounded-full bg-warning px-2.5 py-1 text-[11px] font-bold uppercase text-warning-foreground">Claimed</span>
          )}
          {item.status === "RETURNED" && (
            <span className="absolute right-3 top-3 rounded-full bg-success/80 px-2.5 py-1 text-[11px] font-bold uppercase text-white">Returned</span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-display text-[17px] font-semibold leading-snug line-clamp-1">{item.title}</h3>
          <p className="mt-1 text-xs text-foreground/55 line-clamp-2">{item.description}</p>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-3 text-[11px] text-foreground/45">
              {item.locationName && (
                <span className="flex items-center gap-1"><MapPin className="size-3" />{item.locationName}</span>
              )}
              <span className="flex items-center gap-1"><Calendar className="size-3" />{timeAgo}</span>
            </div>
            <span className={cn("text-xs font-semibold", isLost ? "text-primary" : "text-success")}>
              View →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}