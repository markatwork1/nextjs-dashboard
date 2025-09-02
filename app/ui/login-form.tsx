"use client";
 
import { lusitana } from "@/app/ui/fonts";
import { AtSymbolIcon, KeyIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { Button } from "@/app/ui/button";
import { useEffect, useState } from "react";
 
export default function LoginForm() {
  const [state, setState] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get callbackUrl from query string
  let callbackUrl = "/dashboard";
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    callbackUrl = params.get("callbackUrl") || "/dashboard";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement & {
      email: { value: string };
      password: { value: string };
    };
    const email = form.email.value;
    const password = form.password.value;
    setIsSubmitting(true);
    setState(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, redirectTo: callbackUrl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ message: json.message || "Login failed", errors: json.errors || [] });
        return;
      }
      // success: server should set auth cookie; redirect
      const redirect = json.redirect || callbackUrl;
      window.location.assign(redirect);
    } catch (err) {
      setState({ message: "Network error", errors: [String(err)] });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-4 pt-8">
        <h1 className={`${lusitana.className} mb-3 text-2xl`}>
          Please log in to continue.
        </h1>
        <div className="w-full">
          <div>
            <label className="mb-3 mt-5 block text-xs font-medium text-gray-900" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
              />
              <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
            <label className="mb-3 mt-5 block text-xs font-medium text-gray-900" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="password"
                type="password"
                name="password"
                placeholder="Enter password"
                required
                minLength={6}
              />
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
          </div>
        </div>
        <input type="hidden" name="redirectTo" value={callbackUrl} />
  <Button className="mt-4 w-full" aria-disabled={isSubmitting}>
          Log in <ArrowRightIcon className="ml-auto h-5 w-5 text-gray-50" />
        </Button>
        <div className="flex h-8 items-end space-x-1" aria-live="polite" aria-atomic="true">
          {typeof state?.message === "string" && state.message && (
            <>
              <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-500">{state.message}</p>
            </>
          )}
          {Array.isArray(state?.errors) && state.errors.length > 0 && (
            <ul className="text-red-600 text-sm" role="alert">
              {state.errors.map((err: string, idx: number) => (
                <li key={idx}>{typeof err === "string" ? err : String(err)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </form>
  );
}