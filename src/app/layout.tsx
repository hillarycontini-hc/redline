import type { Metadata } from "next";
import { Archivo, Archivo_Narrow, Tinos } from "next/font/google";
import "./globals.css";

/** Column heads, figures, and everything the product says in its own voice. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  display: "swap",
});

/** The statement's caps roles: masthead, column heads, tier words, marks. */
const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

/** Times-metric. Every specimen of the reader's document is set in it. */
const tinos = Tinos({
  variable: "--font-tinos",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Redline — what a contract commits you to, line by line",
  description:
    "Redline reads a contract, lease, freelance agreement, or terms of service and returns a statement of what it commits you to, every line quoting the sentence it came from.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoNarrow.variable} ${tinos.variable}`}>
      <body>{children}</body>
    </html>
  );
}
