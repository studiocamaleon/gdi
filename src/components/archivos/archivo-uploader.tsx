"use client";

import * as React from "react";
import {
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  ImageIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  formatBytes,
  urlDeArchivo,
  validarArchivo,
  type Archivo,
  type ArchivoScope,
} from "@/lib/archivos";
import {
  actualizarArchivo,
  eliminarArchivo,
  subirArchivo,
} from "@/lib/archivos-api";

type EnCurso = {
  clave: string;
  nombre: string;
  bytes: number;
  progreso: number;
  error?: string;
  abort: AbortController;
};

export type ArchivoUploaderProps = {
  scope: ArchivoScope;
  entidadId?: string;
  archivos: Archivo[];
  onCambio: (archivos: Archivo[]) => void;
  /** Restringe el tipo aceptado (el logo sólo admite imágenes). */
  extensiones?: readonly string[];
  /** Un solo archivo: el nuevo reemplaza al anterior. */
  unico?: boolean;
  titulo?: string;
  ayuda?: string;
  soloLectura?: boolean;
  /** Oculta la lista: para cuando el consumidor pinta su propia vista. */
  sinLista?: boolean;
  /**
   * Muestra el switch "visible para el cliente" en cada fila. Sólo donde el
   * archivo puede llegar al link público de seguimiento (una OT); en el logo
   * o en la ficha de un producto no tiene sentido.
   */
  permitirPublico?: boolean;
  /** Texto del vacío. Sin esto, un tab sin archivos no dice nada. */
  vacio?: string;
};

/**
 * Subida de archivos con drag & drop y progreso real.
 *
 * Los bytes van DIRECTO al storage con una URL firmada; el API sólo ve dos
 * JSON chicos (iniciar/confirmar). Por eso hay progreso de verdad y no una
 * animación de mentira: el navegador está subiendo, no esperando.
 *
 * Ver docs/archivos-r2-diseno.md
 */
