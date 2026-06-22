import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthCard from "@/components/auth/AuthCard";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import TextInput from "@/components/auth/TextInput";
import { useAuth } from "@/context/AuthContext";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

export default function LoginPage() {
  const router = useRouter();
  const { configured, supabase } = useAuth();
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ resolver: zodResolver(loginSchema) });

  if (!configured) {
    return <SupabaseSetupNotice />;
  }

  async function onSubmit(values) {
    setSubmitting(true);
    setFormError("");

    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    const next = typeof router.query.next === "string" ? router.query.next : "/dashboard";
    router.replace(next);
  }

  return (
    <AuthCard title="Sign in" subtitle="Access your protected CRM workspace.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <TextInput label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {formError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{formError}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Need an account?{" "}
        <Link className="font-medium text-brand hover:underline" href="/signup">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}
