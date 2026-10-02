/**
 * React Query hooks for all backend resources.
 * Each hook is a thin wrapper around react-query + the api client.
 */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateItemInput } from "@/lib/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const qk = {
  me: ["me"] as const,
  items: (params?: object) => ["items", params] as const,
  item: (id: string) => ["items", id] as const,
  itemClaims: (id: string) => ["items", id, "claims"] as const,
  myItems: (page?: number) => ["my-items", page] as const,
  myClaims: (page?: number) => ["my-claims", page] as const,
  categories: ["categories"] as const,
  handoverPoints: ["handover-points"] as const,
  messages: (claimId: string) => ["messages", claimId] as const,
  notifications: (page?: number) => ["notifications", page] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  matches: (itemId: string) => ["matches", itemId] as const,
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api.auth.me().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function useItems(params?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: qk.items(params),
    queryFn: () => api.items.list(params),
    staleTime: 30_000,
  });
}

export function useInfiniteItems(params?: Record<string, string | number | undefined>) {
  return useInfiniteQuery({
    queryKey: qk.items(params),
    queryFn: ({ pageParam = 1 }) => api.items.list({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    staleTime: 30_000,
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: qk.item(id),
    queryFn: () => api.items.get(id).then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useMyItems(page = 1) {
  return useQuery({
    queryKey: qk.myItems(page),
    queryFn: () => api.items.myItems({ page }),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItemInput) => api.items.create(body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["items"] });
      void qc.invalidateQueries({ queryKey: ["my-items"] });
    },
  });
}

export function useMarkReturned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.items.markReturned(id).then((r) => r.data),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: qk.item(id) });
      void qc.invalidateQueries({ queryKey: ["my-items"] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.items.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["items"] });
      void qc.invalidateQueries({ queryKey: ["my-items"] });
    },
  });
}

// ─── Categories & Handover Points ─────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => api.categories.list().then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useHandoverPoints() {
  return useQuery({
    queryKey: qk.handoverPoints,
    queryFn: () => api.handoverPoints.list().then((r) => r.data),
    staleTime: Infinity,
  });
}

// ─── Claims ───────────────────────────────────────────────────────────────────

export function useItemClaims(itemId: string) {
  return useQuery({
    queryKey: qk.itemClaims(itemId),
    queryFn: () => api.claims.forItem(itemId).then((r) => r.data),
  });
}

export function useMyClaims(page = 1) {
  return useQuery({
    queryKey: qk.myClaims(page),
    queryFn: () => api.items.myClaims({ page }),
  });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, answer, note }: { itemId: string; answer: string; note?: string }) =>
      api.claims.create(itemId, answer, note).then((r) => r.data),
    onSuccess: (_, { itemId }) => {
      void qc.invalidateQueries({ queryKey: qk.itemClaims(itemId) });
    },
  });
}

export function useDecideClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, status }: { claimId: string; status: "APPROVED" | "REJECTED" }) =>
      api.claims.decide(claimId, status).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["items"] });
      void qc.invalidateQueries({ queryKey: ["my-items"] });
    },
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useMessages(claimId: string) {
  return useQuery({
    queryKey: qk.messages(claimId),
    queryFn: () => api.messages.list(claimId).then((r) => r.data),
    refetchInterval: 10_000, // poll as fallback to sockets
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, body }: { claimId: string; body: string }) =>
      api.messages.send(claimId, body).then((r) => r.data),
    onSuccess: (_, { claimId }) => {
      void qc.invalidateQueries({ queryKey: qk.messages(claimId) });
    },
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useNotifications(page = 1) {
  return useQuery({
    queryKey: qk.notifications(page),
    queryFn: () => api.notifications.list(page),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.unreadCount,
    queryFn: () => api.notifications.unreadCount().then((r) => r.data.count),
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
