"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ContractForm from "../ContractForm";

export default function NewContractClient({ role }: { role: string }) {
  const router = useRouter();
  const [vacant, setVacant] = useState<{ roomCode: string; propertyName: string }[]>([]);
  const [agents, setAgents] = useState<{ userCode: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/contracts/page-data")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return;
        setVacant(data.vacant);
        setAgents(data.agents);
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Link href="/contracts" className="text-sm text-brand hover:underline">
          ← 返回合同清单
        </Link>
      </div>
      {loaded && (
        <ContractForm
          role={role}
          vacantRooms={vacant}
          agents={agents}
          onCreated={() => router.push("/contracts")}
        />
      )}
    </div>
  );
}
