"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

export default function SignatureModal({
  contractCode,
  who,
  onClose,
  onSigned,
}: {
  contractCode: string;
  who: "agent" | "tenant";
  onClose: () => void;
  onSigned: () => void;
}) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";

    let drawing = false;
    function pos(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const t = "touches" in e ? e.touches[0] : e;
      return {
        x: (t.clientX - rect.left) * (canvas!.width / rect.width),
        y: (t.clientY - rect.top) * (canvas!.height / rect.height),
      };
    }
    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing = true;
      dirtyRef.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    function end() {
      drawing = false;
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
  }

  async function submit() {
    if (!dirtyRef.current) {
      toast.warning("请先签名");
      return;
    }
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ who, dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTimeout(() => {
          onSigned();
          onClose();
        }, 1200);
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">
        ✍️ {who === "agent" ? "Agent 签名" : "租客签名"} — {contractCode}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        在下面框里签名（手机用手指，电脑按住鼠标画）。签一次会自动套用到合同全部签名位。
      </p>
      <canvas
        ref={canvasRef}
        width={560}
        height={200}
        className="mt-2 w-full touch-none rounded-lg border-2 border-dashed border-gray-300 bg-white"
      />
      <div className="mt-2.5 flex gap-2">
        <button onClick={clearSig} className="btn-soft">
          清除重签
        </button>
        <button onClick={submit} disabled={loading} className="btn-primary">
          确定签名
        </button>
      </div>
    </Modal>
  );
}
