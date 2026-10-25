import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Red counts on the navigation (things waiting for you). Refreshed when screens change data. */
export function useCounts() {
  return useQuery({ queryKey: ["founder", "counts"], queryFn: () => api<Record<string, number>>("/me/counts"), staleTime: 30_000 }).data ?? {};
}
