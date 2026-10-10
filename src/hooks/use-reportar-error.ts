"use client";
import { useEffect } from "react";
import { reportarErrorVista } from "@/lib/observabilidad-cliente";
export function useReportarError(error: Error) {
  useEffect(() => {
    void reportarErrorVista(error);
  }, [error]);
}
