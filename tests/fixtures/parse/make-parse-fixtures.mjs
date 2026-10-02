/**
 * Writes the parsing fixtures used by `src/lib/parse/*.test.ts`.
 *
 *   node tests/fixtures/parse/make-parse-fixtures.mjs
 *
 * Three files come out, and all three are committed so the suite never depends
 * on this script having been run:
 *
 *   short-agreement.pdf   a two-page PDF with a real text layer
 *   short-agreement.docx  the same words as a Word document
 *   scanned-page.pdf      a PDF with a page and an image on it and no text
 *
 * The words come from one place, `SENTENCES` below, and are written out to
 * `parse-fixtures.json` beside the files. The tests read that sidecar rather
 * than carrying their own copy of any sentence, so a change here cannot leave
 * a test asserting on wording that is no longer in the fixture.
 *
 * Nothing here parses anything. The parsers are what the tests exercise, and
 * they are the real ones.
 */

import { Buffer } from "node:buffer";
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const TEXT_PDF = "short-agreement.pdf";
const DOCX = "short-agreement.docx";
const SCANNED_PDF = "scanned-page.pdf";
const SIDECAR = "parse-fixtures.json";

/**
 * The document, paragraph by paragraph. Headings are marked so the sidecar can
 * record which paragraphs are sentences a flag could cite.
 *
 * ASCII only, deliberately: a base-14 Helvetica PDF and a Word document agree
 * on ASCII and nothing else, and the point of these fixtures is that the two
 * routes produce the same words.
 */
const BODY = [
  { heading: true, text: "SERVICES AGREEMENT" },
  { heading: true, text: "1. Term and renewal" },
  {
    text: "This Agreement begins on the date of signature and runs for twelve months.",
  },
  {
    text: "It renews automatically for a further twelve months unless the Contractor gives notice at least ninety days before the end of the term.",
  },
  { heading: true, text: "2. Payment" },
  {
    text: "The Client shall pay each invoice within sixty days of receipt, and no interest or late fee shall accrue on any unpaid amount.",
  },
  { heading: true, text: "3. Ownership of the work" },
  {
    text: "All work product created under this Agreement vests in the Client on creation, whether or not the Contractor has been paid for it.",
  },
  { heading: true, text: "4. Termination" },
  {
    text: "The Client may terminate this Agreement at any time on two days notice and shall owe nothing for work that was scheduled but not yet delivered.",
  },
  { heading: true, text: "5. Indemnity" },
  {
    text: "The Contractor shall indemnify and hold the Client harmless against all claims, losses and costs of any kind arising from the services, without limit.",
  },
  { heading: true, text: "6. Disputes" },
  {
    text: "Any dispute arising under this Agreement shall be settled by binding arbitration in the county of the Client, and the Contractor waives any right to join a class action.",
  },
  { heading: true, text: "7. Signature" },
  {
    text: "The Contractor confirms that they have read this Agreement in full and accept every clause in it as written.",
  },
];

const SENTENCES = BODY.filter((p) => !p.heading).map((p) => p.text);

/**
 * What a perfect model would find in this document, and the tier each clause
 * type earns under the seeded red lines. The source sentences are taken from
 * BODY by index, so they cannot drift from the words in the fixture.
 */
const PLANTED = [
  {
    clauseType: "ip-before-payment",
    expectedSeverity: "Critical",
    sourceSentence: SENTENCES[3],
    consequence:
      "The Client owns the work the moment you make it, so withholding delivery over an unpaid invoice gains you nothing.",
    counterOffer:
      "Ownership of the work product passes to the Client on receipt of payment in full, and until then remains with the Contractor.",
  },
  {
    clauseType: "uncapped-indemnity",
    expectedSeverity: "Critical",
    sourceSentence: SENTENCES[5],
    consequence:
      "A claim against the Client becomes your bill, with no ceiling on what you could owe.",
    counterOffer:
      "The Contractor's total liability under this Agreement is limited to the fees paid in the twelve months before the claim.",
  },
  {
    clauseType: "slow-payment-no-late-fee",
    expectedSeverity: "Serious",
    sourceSentence: SENTENCES[2],
    consequence:
      "You could wait two months to be paid, and late payment costs the Client nothing.",
    counterOffer:
      "Each invoice is payable within thirty days of receipt. Interest accrues on any overdue amount at 4% above base rate.",
  },
  {
    clauseType: "unilateral-termination",
    expectedSeverity: "Serious",
    sourceSentence: SENTENCES[4],
    consequence:
      "Work you have booked out and turned other jobs down for can be cancelled in two days, unpaid.",
    counterOffer:
      "Either party may terminate on thirty days written notice. The Client pays for work completed and for work scheduled within the notice period.",
  },
  {
    clauseType: "auto-renewal",
    expectedSeverity: "Worth knowing",
    sourceSentence: SENTENCES[1],
    consequence:
      "Miss the ninety-day window and you are committed for another year.",
    counterOffer: null,
  },
  {
    clauseType: "arbitration",
    expectedSeverity: "Worth knowing",
    sourceSentence: SENTENCES[6],
    consequence:
      "A dispute goes to arbitration where the Client is based, and you cannot join other people with the same complaint.",
    counterOffer: null,
  },
];

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const LEADING = 16;
const FONT_SIZE = 11;
const CHARS_PER_LINE = 84;
const LINES_PER_PAGE = 24;

/** Break a paragraph at spaces only. Words are never altered or dropped. */
function wrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function escapePdfString(s) {
  return s.replace(/[\\()]/g, (c) => `\\${c}`);
}

