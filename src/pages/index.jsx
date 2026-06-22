import { useEffect } from "react";
import { useRouter } from "next/router";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { configured, loading, session } = useAuth();

  useEffect(() => {
    if (configured && !loading) {
      router.replace(session ? "/dashboard" : "/login");
    }
  }, [configured, loading, router, session]);

  if (!configured) {
    return <SupabaseSetupNotice />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
      Loading CRM...
    </main>
  );
}
