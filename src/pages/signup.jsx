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
import { authApi } from "@/utils/api";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export default function SignupPage() {
  const router = useRouter();
  const { configured, supabase } = useAuth();
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ resolver: zodResolver(signupSchema) });

  if (!configured) {
    return <SupabaseSetupNotice />;
  }

  async function onSubmit(values) {
    setSubmitting(true);
    setFormError("");
    setNotice("");

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { name: values.name }
      }
    });

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    if (data.session) {
      const client = await authApi();
      await client.post("/api/auth/profile", {
        name: values.name,
        email: values.email
      });
      router.replace("/dashboard");
      return;
    }

    setNotice("Check your email to confirm your account, then sign in.");
    setSubmitting(false);
  }

  return (
    <AuthCard title="Create account" subtitle="Start with a secure agent profile.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <TextInput label="Name" type="text" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <TextInput label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {formError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{formError}</p> : null}
        {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-medium text-brand hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