/** One PDF object, dictionary and optional stream, as bytes. */
function pdfObject(id, dict, stream) {
  const head = stream
    ? `${id} 0 obj\n${dict}\nstream\n`
    : `${id} 0 obj\n${dict}\nendobj\n`;
  if (!stream) return Buffer.from(head, "latin1");
  return Buffer.concat([
    Buffer.from(head, "latin1"),
    stream,
    Buffer.from("\nendstream\nendobj\n", "latin1"),
  ]);
}

/** Assemble numbered objects into a PDF with a correct xref table. */
function assemblePdf(bodies) {
  const chunks = [];
  let at = 0;
  const push = (buffer) => {
    chunks.push(buffer);
    at += buffer.length;
  };

  push(Buffer.from("%PDF-1.7\n", "latin1"));
  push(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets = [];
  for (let id = 1; id < bodies.length; id++) {
    offsets[id] = at;
    push(bodies[id]);
  }

  const xrefAt = at;
  let xref = `xref\n0 ${bodies.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < bodies.length; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  push(Buffer.from(xref, "latin1"));
  push(
    Buffer.from(
      `trailer\n<< /Size ${bodies.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
      "latin1",
    ),
  );

  return Buffer.concat(chunks);
}

/**
 * A PDF with a real text layer: Helvetica, one `Tj` per line, `T*` between
 * lines. The text is placed line by line the way a typesetter would place it,
 * which is what gives the parser something faithful to read back.
 */
function buildTextPdf(paragraphs) {
  const pages = [[]];
  for (const paragraph of paragraphs) {
    const lines = [...wrap(paragraph.text, CHARS_PER_LINE), ""];
    let page = pages[pages.length - 1];
    if (page.length > 0 && page.length + lines.length > LINES_PER_PAGE) {
      page = [];
      pages.push(page);
    }
    page.push(...lines);
  }

  const bodies = [];
  const kids = [];
  let nextId = 4;

  for (const lines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    kids.push(`${pageId} 0 R`);

    const stream = Buffer.from(
      [
        "BT",
        `/F1 ${FONT_SIZE} Tf`,
        `${LEADING} TL`,
        `1 0 0 1 ${MARGIN} ${PAGE_HEIGHT - MARGIN} Tm`,
        ...lines.map((line) => `(${escapePdfString(line)}) Tj T*`),
        "ET",
        "",
      ].join("\n"),
      "latin1",
    );

    bodies[pageId] = pdfObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    bodies[contentId] = pdfObject(
      contentId,
      `<< /Length ${stream.length} >>`,
      stream,
    );
  }

  bodies[1] = pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  bodies[2] = pdfObject(
    2,
    `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`,
  );
  bodies[3] = pdfObject(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  return assemblePdf(bodies);
}

/**
 * A PDF with a page, an image on that page, and no text layer at all: what a
 * document put through a scanner looks like to a parser. There is no font and
 * no text-showing operator anywhere in it, so a faithful parser reads nothing
 * out of it — which is the whole point of the fixture.
 */
function buildScannedPdf() {
  const width = 64;
  const height = 88;
  const pixels = Buffer.alloc(width * height, 0xef);
  // Darker bands where the lines of print would be. Ink, not letters: there is
  // nothing here for anything short of character recognition to read, and
  // character recognition is what Redline refuses to do.
  for (let row = 8; row < height - 8; row += 6) {
    pixels.fill(0x44, row * width + 6, row * width + width - 10);
  }
  const compressed = deflateSync(pixels);

  const content = Buffer.from(
    `q ${PAGE_WIDTH - MARGIN * 2} 0 0 ${PAGE_HEIGHT - MARGIN * 2} ${MARGIN} ${MARGIN} cm /Im0 Do Q\n`,
    "latin1",
  );

  const bodies = [];
  bodies[1] = pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  bodies[2] = pdfObject(
    2,
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
  );
  bodies[3] = pdfObject(
    3,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode ` +
      `/Length ${compressed.length} >>`,
    compressed,
  );
  bodies[4] = pdfObject(
    4,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      "/Resources << /XObject << /Im0 3 0 R >> >> /Contents 5 0 R >>",
  );
  bodies[5] = pdfObject(
    5,
    `<< /Length ${content.length} >>`,
    content,
  );

  return assemblePdf(bodies);
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

/**
 * A .docx is a zip of XML parts. Written here with stored (uncompressed)
 * entries, which is a valid zip and keeps this script free of a zip library.
 */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const sum = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date: 1980-01-01
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, content);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(sum, 16);
    entry.writeUInt32LE(content.length, 20);
    entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += 30 + nameBytes.length + content.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, directory, end]);
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDocx(paragraphs) {
  const body = paragraphs
    .map(
      (p) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r></w:p>`,
    )
    .join("");

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}<w:sectPr/></w:body></w:document>`;

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  return zip([
    ["[Content_Types].xml", Buffer.from(contentTypes, "utf8")],
    ["_rels/.rels", Buffer.from(rels, "utf8")],
    ["word/document.xml", Buffer.from(document, "utf8")],
  ]);
}

// ---------------------------------------------------------------------------

const written = [
  [TEXT_PDF, buildTextPdf(BODY)],
  [SCANNED_PDF, buildScannedPdf()],
  [DOCX, buildDocx(BODY)],
];

for (const [name, bytes] of written) {
  writeFileSync(join(HERE, name), bytes);
}

writeFileSync(
  join(HERE, SIDECAR),
  `${JSON.stringify(
    {
      textPdf: TEXT_PDF,
      scannedPdf: SCANNED_PDF,
      docx: DOCX,
      sentences: SENTENCES,
      plantedClauses: PLANTED,
    },
    null,
    2,
  )}\n`,
);

for (const [name, bytes] of written) {
  console.log(`${name}  ${bytes.length} bytes`);
}
console.log(`${SIDECAR}  ${SENTENCES.length} sentences, ${PLANTED.length} planted clauses`);
