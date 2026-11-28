import { fmtDate } from "@/lib/format";
import { KIND_LABELS, UTILITY_KINDS, round2, type Line, type UtilityKind } from "@/lib/utilitySplit";

/** Words for 抄表开单 bills — the note on each tenant's bill and the WhatsApp group message.
 * No database here, so the page can show exactly what will be sent before it's sent. */

const monthZh = (period: string) => `${Number(period.slice(5, 7))}月`;
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const rm = (n: number) => `RM${n.toFixed(2)}`;

/** The line a tenant sees on their bill, explaining the amount. */
export function billNote(
  kind: UtilityKind,
  period: string,
  meters: { usage: number; rate: number; amount: number; previous: number | null; reading: number | null }[],
  share: Line["share"],
  /** What this kind came to after any manual change, before the prepaid balance. */
  amount: number,
  computed: number,
  /** Taken from the tenant's prepaid balance. */
  credit = 0
) {
  const parts = meters.map((m) => {
    const read = m.previous !== null && m.reading !== null ? `${num(m.previous)} → ${num(m.reading)} = ` : "";
    return `${read}${num(m.usage)} 度 × RM${m.rate.toFixed(2)} = ${rm(m.amount)}`;
  });
  let text = `${monthZh(period)}${KIND_LABELS[kind].zh}：${parts.join("；")}`;
  if (share?.by === "PEOPLE") text += `，共 ${share.total} 人分，你这间 ${share.weight} 人`;
  else if (share?.by === "SAME_ROOM") text += `，这间房这个月有 ${share.total} 位租客，平分`;
  else if (share) text += `，${share.total} 间房平分`;
  if (Math.abs(amount - computed) > 0.004) text += `（已调整为 ${rm(amount)}）`;
  if (credit > 0) text += `，已扣预付余额 ${rm(credit)}`;
  return text;
}

/** Message for the unit's WhatsApp group: shared usage, then each room's total. */
export function whatsappText(
  unitCode: string,
  period: string,
  meters: { kind: UtilityKind; roomId: string | null; usage: number }[],
  bills: { roomCode: string; amount: number }[],
  dueDate: string
) {
  const usage = UTILITY_KINDS.map((k) => {
    const ms = meters.filter((m) => m.kind === k && !m.roomId);
    return ms.length ? `${KIND_LABELS[k].zh} ${num(ms.reduce((s, m) => s + m.usage, 0))} 度` : null;
  }).filter(Boolean);
  const byRoom = new Map<string, number>();
  for (const b of bills) byRoom.set(b.roomCode, round2((byRoom.get(b.roomCode) ?? 0) + b.amount));
  const lines = [...byRoom.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([r, a]) => `${r}  ${rm(a)}`);
  return [
    `*${unitCode} ${monthZh(period)}水电账单*`,
    ...(usage.length ? [usage.join(" · ")] : []),
    ...lines,
    `请在 ${fmtDate(dueDate)} 前付款，转账备注写房号，付款后在系统上传交易单。逾期未付，公司有权按合约收取迟交罚款。`,
  ].join("\n");
}
