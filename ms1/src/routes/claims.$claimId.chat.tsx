import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMessages, useSendMessage, qk } from "@/hooks/use-api";
import { useAuthStore } from "@/lib/auth-store";
import { onSocketEvent } from "@/lib/socket";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/claims/$claimId/chat")({
  head: () => ({ meta: [{ title: "Chat | Campus Find" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { claimId } = Route.useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: messages = [], isLoading } = useMessages(claimId);
  const { mutateAsync: sendMsg, isPending } = useSendMessage();

  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read on mount
  useEffect(() => {
    void api.messages.markRead(claimId).catch(() => {});
  }, [claimId]);

  // Real-time: listen for new messages via socket
  useEffect(() => {
    const off = onSocketEvent("message:new", (msg: Message) => {
      if (msg.claimId !== claimId) return;
      qc.setQueryData(qk.messages(claimId), (old: Message[] | undefined) =>
        old ? [...old.filter((m) => m.id !== msg.id), msg] : [msg],
      );
    });
    return off;
  }, [claimId, qc]);

  if (!user) {
    void navigate({ to: "/login" });
    return null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    try {
      await sendMsg({ claimId, body: text });
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to send");
      setBody(text);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button onClick={() => void navigate({ to: "/dashboard" })}
          className="rounded-full p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="font-semibold text-sm">Claim Chat</h1>
          <p className="text-xs text-muted-foreground">Claim #{claimId.slice(0, 8)}…</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-2xl mb-2">💬</p>
              <p className="text-sm font-medium text-foreground">Start the conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">Arrange handover details here, securely.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderId === user.id} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            className="flex-1 rounded-full border border-border bg-muted px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary transition-colors"
          />
          <button type="submit" disabled={isPending || !body.trim()}
            className="grid size-10 flex-shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5",
        isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <p className={cn("mt-1 text-right text-[10px]", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
          {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          {isOwn && msg.readAt && " ✓✓"}
        </p>
      </div>
    </div>
  );
}
