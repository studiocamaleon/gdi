"use client";

import {
  Check,
  ChevronDown,
  Copy,
  History,
  Printer,
  QrCode,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLegacyDesignScope } from "@/components/design-system/appearance";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function OrdenAccionesMenus({
  documentos,
  etiqueta,
  historial,
  seguimiento,
  qr,
  copiado = false,
  impresionDirecta = false,
}: {
  documentos?: () => void;
  etiqueta?: () => void;
  historial?: () => void;
  seguimiento?: () => void;
  qr: () => void;
  copiado?: boolean;
  impresionDirecta?: boolean;
}) {
  const tema = useLegacyDesignScope();
  return (
    <>
      {(documentos || etiqueta || historial) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" />}
            aria-label="Imprimir"
          >
            <Printer data-icon="inline-start" /> Imprimir{" "}
            <ChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            {...tema}
            className={`${tema.className ?? ""} min-w-56`}
            align="end"
          >
            <DropdownMenuGroup>
              {documentos && (
                <DropdownMenuItem onClick={documentos}>
                  <Printer /> Imprimir documentos
                </DropdownMenuItem>
              )}
              {etiqueta && (
                <DropdownMenuItem onClick={etiqueta}>
                  <Tag />{" "}
                  {impresionDirecta
                    ? "Imprimir etiqueta"
                    : "Descargar etiqueta"}
                </DropdownMenuItem>
              )}
              {historial && (
                <DropdownMenuItem onClick={historial}>
                  <History /> Historial de impresión
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" />}
          aria-label="Seguimiento"
        >
          {copiado ? (
            <Check data-icon="inline-start" />
          ) : (
            <ExternalLink data-icon="inline-start" />
          )}
          {copiado ? "Enlace copiado" : "Seguimiento"}{" "}
          <ChevronDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          {...tema}
          className={`${tema.className ?? ""} min-w-56`}
          align="end"
        >
          <DropdownMenuGroup>
            {seguimiento && (
              <DropdownMenuItem onClick={seguimiento}>
                <Copy /> Copiar enlace de seguimiento
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={qr}>
              <QrCode /> Ver QR de retiro
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
