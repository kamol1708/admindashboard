import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eduma Style Education Landing",
  description: "Tailwind CSS bilan qurilgan education website landing page",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body className="antialiased">{children}</body>
    </html>
  );
}
