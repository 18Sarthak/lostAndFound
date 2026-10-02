import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, Plus, User, X } from "lucide-react";
import { Toaster, toast } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useAuthStore } from "../lib/auth-store";
import { api } from "../lib/api";
import { useUnreadCount } from "../hooks/use-api";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try refreshing or go home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Campus Find" },
      { name: "description", content: "A private, campus-wide lost and found service." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: unread = 0 } = useUnreadCount();

  async function handleLogout() {
    try { await api.auth.logout(); } catch { /* ignore */ }
    clearAuth();
    void navigate({ to: "/" });
    toast.success("Logged out");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">C</span>
          <span className="leading-tight hidden sm:block">
            <span className="block font-display text-[17px] font-semibold">Campus Find</span>
            <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Lost & Found</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-foreground/70 md:flex">
          <Link to="/" className="transition-colors hover:text-primary [&.active]:text-primary">Browse</Link>
          {user && <Link to="/dashboard" className="transition-colors hover:text-primary [&.active]:text-primary">Dashboard</Link>}
          <Link to="/report" className="transition-colors hover:text-primary [&.active]:text-primary">Report Item</Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/notifications" className="relative rounded-full p-2 hover:bg-muted transition-colors">
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link to="/dashboard" className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                <User className="size-4" />
                <span className="hidden sm:block max-w-[120px] truncate">{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Logout">
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-foreground/60 hover:text-primary transition-colors">Sign in</Link>
              <Link to="/report" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="size-4" />Report
              </Link>
            </>
          )}
          <button className="md:hidden p-2 rounded-md hover:bg-muted" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-3 text-sm font-medium">
          <Link to="/" onClick={() => setMenuOpen(false)} className="hover:text-primary">Browse</Link>
          {user && <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="hover:text-primary">Dashboard</Link>}
          <Link to="/report" onClick={() => setMenuOpen(false)} className="hover:text-primary">Report Item</Link>
          {!user && <Link to="/login" onClick={() => setMenuOpen(false)} className="hover:text-primary">Sign In</Link>}
          {user && <button onClick={() => { setMenuOpen(false); void handleLogout(); }} className="text-left text-destructive hover:underline">Logout</button>}
        </div>
      )}
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Navbar />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