export function ArchivoUploader({
  scope,
  entidadId,
  archivos,
  onCambio,
  extensiones,
  unico = false,
  titulo = "Arrastrá archivos o hacé click para elegirlos",
  ayuda,
  soloLectura = false,
  sinLista = false,
  permitirPublico = false,
  vacio,
}: ArchivoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dentro, setDentro] = React.useState(false);
  const [enCurso, setEnCurso] = React.useState<EnCurso[]>([]);
  const [aBorrar, setABorrar] = React.useState<Archivo | null>(null);

  // Las subidas en vuelo se cancelan si el componente se desmonta: sin esto,
  // el XHR sigue vivo y el confirmar escribe sobre un componente muerto.
  const enCursoRef = React.useRef<EnCurso[]>([]);
  enCursoRef.current = enCurso;
  React.useEffect(
    () => () => enCursoRef.current.forEach((s) => s.abort.abort()),
    [],
  );

  const procesar = React.useCallback(
    async (files: File[]) => {
      const elegidos = unico ? files.slice(0, 1) : files;

      for (const file of elegidos) {
        const invalido = validarArchivo(file, { extensiones });
        if (invalido) {
          toast.error(`${file.name}: ${invalido}`);
          continue;
        }

        const clave = `${file.name}-${file.size}-${Date.now()}`;
        const abort = new AbortController();
        setEnCurso((s) => [
          ...s,
          { clave, nombre: file.name, bytes: file.size, progreso: 0, abort },
        ]);

        try {
          const subido = await subirArchivo(
            file,
            { scope, entidadId },
            (pct) =>
              setEnCurso((s) =>
                s.map((x) => (x.clave === clave ? { ...x, progreso: pct } : x)),
              ),
            abort.signal,
          );
          setEnCurso((s) => s.filter((x) => x.clave !== clave));
          onCambio(unico ? [subido] : [subido, ...archivos]);
          toast.success(`${file.name} subido.`);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setEnCurso((s) => s.filter((x) => x.clave !== clave));
            continue;
          }
          const mensaje =
            error instanceof Error ? error.message : "No se pudo subir.";
          setEnCurso((s) =>
            s.map((x) => (x.clave === clave ? { ...x, error: mensaje } : x)),
          );
          toast.error(`${file.name}: ${mensaje}`);
        }
      }
    },
    [archivos, entidadId, extensiones, onCambio, scope, unico],
  );

  const cambiarVisibilidad = async (archivo: Archivo, publico: boolean) => {
    // Optimista: el switch tiene que responder al toque, no medio segundo
    // después. Si el PATCH falla se revierte y se avisa.
    onCambio(
      archivos.map((a) => (a.id === archivo.id ? { ...a, publico } : a)),
    );
    try {
      await actualizarArchivo(archivo.id, { publico });
    } catch (error) {
      onCambio(archivos);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la visibilidad.",
      );
    }
  };

  const borrar = async () => {
    if (!aBorrar) return;
    try {
      await eliminarArchivo(aBorrar.id);
      onCambio(archivos.filter((a) => a.id !== aBorrar.id));
      toast.success(`${aBorrar.nombre} eliminado.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar.",
      );
    } finally {
      setABorrar(null);
    }
  };

  const accept = extensiones?.map((e) => `.${e}`).join(",");

  return (
    <>
      {!soloLectura ? (
        <div
          className={`arch-drop${dentro ? " dentro" : ""}${enCurso.length > 0 ? " ocupado" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDentro(true);
          }}
          onDragLeave={() => setDentro(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDentro(false);
            void procesar(Array.from(e.dataTransfer.files));
          }}
        >
          <UploadCloudIcon />
          <div className="arch-drop-t">{titulo}</div>
          {ayuda ? <div className="arch-drop-s">{ayuda}</div> : null}
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple={!unico}
            accept={accept}
            onChange={(e) => {
              void procesar(Array.from(e.target.files ?? []));
              // Sin esto, elegir el MISMO archivo dos veces seguidas no
              // dispara change y parece que el botón no anda.
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {!sinLista && vacio && archivos.length === 0 && enCurso.length === 0 ? (
        <div className="arch-vacio">{vacio}</div>
      ) : null}

      {!sinLista && (archivos.length > 0 || enCurso.length > 0) ? (
        <div className="arch-lista">
          {enCurso.map((s) => (
            <div key={s.clave} className="arch-row subiendo">
              <span className="arch-ico">
                <FileIcon />
              </span>
              <div className="arch-nom">
                <b>{s.nombre}</b>
                <span>
                  {formatBytes(s.bytes)} · {s.error ? "error" : `${s.progreso}%`}
                </span>
                {s.error ? (
                  <div className="arch-error">{s.error}</div>
                ) : (
                  <div className="arch-bar">
                    <i style={{ width: `${s.progreso}%` }} />
                  </div>
                )}
              </div>
              <div className="arch-acc">
                <button
                  type="button"
                  title="Cancelar"
                  onClick={() => s.abort.abort()}
                >
                  <XIcon />
                </button>
              </div>
            </div>
          ))}

          {archivos.map((a) => (
            <div key={a.id} className="arch-row">
              <span className="arch-ico">
                {a.esImagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlDeArchivo(a.id)} alt="" />
                ) : (
                  <FileIcon />
                )}
              </span>
              <div className="arch-nom">
                <b>{a.nombre}</b>
                <span>
                  {formatBytes(a.bytes)}
                  {a.subidoPor ? ` · ${a.subidoPor}` : ""}
                </span>
              </div>
              {permitirPublico && !soloLectura ? (
                <label
                  className={`arch-vis${a.publico ? " on" : ""}`}
                  title={
                    a.publico
                      ? "El cliente lo ve en el link de seguimiento"
                      : "Sólo interno: el cliente no lo ve"
                  }
                >
                  <input
                    type="checkbox"
                    checked={a.publico}
                    onChange={(e) =>
                      void cambiarVisibilidad(a, e.target.checked)
                    }
                  />
                  {a.publico ? <EyeIcon /> : <EyeOffIcon />}
                  <span>{a.publico ? "Cliente" : "Interno"}</span>
                </label>
              ) : null}
              <div className="arch-acc">
                <a
                  href={urlDeArchivo(a.id)}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir o descargar"
                  className="arch-descarga"
                >
                  <DownloadIcon />
                </a>
                {!soloLectura ? (
                  <button
                    type="button"
                    className="peligro"
                    title="Eliminar"
                    onClick={() => setABorrar(a)}
                  >
                    <Trash2Icon />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmacionDestructiva
        open={aBorrar !== null}
        onOpenChange={(v) => {
          if (!v) setABorrar(null);
        }}
        titulo="Eliminar archivo"
        nombreItem={aBorrar?.nombre}
        descripcion="Deja de estar disponible en el sistema. Queda 30 días en la papelera antes de borrarse del todo."
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={() => void borrar()}
      />
    </>
  );
}

/** Ícono por tipo, para cuando el consumidor arma su propia fila. */
export function IconoArchivo({ archivo }: { archivo: Archivo }) {
  return archivo.esImagen ? <ImageIcon /> : <FileIcon />;
}
