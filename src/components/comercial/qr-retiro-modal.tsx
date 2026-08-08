"use client";

/**
 * QR de retiro de una orden: lo que el cliente presenta en el mostrador y el
 * operador escanea para abrir la entrega.
 *
 * El QR codifica el NÚMERO de la orden (OT-2026-0184), no un token opaco:
 *  - se puede tipear a mano si el QR se arruina o el lector no lee;
 *  - su formato lo distingue de un código de cupón, que va al mismo lector;
 *  - no expone nada: resolverlo exige sesión de staff y filtra por tenant.
 */

import * as React from "react";
import { DownloadIcon, PrinterIcon, XIcon } from "lucide-react";

import s from "./qr-retiro-modal.module.css";

export function QrRetiroModal({
  numero,
  cliente,
  onClose,
}: {
  numero: string;
  cliente?: string | null;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    void (async () => {
      const { toDataURL } = await import("qrcode");
      try {
        // Corrección de errores alta: el papel se dobla y se mancha en el
        // mostrador, y un QR con margen lee mejor de lejos.
        const url = await toDataURL(numero, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 640,
        });
        if (vivo) setDataUrl(url);
      } catch {
        if (vivo) setDataUrl(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [numero]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`QR de retiro de ${numero}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          <XIcon />
        </button>

        <div className={s.titulo}>Retirá tu pedido con este QR</div>
        <div className={s.bajada}>
          Mostralo en el mostrador: lo escaneamos y te entregamos el trabajo.
        </div>

        {dataUrl ? (
          <div className={s.qr}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={`QR de la orden ${numero}`} />
          </div>
        ) : (
          <div className={s.qrVacio} />
        )}

        <div className={s.numero}>{numero}</div>
        {cliente ? <div className={s.cliente}>{cliente}</div> : null}

        <div className={s.foot}>
          <button
            type="button"
            className="btn"
            onClick={() => window.print()}
          >
            <PrinterIcon />
            Imprimir
          </button>
          {dataUrl ? (
            <a className="btn" href={dataUrl} download={`${numero}-retiro.png`}>
              <DownloadIcon />
              Descargar
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
