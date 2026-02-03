"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import Header from "@/components/dashboard/Header";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatArea from "@/components/dashboard/ChatArea";
import WorkflowPanel from "@/components/dashboard/WorkflowPanel";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isInitializing } = useAuthStore();
  const { fetchDocuments, fetchKnowledgeBases } = useDocumentStore();

  const [leftWidth, setLeftWidth] = useState(320); // Sidebar width
  const [rightWidth, setRightWidth] = useState(320); // Workflow panel width
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isWorkflowCollapsed, setIsWorkflowCollapsed] = useState(false);

  // Calculate actual right width based on collapsed state (w-14 = 56px)
  const actualRightWidth = isWorkflowCollapsed ? 56 : rightWidth;

  // Mouse move handler for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = e.clientX;
        if (newWidth >= 280 && newWidth <= 600) {
          setLeftWidth(newWidth);
        }
      } else if (isResizingRight && !isWorkflowCollapsed) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 280 && newWidth <= 600) {
          setRightWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight, isWorkflowCollapsed]);

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
        {/* Left Sidebar with resize handle */}
        <div className="relative flex" style={{ width: leftWidth }}>
          <Sidebar />
          {/* Resize Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400/50 transition-colors z-10 group"
            onMouseDown={() => setIsResizingLeft(true)}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        </div>

        {/* Chat Area */}
        <ChatArea />

        {/* Right Panel with resize handle */}
        <div className="relative flex" style={{ width: actualRightWidth }}>
          {/* Resize Handle - only show when not collapsed */}
          {!isWorkflowCollapsed && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400/50 transition-colors z-10 group"
              onMouseDown={() => setIsResizingRight(true)}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          )}
          <WorkflowPanel
            isCollapsed={isWorkflowCollapsed}
            onToggleCollapse={setIsWorkflowCollapsed}
          />
        </div>
      </div>
    </div>
  );
}
