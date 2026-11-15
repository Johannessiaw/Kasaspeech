import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StudioShell } from "@/components/studio-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "KasaSpeech AI Studio",
  description: "Ghanaian Speech Intelligence. Built for Everyone.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <StudioShell>{children}</StudioShell>
      </body>
    </html>
  );
}
