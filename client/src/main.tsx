import { redirectToLoginIfUnauthorized } from "@/lib/authRedirect";
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { APP_TITLE } from "./const";
import "./index.css";

// Reflect the configured brand name in the browser tab.
if (typeof document !== "undefined") {
  document.title = APP_TITLE;
}

const queryClient = new QueryClient();

// Optional self-hosted Umami analytics — only loaded when both env vars are configured,
// since an unset endpoint can't be turned into a valid script src.
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (analyticsEndpoint && analyticsWebsiteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint}/umami`;
  script.dataset.websiteId = analyticsWebsiteId;
  document.head.appendChild(script);
}

// See client/src/lib/authRedirect.ts: a session that expires (or never existed) used to
// leave every page silently rendering its own "0 accounts" empty state, with no
// indication a sign-in was needed. This was disabled here, pointed at OAuth
// infrastructure the app has never had; it's re-enabled now against /login, the login
// page this app actually has.
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Routers whose procedures call an LLM and can take tens of seconds. Batching these with
// ordinary data queries makes the whole batch wait on the slowest member, so a single
// account brief would stall the intent signals, contacts and pipeline cards behind it.
// These travel on their own unbatched requests instead.
const SLOW_AI_ROUTERS = [
  "ai.",
  "intel.",
  "deepThink.",
  "bulkInsights.",
  "outreach.",
  "tools.",
  "gemini.",
  "dust.",
];

const withCredentials = (input: RequestInfo | URL, init?: RequestInit) =>
  globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => SLOW_AI_ROUTERS.some((prefix) => op.path.startsWith(prefix)),
      // Slow AI work: one request each, so it never blocks anything else.
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: withCredentials,
      }),
      // Everything else keeps the batching win.
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: withCredentials,
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
