"use client";
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DocumentoOrden, EnvioDocumento } from "@/lib/impresion-api";
import { claveDocumento } from "@/lib/impresion-api";
import { textoEstadoDocumento } from "@/lib/impresion-documentos";
import { ORIENTACION_PDF_LABELS } from "@/lib/orientacion-pdf";
import s from "./documentos-impresion.module.css";

export function DocumentosTabla({
  documentos,
  historial = [],
  acciones,
  provisional = false,
}: {
  provisional?: boolean;
  documentos: DocumentoOrden[];
  historial?: EnvioDocumento[];
  acciones?: (doc: DocumentoOrden, ultimo?: EnvioDocumento) => ReactNode;
}) {
  return (
    <Table className={s.tabla}>
      <TableHeader>
        <TableRow>
          <TableHead>Archivo</TableHead>
          <TableHead>Configuración</TableHead>
          <TableHead>Destino</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documentos.map((doc) => {
          const envios = historial.filter(
            (e) => claveDocumento(e) === claveDocumento(doc),
          );
          const ultimo = envios[0];
          const perfil = doc.ruta.perfil;
          const config = ultimo?.configuracion ?? doc.configuracion;
          return (
            <TableRow key={claveDocumento(doc)}>
              <TableCell className={s.archivo}>
                <strong>{doc.nombre}</strong>
                <span className={s.secundario}>
                  {doc.configuracion.tamano === "CAD" ? `${doc.paginas} ${doc.paginas === 1 ? "plano" : "planos"} · ${doc.hojas} impresiones · escala 100%` : <>{doc.paginas} páginas · {doc.copias} {doc.copias === 1 ? "copia" : "copias"} · {doc.hojas} hojas</>}
                </span>
                <details className={s.historial}>
                  <summary>
                    Detalles
                    {envios.length > 0
                      ? ` · ${envios.length} ${envios.length === 1 ? "envío" : "envíos"}`
                      : ""}
                  </summary>
                  <p>
                    {doc.orientacion
                      ? ORIENTACION_PDF_LABELS[doc.orientacion]
                      : "Orientación automática"}
                    {doc.faz === 2 ? " · Dúplex por borde largo" : ""}
                  </p>
                  {doc.seleccionPaginas?.map((r, i) => (
                    <p key={i}>
                      {r.nombre}: páginas {r.rango} de {r.paginasOriginales}
                    </p>
                  ))}
                  {doc.paginasCad?.map(p => <p key={p.pagina}>Página {p.pagina}: {p.copias} {p.copias === 1 ? "copia" : "copias"} · {p.anchoMm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} × {p.altoMm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} mm</p>)}
                  {doc.motivo && <p>{doc.motivo}</p>}
                  {envios.map((e) => (
                    <section key={e.id}>
                      <strong>{textoEstadoDocumento[e.estado]}</strong>
                      <p>
                        {new Date(e.fecha).toLocaleString()} · {e.usuario}
                        <br />
                        {e.impresora} · {e.copias} copias
                      </p>
                      {e.eventos.map((ev, i) => (
                        <p key={i}>
                          {new Date(ev.fecha).toLocaleTimeString()} ·{" "}
                          {ev.detalle}
                        </p>
                      ))}
                      {e.confirmacion && (
                        <p>
                          Verificado por {e.confirmacion.usuario} ·{" "}
                          {new Date(e.confirmacion.fecha).toLocaleString()}
                        </p>
                      )}
                    </section>
                  ))}
                  {acciones?.(doc, ultimo)}
                </details>
              </TableCell>
              <TableCell>
                <span>
                  {config.papelNombre || "Papel sin identificar"}
                  {config.gramaje ? ` · ${config.gramaje} g` : ""}
                </span>
                <span className={s.secundario}>
                  {config.tamano} ·{" "}
                  {config.color === "BN"
                    ? "B/N"
                    : config.color === "COLOR"
                      ? "Color"
                      : config.color}{" "}
                  · {doc.faz === 2 ? "Doble faz" : "Simple faz"}
                </span>
              </TableCell>
              <TableCell>
                <span>
                  {ultimo?.impresora ??
                    perfil?.bandeja.destino.nombre ??
                    "Sin asignar"}
                </span>
                <span className={s.secundario}>
                  {ultimo
                    ? (ultimo.perfilSnapshot?.bandeja.nombre ??
                      "Envío registrado")
                    : (perfil?.bandeja.nombre ?? "Revisar configuración")}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {ultimo?.confirmacion
                    ? "Impresión verificada"
                    : ultimo
                      ? textoEstadoDocumento[ultimo.estado]
                      : doc.motivo
                        ? doc.ruta.estado === "PREPARACION"
                          ? "Preparar papel"
                          : "Revisar"
                        : provisional
                          ? "Configuración apta"
                          : "Listo para enviar"}
                </Badge>
                {!ultimo && doc.motivo && (
                  <span className={s.secundario}>{doc.motivo}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
