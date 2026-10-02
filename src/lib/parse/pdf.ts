/**
 * PDF to text, in the browser, with PDF.js. The file never leaves the client;
 * only the string this returns does.
 *
 * Two things matter here and nothing else does.
 *
 * **Fidelity.** A quoted sentence has to be findable in what comes out, under
 * the whitespace-and-quotes normalisation in `../analysis/normalize.ts` and
 * nothing looser. So the text items are joined exactly as the page lays them
 * out — each item's own characters, a newline where PDF.js says the line
 * ended, a blank line between pages. Nothing is reflowed, nothing is stripped,
 * and no word is rewritten. `disableNormalization` is on for the same reason:
 * PDF.js's own text normalisation is the one place it would alter the
 * document's characters, and this module shows the reader their characters.
 *
 * **No character recognition.** PDF.js reads the text layer a PDF carries and
 * has no path to recognising glyphs in an image, which is why it was the one
 * chosen. A PDF whose pages carry no text layer returns an empty string from
 * here and the caller refuses it. Reading the page images instead would
 * produce citations into text that was guessed at, and a citation you cannot
 * check is worse than none (ADR 0001).
 */

/**
 * The worker, started once per page load and kept. PDF.js parses on a worker
 * thread, so the main thread stays answerable while a long contract is read.
 *
 * The worker is bundled out of `node_modules` and served from this origin —
 * never fetched from a CDN, which would leak that a document is being read and
 * would stop working the moment the reader is offline.
 */
let worker: Worker | null = null;

async function loadPdfjs() {
  // The legacy build, deliberately, and not for old browsers' sake. The
  // generic build calls `Uint8Array.prototype.toHex`, which Node 24 does not
  // have and which only arrived in browsers in late 2025, so it throws on
  // every document under `node --test` and on any browser a year behind.
  // The legacy build carries the polyfill, which means the tests run the
  // parser the reader runs rather than a substitute for it. It costs about
  // 1.2 MB of polyfill, and that cost is only paid by a reader who opens a
  // PDF: this module is imported when one arrives and never before.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (worker === null && typeof window !== "undefined" && "Worker" in window) {
    worker = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url),
      { type: "module" },
    );
    pdfjs.GlobalWorkerOptions.workerPort = worker;
  }

  return pdfjs;
}

export interface PdfText {
  /** The document's text, page by page, joined. Empty if it carries none. */
  text: string;
  pages: number;
}

/**
 * Read a PDF's text layer. Throws if the file cannot be opened at all — a
 * damaged file and a scanned one are different things to tell the reader, so
 * they are different outcomes here.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  const pdfjs = await loadPdfjs();

  const task = pdfjs.getDocument({
    data: bytes,
    // Fonts are never drawn here: this reads text and renders nothing.
    disableFontFace: true,
    // No `cMapUrl`, `standardFontDataUrl`, `iccUrl` or `wasmUrl` is set, and
    // that is deliberate. Each of them is a URL the parser would fetch from,
    // and nothing about reading a document the reader is holding should touch
    // the network.
    //
    // Errors only. What the parser warns about is drawing pages, which this
    // never does, and the reader's console is not the place for it.
    verbosity: 0,
  });

  try {
    const pdf = await task.promise;
    const pages: string[] = [];

    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent({
        disableNormalization: true,
      });

      let text = "";
      for (const item of content.items) {
        // Marked-content boundaries carry no characters. Skip them.
        if (!("str" in item)) continue;
        text += item.str;
        if (item.hasEOL) text += "\n";
      }

      pages.push(text);
      page.cleanup();
    }

    return { text: pages.join("\n\n"), pages: pdf.numPages };
  } finally {
    await task.destroy();
  }
}
