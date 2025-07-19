import type { Metadata } from "next";
import React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wyvern",
  authors: [
    {
      name: "Wyvern Team"
    }
  ],
  description: "An AI tool for exploring and interacting with Dungeons & Dragons 5th Edition content & more!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}



