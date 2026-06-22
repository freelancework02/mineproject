import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export function useProtectedRoute() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.configured && !auth.loading && !auth.session) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [auth.configured, auth.loading, auth.session, router]);

  return auth;
}
