import { useEffect, useRef } from "react";
import { Palette, X } from "lucide-react";
import type { SavedDesign } from "../lib/designStore";

interface Props {
  designs: SavedDesign[];
  onPick: (design: SavedDesign) => void;
  onClose: () => void;
}

/** A small window that lists the designs saved in the Design Studio so one can be used as a post picture. */
export default function DesignPicker({ designs, onPick, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Choose a design" className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" aria-hidden="true" /> Choose a design
          </h3>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100/60">
            <X className="w-4 h-4" />
          </button>
        </div>
        {designs.length === 0 ? (
          <p className="text-sm text-slate-600">
            No saved designs yet. Make one in the Design Studio and press <strong>Save</strong>. It will show up here.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {designs.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onPick(d)} className="w-full text-left rounded-xl border border-slate-200 p-2 hover:border-blue-500/60 hover:bg-blue-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                  {d.thumb ? (
                    <img src={d.thumb} alt="" className="w-full aspect-square object-cover rounded-lg bg-slate-100/50" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-slate-100/50" />
                  )}
                  <p className="mt-1.5 text-xs font-medium text-slate-800 truncate">{d.name}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
