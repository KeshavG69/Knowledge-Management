import type { Metadata } from "next";
import "./globals.css";
import AuthInitializer from "@/components/auth/AuthInitializer";

export const metadata: Metadata = {
  title: "SoldierIQ - Knowledge Management",
  description: "Tactical Intelligence Knowledge Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}
