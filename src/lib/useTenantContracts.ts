"use client";

import { useEffect, useState, useCallback } from "react";

export interface TenantContractCard {
  contractCode: string;
  roomCode: string;
  status: string;
  depositOutstanding: number;
}

/** Shared by the tenant's dedicated Bills/Maintenance/Move-in/Move-out pages: fetches the
 * tenant's contracts and tracks which one is currently selected (defaults to the active one,
 * or the first if none is active — most tenants only ever have the one). */
export function useTenantContracts() {
  const [cards, setCards] = useState<TenantContractCard[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts/my-cards");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      const list: TenantContractCard[] = data.cards;
      setCards(list);
      setSelected((prev) =>
        prev && list.some((c) => c.contractCode === prev)
          ? prev
          : (list.find((c) => c.status === "ACTIVE") ?? list[0])?.contractCode ?? null
      );
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { cards, error, selected, setSelected };
}
