import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AuthInitializer from "@/components/auth/AuthInitializer";
import ThemeProvider from "@/components/ThemeProvider";

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
      <head>
        <link
          href="https://assets.calendly.com/assets/external/widget.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthInitializer />
          {children}
        </ThemeProvider>
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
