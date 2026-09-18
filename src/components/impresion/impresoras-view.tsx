"use client";
import { useEffect, useState } from "react";
import { Cable, Download, ScanLine, ShieldCheck } from "lucide-react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import p from "./perfiles-impresion.module.css";
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
import { PerfilesImpresionPanel } from "./perfiles-impresion-panel";
import s from "./impresion.module.css";

export function ImpresorasView() {
  const [identidad, setIdentidad] = useState<ConfiguracionImpresion | null>(
    null,
  );
  const [config, setConfig] = useState<ImpresoraPuesto | null>(null);
  const [error, setError] = useState("");
  const [conexionAbierta, setConexionAbierta] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let activo = true;
    getConfiguracionImpresion()
      .then((dato) => {
        if (activo) {
          setIdentidad(dato);
          const etiquetas = leerImpresora(dato.tenantId);
          setConfig(etiquetas);
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
        descripcion="Cada trabajo, en su equipo. Organizá impresoras, papeles y perfiles de impresión."
        acciones={
          <ActionButton
            variant="outline"
            onPress={() => setConexionAbierta(true)}
          >
            <Cable />
            Conexión y autorización
          </ActionButton>
        }
      />
      <div className={p.contenido}>
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
        {!identidad && !error && (
          <Skeleton className="h-72" aria-label="Cargando configuración" />
        )}
        {identidad && !identidad.firmaDisponible && (
          <Alert variant="destructive">
            <AlertDescription>{identidad.mensaje}</AlertDescription>
          </Alert>
        )}
        {identidad && (
          <PerfilesImpresionPanel
            tenantId={identidad.tenantId}
            disabled={!identidad.firmaDisponible}
            etiquetaConfigurada={Boolean(config?.impresora)}
            etiquetas={
              <div className={p.etiquetas}>
                <section className={p.termicaIntro}>
                  <span className={p.eyebrow}>
                    Identificación · Este puesto
                  </span>
                  <div className={p.termicaIcon}>
                    <ScanLine aria-hidden="true" />
                  </div>
                  <h2>
                    Una etiqueta.
                    <br />
                    Todo el trabajo.
                  </h2>
                  <p>
                    Identificá los pedidos con su QR interno para abrir la
                    entrega de la orden.
                  </p>
                  <dl className={p.termicaDatos}>
                    <div>
                      <dt>Formato</dt>
                      <dd>100 × 150 mm</dd>
                    </div>
                    <div>
                      <dt>Impresión</dt>
                      <dd>Térmica · 203 dpi</dd>
                    </div>
                  </dl>
                </section>
                {config && (
                  <ImpresoraPuestoForm
                    tenantId={identidad.tenantId}
                    inicial={config}
                    disabled={!identidad.firmaDisponible}
                    onGuardar={setConfig}
                  />
                )}
              </div>
            }
          />
        )}
      </div>
      {conexionAbierta && (
        <FormDialog
          isOpen
          onOpenChange={setConexionAbierta}
          title={
            <span className={p.modalTitulo}>
              <ShieldCheck />
              Conexión y autorización
            </span>
          }
          description="QZ Tray conecta Grafo con las impresoras de tu taller."
          className={p.dialog}
        >
          <div className={p.formulario}>
            <div className={p.seccionTitulo}>
              <span className={p.numero}>01</span>
              <div>
                <h3>Equipo de impresión</h3>
                <p>
                  Mantené QZ Tray abierto en la computadora donde están
                  instaladas las impresoras. Cada equipo guarda su dirección en
                  Ajustes.
                </p>
              </div>
            </div>
            <div className={p.seccionTitulo}>
              <span className={p.numero}>02</span>
              <div>
                <h3>Autorizar a Grafo</h3>
                <p>
                  El certificado es compartido por las impresoras del mismo
                  equipo.
                </p>
              </div>
            </div>
            {identidad?.firmaDisponible ? (
              <section className={p.certificado}>
                <strong>Autorización de Grafo</strong>
                <p className={s.help}>
                  Para recordar la autorización, instalá este certificado
                  público en el equipo donde corre QZ Tray. En Windows, guardalo
                  como override.crt dentro de C:\Program Files\QZ Tray, reiniciá
                  QZ y autorizá Grafo con «Recordar esta decisión» en la primera
                  conexión.
                </p>
                <ActionButton variant="outline" onPress={descargarCertificado}>
                  <Download /> Descargar certificado público
                </ActionButton>
                <p className={s.help}>
                  Si ese equipo ya tiene un override.crt para otra aplicación,
                  consultá al administrador antes de reemplazarlo. Este
                  certificado es distinto del que permite la conexión segura
                  entre equipos.
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
          <footer className={p.footer}>
            <ActionButton
              variant="outline"
              onPress={() => setConexionAbierta(false)}
            >
              Cerrar
            </ActionButton>
          </footer>
        </FormDialog>
      )}
    </ConfiguracionPage>
  );
}
