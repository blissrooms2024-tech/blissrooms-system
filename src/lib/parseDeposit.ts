/** Pulls a deposit total out of a free-text notes field, e.g.
 *  "2 months security deposit RM4900\n0.5 month utilities deposit RM1225" → 6125.
 *  Only sums RM amounts on a line that actually mentions "deposit"/"押金", so an unrelated RM
 *  figure elsewhere in the notes (e.g. a rental amount) doesn't get swept in. Returns null when
 *  no such line is found, so the caller can tell "nothing to parse" apart from a genuine RM0. */
export function extractDepositFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const amountRe = /RM\s*([\d,]+(?:\.\d+)?)/i;
  let total = 0;
  let found = false;
  for (const line of notes.split("\n")) {
    if (!/deposit|押金/i.test(line)) continue;
    const m = line.match(amountRe);
    if (m) {
      total += Number(m[1].replace(/,/g, ""));
      found = true;
    }
  }
  return found ? total : null;
}
