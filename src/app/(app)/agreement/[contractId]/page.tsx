"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import AgreementDocument, {
  AgreementContract,
  TENANT_SIGN_SPOTS,
  TenantSignSpot,
} from "@/components/AgreementDocument";
import SignatureModal from "../../contracts/SignatureModal";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";

type LoadedContract = AgreementContract & { _showAppendix?: boolean; renewedFromContractId?: string | null };

export default function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ sign?: string }>;
}) {
  const { contractId } = use(params);
  const { sign } = use(searchParams);
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const [contract, setContract] = useState<LoadedContract | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Click-to-sign state (tenant only, opened from 我的租约 → 签名 with ?sign=1).
  const [signature, setSignature] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Partial<Record<TenantSignSpot, string>>>({});
  const [pendingSpot, setPendingSpot] = useState<TenantSignSpot | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreedAt, setAgreedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/contracts/${contractId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setContract(data.contract);
      })
      .catch(() => setError(t("出错，请稍后再试", "Something went wrong — please try again later")));
  }, [contractId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const signingMode =
    sign === "1" &&
    !!contract &&
    !contract.tenantSignature &&
    !!contract.agentSignature &&
    // A renewal reuses the IC from the contract it replaces — no re-upload needed.
    (!!contract.renewedFromContractId || (!!contract.icFront && !!contract.icBack));
  const placedCount = TENANT_SIGN_SPOTS.filter((s) => placed[s.id]).length;
  const allPlaced = placedCount === TENANT_SIGN_SPOTS.length;
  const nextSpot = TENANT_SIGN_SPOTS.find((s) => !placed[s.id]);

  function placeSpot(spot: TenantSignSpot) {
    setPlaced((p) => ({ ...p, [spot]: new Date().toISOString() }));
  }

  function onSpot(spot: TenantSignSpot) {
    if (!signature) {
      // First tap: draw the signature once, then it lands on this spot.
      setPendingSpot(spot);
      setPadOpen(true);
      return;
    }
    placeSpot(spot);
  }

  function goToNextSpot() {
    if (!nextSpot) return;
    document.getElementById(`sign-${nextSpot.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submit() {
    if (!signature || !allPlaced) {
      toast.warning(t("还有签名位没签，请每个都点一下", "Some signature spots are still empty — tap each one"));
      goToNextSpot();
      return;
    }
    if (!agreed) {
      toast.warning(t("请先勾选「本人已阅读并同意以上所有条款」", "Please tick the declaration first"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ who: "tenant", dataUrl: signature, placed, declaration: true, declarationAt: agreedAt }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTimeout(() => router.push("/my-tenancy"), 1200);
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  function printContract() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning("浏览器拦截了弹出式窗口，请允许弹窗后再试一次");
      return;
    }
    w.document.write(
      `<html><head><title>Tenancy Agreement - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className={`rounded-xl bg-white p-3 shadow-sm sm:p-5 ${signingMode ? "mb-20" : ""}`}>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!contract && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
      {contract && sign === "1" && !signingMode && (
        <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 no-print">
          {contract.tenantSignature
            ? t("✅ 这张合同你已经签好了。", "✅ You've already signed this agreement.")
            : contract.renewedFromContractId
              ? t("现在还不能签：要等 Agent 先签。", "Not ready to sign yet — the Agent must sign first.")
              : t("现在还不能签：要等 Agent 先签，并且 IC 正反面都上传了。", "Not ready to sign yet — the Agent must sign first and both sides of your IC must be uploaded.")}
        </div>
      )}
      {contract && (
        <>
          {signingMode ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-violet-200 bg-violet-50/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur no-print md:left-[190px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <b className="text-brand">✍️ {t("请阅读并签名", "Read & sign")}</b>
                  <span className="ml-2 text-gray-600">
                    {t("已签", "Signed")} {placedCount}/{TENANT_SIGN_SPOTS.length}
                  </span>
                </div>
                {nextSpot ? (
                  <button onClick={goToNextSpot} className="btn-primary shrink-0 px-3 py-2 text-xs">
                    {t("去下一个签名位 ↓", "Next spot ↓")}
                  </button>
                ) : (
                  <button
                    onClick={() => document.getElementById("sign-declaration")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="btn-primary shrink-0 px-3 py-2 text-xs"
                  >
                    {t("去提交 ↓", "Go to submit ↓")}
                  </button>
                )}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${(placedCount / TENANT_SIGN_SPOTS.length) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mb-3 text-right no-print">
              <button onClick={printContract} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
                🖨️ {t("打印 / 存 PDF", "Print / Save PDF")}
              </button>
            </div>
          )}

          {signingMode && (
            <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 no-print">
              {t(
                "请从头到尾阅读合同。每个「✍️ 点击签名」都要你自己点一下：第一次点会让你画签名，之后的签名位点一下就会签上同一个签名。全部签完后，在最下面勾选同意再提交。",
                "Please read the whole agreement. Tap every \"✍️ Tap to sign\" yourself: the first tap asks you to draw your signature, later taps place the same signature. When all are signed, tick the declaration at the bottom and submit."
              )}
            </div>
          )}

          <div ref={printAreaRef} className="overflow-x-auto">
            <AgreementDocument
              c={contract}
              showAppendix={!!contract._showAppendix}
              signing={signingMode ? { signature, placed, onSpot } : undefined}
            />
          </div>

          {signingMode && (
            <div id="sign-declaration" className="mt-6 rounded-xl border-2 border-brand/30 bg-brand-light/40 p-4 no-print">
              <ul className="mb-3 space-y-1 text-sm">
                {TENANT_SIGN_SPOTS.map((s) => (
                  <li key={s.id} className={placed[s.id] ? "text-green-700" : "text-gray-500"}>
                    {placed[s.id] ? "✅" : "⬜"} {s.label}
                  </li>
                ))}
              </ul>
              <label className={`flex items-start gap-3 rounded-lg bg-white p-3 ${allPlaced ? "" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                  disabled={!allPlaced}
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    setAgreedAt(e.target.checked ? new Date().toISOString() : null);
                  }}
                />
                <span className="text-sm text-gray-800">
                  <b>本人已阅读并同意以上所有条款及内容。</b>
                  <br />
                  <span className="text-gray-600">I have read and agree to all the above terms and contents.</span>
                </span>
              </label>
              {!allPlaced && (
                <p className="mt-2 text-xs text-gray-500">
                  {t(
                    `还有 ${TENANT_SIGN_SPOTS.length - placedCount} 个签名位没签，签完才可以勾选。`,
                    `${TENANT_SIGN_SPOTS.length - placedCount} signature spot(s) left — sign them all to tick this.`
                  )}
                </p>
              )}
              <button
                onClick={submit}
                disabled={submitting || !allPlaced || !agreed}
                className="btn-primary mt-3 w-full py-3 text-base"
              >
                {submitting ? t("提交中...", "Submitting...") : t("确认并提交签名", "Confirm & Submit")}
              </button>
              {signature && (
                <button
                  type="button"
                  onClick={() => {
                    setSignature(null);
                    setPlaced({});
                    setAgreed(false);
                    setAgreedAt(null);
                  }}
                  className="mt-2 w-full py-2 text-xs text-gray-500 underline"
                >
                  {t("签名画得不好？清除全部重签", "Not happy with the signature? Clear all and redo")}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {padOpen && contract && (
        <SignatureModal
          contractCode={contract.contractCode}
          who="tenant"
          onClose={() => {
            setPadOpen(false);
            setPendingSpot(null);
          }}
          onSigned={() => {}}
          onCapture={(dataUrl) => {
            setSignature(dataUrl);
            if (pendingSpot) placeSpot(pendingSpot);
          }}
        />
      )}
    </div>
  );
}
