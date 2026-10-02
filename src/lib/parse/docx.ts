/**
 * Word documents to text, in the browser, with Mammoth. Pure JavaScript, no
 * network and no server: the file never leaves the client and only the string
 * this returns does.
 *
 * `extractRawText` is the right call rather than the HTML conversion. A Word
 * document's own paragraph breaks come through as blank lines and every
 * character of every run comes through unchanged, which is what the citation
 * check needs: a sentence quoted out of this text has to be findable in it
 * under whitespace-and-quotes normalisation and nothing looser. Nothing here
 * reflows a paragraph or rewrites a word.
 */

/**
 * Read a .docx file's text. Throws if the file cannot be opened — a damaged or
 * password-protected document is a different thing to tell the reader than a
 * document with nothing in it.
 */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default;

  /**
   * Mammoth's two builds take the bytes under different keys: the browser
   * build's zip reader looks for `arrayBuffer`, and the Node build — which the
   * tests run under — looks for `buffer`. Both hand the same bytes to the same
   * zip reader, so this supplies both and whichever build is loaded takes the
   * key it knows. The published type is a union of one key per build, which is
   * why the shape is asserted rather than inferred.
   */
  const input = {
    arrayBuffer: bytes.slice().buffer as ArrayBuffer,
    buffer: bytes,
  } as { arrayBuffer: ArrayBuffer };

  const result = await mammoth.extractRawText(input);
  return result.value;
}
