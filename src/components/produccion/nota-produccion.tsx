import { StickyNoteIcon } from "lucide-react";

export function NotaProduccion({ texto }: { texto?: string | null }) {
  if (!texto?.trim()) return null;

  return (
    <aside
      role="note"
      aria-label="Nota de producción"
      className="rounded-lg border border-yellow-400 border-l-4 bg-yellow-100 px-3 py-2 text-yellow-950"
    >
      <strong className="flex items-center gap-2 text-sm">
        <StickyNoteIcon aria-hidden="true" size={16} />
        Nota de producción
      </strong>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
        {texto}
      </p>
    </aside>
  );
}
