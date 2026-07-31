import { ChevronLeft, ChevronRight } from "lucide-react";

export type PageMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export default function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.total_pages <= 1) return null;

  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      <button
        onClick={() => onPageChange(meta.page - 1)}
        disabled={meta.page <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 disabled:opacity-40"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs text-ink-500">
        Page {meta.page} of {meta.total_pages} · {meta.total} total
      </span>
      <button
        onClick={() => onPageChange(meta.page + 1)}
        disabled={meta.page >= meta.total_pages}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 disabled:opacity-40"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
