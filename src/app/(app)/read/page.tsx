import type { Metadata } from "next";
import { ReadingSurface } from "./reading-surface";

export const metadata: Metadata = {
  title: "Redline — read a document",
  description:
    "Put a document in and read what it commits you to, line by line, every line quoting the sentence it came from.",
};

/**
 * The working surface. No account is needed to reach it: the analysis runs
 * with the Supabase configuration absent, because only the library and the
 * reader's own red lines need an account, and neither is built yet.
 */
export default function ReadPage() {
  return <ReadingSurface />;
}
