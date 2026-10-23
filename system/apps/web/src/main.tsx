import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { ToastProvider } from "./components/ui";
import { AuthProvider } from "./lib/auth";
import { UpdatePrompt } from "./lib/pwa";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // Cached reads (service worker) let screens open with low or no data; refetch when back online.
    queries: { networkMode: "offlineFirst", refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <UpdatePrompt />
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
