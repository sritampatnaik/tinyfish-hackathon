import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hume Video Analyzer",
  description:
    "Analyze bundled speaking clips with Hume Expression Measurement in a polished Next.js dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
