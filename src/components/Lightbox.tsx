"use client";

export default function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex cursor-zoom-out items-center justify-center bg-black/80 p-5"
    >
      <img src={src} alt={alt || ""} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
    </div>
  );
}
