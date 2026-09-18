"use client";
import { useEffect, useState } from "react";
import {
  ConfiguracionHeader,
  ConfiguracionPage,
} from "@/components/configuracion/configuracion-workspace";
import { ActionButton } from "@/components/design-system/action-button";
import {
  getConfiguracionImpresion,
  type ConfiguracionImpresion,
} from "@/lib/impresion-api";
import { leerImpresora, type ImpresoraPuesto } from "@/lib/impresora-puesto";
import { ImpresoraPuestoForm } from "./impresora-puesto-form";
import s from "./impresion.module.css";

export function ImpresorasView() {
  const [identidad, setIdentidad] = useState<ConfiguracionImpresion | null>(
    null,
  );
  const [config, setConfig] = useState<ImpresoraPuesto | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let activo = true;
    getConfiguracionImpresion()
      .then((dato) => {
        if (activo) {
          setIdentidad(dato);
          setConfig(leerImpresora(dato.tenantId));
        }
      })
      .catch((e) => {
        if (activo)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo cargar la configuración.",
          );
      });
    return () => {
      activo = false;
    };
  }, [revision]);
  function descargarCertificado() {
    if (!identidad?.certificado) return;
    const url = URL.createObjectURL(
      new Blob([identidad.certificado], { type: "application/x-x509-ca-cert" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "override.crt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <ConfiguracionPage>
      <ConfiguracionHeader
        titulo="Impresoras"
        descripcion="Prepará este puesto para imprimir las etiquetas de tus órdenes."
      />
      <div className={s.settings}>
        {error && (
          <>
            <p role="alert" className={s.error}>
              {error}
            </p>
            <ActionButton
              onPress={() => {
                setError("");
                setRevision(revision + 1);
              }}
            >
              Reintentar
            </ActionButton>
          </>
        )}
        {!identidad && !error && <p role="status">Cargando configuración…</p>}
        {identidad && config && (
          <ImpresoraPuestoForm
            tenantId={identidad.tenantId}
            inicial={config}
            disabled={!identidad.firmaDisponible}
            onGuardar={setConfig}
          />
        )}
        {identidad?.firmaDisponible ? (
          <section className={s.setup}>
            <strong>Autorización de Grafo</strong>
            <p className={s.help}>
              Para recordar la autorización, instalá este certificado público en
              el equipo donde corre QZ Tray. En Windows, guardalo como
              override.crt dentro de C:\Program Files\QZ Tray, reiniciá QZ y
              autorizá Grafo con «Recordar esta decisión» en la primera
              conexión.
            </p>
            <ActionButton variant="outline" onPress={descargarCertificado}>
              Descargar certificado público
            </ActionButton>
            <p className={s.help}>
              Si ese equipo ya tiene un override.crt para otra aplicación,
              consultá al administrador antes de reemplazarlo. Este certificado
              es distinto del que permite la conexión segura entre equipos.
            </p>
          </section>
        ) : (
          identidad && (
            <p role="alert" className={s.error}>
              {identidad.mensaje}
            </p>
          )
        )}
      </div>
    </ConfiguracionPage>
  );
}
