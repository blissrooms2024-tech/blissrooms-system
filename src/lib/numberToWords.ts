const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigits(n: number): string {
  let s = "";
  if (n >= 100) {
    s += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n > 0) s += " And ";
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)];
    if (n % 10 > 0) s += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    s += ONES[n];
  }
  return s;
}

/** "Ringgit Malaysia: One Thousand Two Hundred And Fifty And Fifty Sen Only" — for the
 * amount-in-words line on formal payslips/receipts. */
export function amountInWordsRM(amount: number): string {
  const ringgit = Math.floor(Math.abs(amount));
  const sen = Math.round((Math.abs(amount) - ringgit) * 100);

  const groups = ["", " Thousand", " Million"];
  let n = ringgit;
  let idx = 0;
  const parts: string[] = [];
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) parts.unshift(threeDigits(chunk) + groups[idx]);
    n = Math.floor(n / 1000);
    idx++;
  }
  const ringgitWords = parts.length ? parts.join(" ") : "Zero";

  let words = `Ringgit Malaysia: ${ringgitWords}`;
  if (sen > 0) words += ` And ${threeDigits(sen)} Sen`;
  words += " Only";
  return words;
}
