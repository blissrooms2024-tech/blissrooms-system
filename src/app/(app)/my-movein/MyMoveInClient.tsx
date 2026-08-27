"use client";

import { useTenantContracts } from "@/lib/useTenantContracts";
import { MoveFormPanel } from "../contracts/MoveFormModal";

export default function MyMoveInClient() {
  const { cards, error, selected, setSelected } = useTenantContracts();

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!cards) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;
  if (cards.length === 0) {
    return <div className="rounded-xl bg-white p-5 text-center text-gray-400 shadow-sm">你还没有租约</div>;
  }

  const selectedCard = cards.find((c) => c.contractCode === selected);

  return (
    <div className="space-y-3">
      {selectedCard && selectedCard.status === "ACTIVE" && selectedCard.depositOutstanding > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          ⚠️ 请先缴清押金 (Deposit)，才能填写 Move-in 表单，请尽快联系 Admin 缴费。
        </div>
      )}
      {cards.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cards.map((c) => (
            <button
              key={c.contractCode}
              onClick={() => setSelected(c.contractCode)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selected === c.contractCode ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {c.contractCode} · {c.roomCode}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <MoveFormPanel contractCode={selected} type="MoveIn" />
        </div>
      )}
    </div>
  );
}
