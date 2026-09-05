"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminLogin } from "@/lib/client/endpoints";
import { errorCode } from "@/lib/client/errors";
import { TextField } from "@/components/ui/form";
import { Button } from "@/components/ui/Button";

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin/orders";
  const { admin, ready, setAdmin } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && admin) router.replace(next);
  }, [ready, admin, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const identity = await adminLogin(email.trim(), password);
      setAdmin(identity);
      router.replace(next);
    } catch (err) {
      const code = errorCode(err);
      if (code === "ACCOUNT_LOCKED") {
        setError("This account is temporarily locked after too many attempts. Try again later.");
      } else if (code === "RATE_LIMITED") {
        setError("Too many attempts. Wait a moment and try again.");
      } else {
        setError("Incorrect email or password.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="font-display text-lg font-medium text-[var(--color-text)]">
            Carnivore Lagos
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-subtle)]">
            Admin sign in
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-raise)]"
        >
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p className="text-[12.5px] text-[var(--color-danger)]">{error}</p>
          ) : null}
          <Button type="submit" fullWidth loading={busy}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
