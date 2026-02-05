"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/authStore";

export default function SignupPage() {
  const router = useRouter();
  const { signup, login, isLoading, error, clearError } = useAuthStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await signup({ firstName, lastName, email, password });
      // Auto-login after signup
      await login({ email, password });
      router.push("/dashboard");
    } catch (err) {
      // Error is already handled in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">SoldierIQ</h1>
          <p className="text-zinc-400">Tactical Intelligence Knowledge Management</p>
        </div>

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Sign Up</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-zinc-300 mb-2">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="John"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-zinc-300 mb-2">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-400">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
