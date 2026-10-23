import type { Me, Role } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "./api";
import { useAuth } from "./auth";

export const meKey = ["me"] as const;

export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: meKey,
    queryFn: () => api<Me>("/me"),
    enabled: status === "signedIn",
    retry: (count, err) => !(err instanceof ApiError && [401, 403].includes(err.status)) && count < 2,
    staleTime: 60_000,
  });
}

/** Where each role lands after signing in. */
export const HOME_FOR: Record<Role, string> = {
  founder: "/app",
  funder: "/funder",
  adviser: "/adviser",
  admin: "/admin",
  buyer: "/directory",
};
