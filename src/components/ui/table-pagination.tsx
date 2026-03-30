"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type TablePaginationProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
}: TablePaginationProps) {
  const pages = Math.ceil(total / pageSize);

  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Pagina anterior"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span className="px-2">
          {page} / {pages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Pagina siguiente"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[], pageSize = 50) {
  const [page, setPage] = React.useState(1);

  const pages = Math.ceil(items.length / pageSize);
  const safePage = Math.min(page, Math.max(1, pages));

  React.useEffect(() => {
    setPage(1);
  }, [items.length]);

  const paged = React.useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return {
    paged,
    page: safePage,
    pages,
    total: items.length,
    setPage,
    pageSize,
  };
}
