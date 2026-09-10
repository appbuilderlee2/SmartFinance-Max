import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} className="sf-sheet" onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="sf-sheet-body">
      <header className="flex items-center justify-between gap-3 mb-5"><h2 className="text-xl font-semibold">{title}</h2><button type="button" aria-label="關閉面板" className="p-3" onClick={onClose}><X size={20} /></button></header>
      {children}
    </div>
  </dialog>;
}
