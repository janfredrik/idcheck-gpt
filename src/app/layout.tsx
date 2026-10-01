import type { Metadata } from "next";
import { JetBrains_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";

const sans = Nunito_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-nunito-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "idcheck — sikker kontogjenoppretting",
  description: "Selvbetjent og sikker kontogjenoppretting for organisasjonen din."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="no" className={`${sans.variable} ${mono.variable}`}><body>{children}</body></html>;
}
