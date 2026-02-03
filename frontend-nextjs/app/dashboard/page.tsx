"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import Header from "@/components/dashboard/Header";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatArea from "@/components/dashboard/ChatArea";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isInitializing } = useAuthStore();
  const { fetchDocuments, fetchKnowledgeBases } = useDocumentStore();

  useEffect(() => {
    if (!isInitializing && !user) {
      router.push("/auth/login");
    }
  }, [user, isInitializing, router]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
      fetchKnowledgeBases();
    }
  }, [user, fetchDocuments, fetchKnowledgeBases]);

  if (isInitializing || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ChatArea />
      </div>
    </div>
  );
}
