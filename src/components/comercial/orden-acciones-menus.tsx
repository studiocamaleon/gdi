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
import { Dropdown } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";

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
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <>
      {(documentos || etiqueta || historial) && (
        <Dropdown>
          <ActionButton variant="outline" size="sm" aria-label="Imprimir">
            <Printer data-icon="inline-start" /> Imprimir{" "}
            <ChevronDown data-icon="inline-end" />
          </ActionButton>
          <Dropdown.Popover
            {...scope}
            className={`${theme} min-w-56`}
            placement="bottom end"
          >
            <Dropdown.Menu aria-label="Opciones de la orden">
              {documentos && (
                <Dropdown.Item
                  id="documentos"
                  textValue="Imprimir documentos"
                  onAction={documentos}
                >
                  <Printer /> Imprimir documentos
                </Dropdown.Item>
              )}
              {etiqueta && (
                <Dropdown.Item
                  id="etiqueta"
                  textValue="Etiqueta"
                  onAction={etiqueta}
                >
                  <Tag />{" "}
                  {impresionDirecta
                    ? "Imprimir etiqueta"
                    : "Descargar etiqueta"}
                </Dropdown.Item>
              )}
              {historial && (
                <Dropdown.Item
                  id="historial"
                  textValue="Historial de impresión"
                  onAction={historial}
                >
                  <History /> Historial de impresión
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}
      <Dropdown>
        <ActionButton variant="outline" size="sm" aria-label="Seguimiento">
          {copiado ? (
            <Check data-icon="inline-start" />
          ) : (
            <ExternalLink data-icon="inline-start" />
          )}
          {copiado ? "Enlace copiado" : "Seguimiento"}{" "}
          <ChevronDown data-icon="inline-end" />
        </ActionButton>
        <Dropdown.Popover
          {...scope}
          className={`${theme} min-w-56`}
          placement="bottom end"
        >
          <Dropdown.Menu aria-label="Opciones de la orden">
            {seguimiento && (
              <Dropdown.Item
                id="seguimiento"
                textValue="Copiar enlace de seguimiento"
                onAction={seguimiento}
              >
                <Copy /> Copiar enlace de seguimiento
              </Dropdown.Item>
            )}
            <Dropdown.Item id="qr" textValue="Ver QR de retiro" onAction={qr}>
              <QrCode /> Ver QR de retiro
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
}
