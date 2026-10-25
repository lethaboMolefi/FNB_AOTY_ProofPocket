import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { ToastProvider } from "./components/ui";
import { AuthProvider } from "./lib/auth";
import { setOnSent, startOutbox } from "./lib/outbox";
import { DemoBanner } from "./components/layout/DemoBanner";
import { UpdatePrompt } from "./lib/pwa";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // Cached reads (service worker) let screens open with low or no data; refetch when back online.
    queries: { networkMode: "offlineFirst", refetchOnWindowFocus: false },
  },
});

// After offline items reach the server, refresh the founder screens.
setOnSent(() => { void queryClient.invalidateQueries(); });
startOutbox();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <DemoBanner />
          <UpdatePrompt />
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
