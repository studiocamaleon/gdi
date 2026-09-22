"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  confirmarDocumentosImpresos,
  getHistorialImpresion,
  type HistorialImpresion,
} from "@/lib/impresion-api";
import { textoEstadoDocumento } from "@/lib/impresion-documentos";
import s from "./historial-impresion.module.css";

/** Consulta y verificación humana. Este diálogo nunca carga el transporte QZ. */
export function HistorialImpresionDialog({
  ordenId,
  onClose,
}: {
  ordenId: string;
  onClose: () => void;
}) {
  const gestionar = usePuede("comercial.gestionar");
  const ejecutar = usePuede("produccion.ejecutar");
  const [vista, setVista] = useState<HistorialImpresion | null>(null);
  const [desde, setDesde] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setVista(null);
    setError("");
    setSeleccion([]);
    setConfirmando(false);
    void getHistorialImpresion(ordenId, desde)
      .then((datos) => {
        if (vigente) setVista(datos);
      })
      .catch((e: unknown) => {
        if (vigente)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo consultar el historial.",
          );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [ordenId, desde, revision]);
  const puedeConfirmar = !!vista?.puedeConfirmar && (gestionar || ejecutar);
  const mostrarSeleccion =
    puedeConfirmar &&
    vista?.envios.some((envio) => envio.vigente && !envio.confirmacion);
  const confirmar = useCallback(async () => {
    if (!puedeConfirmar || !seleccion.length || guardando) return;
    setGuardando(true);
    setError("");
    try {
      await confirmarDocumentosImpresos(ordenId, seleccion);
      setSeleccion([]);
      setConfirmando(false);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la verificación.",
      );
    } finally {
      setGuardando(false);
    }
  }, [puedeConfirmar, seleccion, guardando, ordenId]);
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable={!guardando}
      title="Historial de impresión"
      description={
        vista
          ? `${vista.numero} · Envíos y verificación de salidas`
          : "Consultando los envíos de la orden"
      }
      className={s.dialog}
    >
      <div className={s.body}>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!!vista?.pendientesSinEnvio && (
          <Alert>
            <AlertDescription>
              {vista.pendientesSinEnvio} trabajo(s) solicitado(s) sin un envío
              registrado. Revisalos en la OT para imprimirlos manualmente o
              continuar desde el asistente cuando esté habilitado.
            </AlertDescription>
          </Alert>
        )}
        <p className={s.nota}>
          Este historial se conserva al cambiar de plan. Los estados de Windows
          no verifican la salida física; confirmá sólo las copias que revisaste.
        </p>
        {cargando ? (
          <p role="status">Cargando historial…</p>
        ) : !vista ? null : !vista.envios.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No hay envíos de impresión registrados.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {mostrarSeleccion && (
                  <TableHead aria-label="Seleccionar salidas" />
                )}
                <TableHead>Documento</TableHead>
                <TableHead>Impresora</TableHead>
                <TableHead>Estado registrado</TableHead>
                <TableHead>Verificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vista?.envios.map((envio) => (
                <TableRow key={envio.id}>
                  {mostrarSeleccion && (
                    <TableCell>
                      {envio.vigente && !envio.confirmacion && (
                        <Checkbox
                          aria-label={`Seleccionar ${envio.nombre}${envio.pagina ? ` · página ${envio.pagina}` : ""}`}
                          checked={seleccion.includes(envio.id)}
                          disabled={guardando || confirmando}
                          onCheckedChange={(checked) =>
                            setSeleccion((ids) =>
                              checked
                                ? [...new Set([...ids, envio.id])]
                                : ids.filter((id) => id !== envio.id),
                            )
                          }
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <strong>{envio.nombre}</strong>
                    <p className={s.detalle}>
                      {envio.pagina ? `Página ${envio.pagina} · ` : ""}
                      {envio.copias} copia(s) · {envio.paginas} página(s)
                    </p>
                    <p className={s.detalle}>
                      {new Date(envio.fecha).toLocaleString("es-AR")} ·{" "}
                      {envio.usuario}
                    </p>
                  </TableCell>
                  <TableCell>{envio.impresora}</TableCell>
                  <TableCell>
                    {textoEstadoDocumento[envio.estado] ?? envio.estado}
                    {!!envio.eventos?.length && (
                      <details className={s.detalle}>
                        <summary>Ver eventos</summary>
                        {envio.eventos.map((evento, i) => (
                          <p key={i}>
                            {new Date(evento.fecha).toLocaleString("es-AR")} ·{" "}
                            {evento.detalle}
                          </p>
                        ))}
                      </details>
                    )}
                  </TableCell>
                  <TableCell>
                    {envio.confirmacion ? (
                      <>
                        <strong>Verificada</strong>
                        <p className={s.detalle}>
                          {envio.confirmacion.usuario} ·{" "}
                          {new Date(envio.confirmacion.fecha).toLocaleString(
                            "es-AR",
                          )}
                        </p>
                      </>
                    ) : envio.vigente ? (
                      "Sin verificar"
                    ) : (
                      "Hay un envío posterior"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {confirmando && (
          <Alert>
            <AlertDescription>
              Vas a registrar que revisaste y están impresas correctamente las{" "}
              {seleccion.length} salidas seleccionadas. Esto no envía archivos
              ni completa las tareas de producción.
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className={s.footer}>
        <span className={s.nota}>{vista?.total ?? 0} envíos</span>
        <ActionButton
          variant="tertiary"
          onPress={() => setRevision((n) => n + 1)}
          isDisabled={cargando || guardando}
        >
          Actualizar
        </ActionButton>
        {(desde > 0 || (vista?.total ?? 0) > 50) && (
          <>
            <ActionButton
              variant="tertiary"
              onPress={() => setDesde(Math.max(0, desde - 50))}
              isDisabled={!desde || cargando || guardando}
            >
              Anterior
            </ActionButton>
            <ActionButton
              variant="tertiary"
              onPress={() => setDesde(vista!.siguiente!)}
              isDisabled={vista?.siguiente == null || cargando || guardando}
            >
              Siguiente
            </ActionButton>
          </>
        )}
        {confirmando ? (
          <>
            <ActionButton
              variant="tertiary"
              onPress={() => setConfirmando(false)}
              isDisabled={guardando}
            >
              Volver
            </ActionButton>
            <ActionButton
              onPress={() => void confirmar()}
              isDisabled={guardando || !puedeConfirmar}
            >
              Confirmar salida correcta
            </ActionButton>
          </>
        ) : (
          mostrarSeleccion && (
            <ActionButton
              onPress={() => setConfirmando(true)}
              isDisabled={!seleccion.length || cargando}
            >
              Verificar selección ({seleccion.length})
            </ActionButton>
          )
        )}
        <ActionButton
          variant="secondary"
          onPress={onClose}
          isDisabled={guardando}
        >
          Cerrar
        </ActionButton>
      </div>
    </FormDialog>
  );
}
