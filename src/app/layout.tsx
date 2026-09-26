import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "idcheck — sikker kontogjenoppretting",
  description: "Selvbetjent og sikker kontogjenoppretting for organisasjonen din."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="no"><body>{children}</body></html>;
}
