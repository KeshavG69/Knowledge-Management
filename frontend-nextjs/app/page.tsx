"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";

export default function Home() {
  const router = useRouter();
  const { user, isInitializing } = useAuthStore();

  useEffect(() => {
    if (!isInitializing) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/auth/login");
      }
    }
  }, [user, isInitializing, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-white">Loading...</div>
    </div>
  );
}
