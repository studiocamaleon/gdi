"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import * as api from "@/lib/centro-copiado-tarifarios-api";
import {
  AvisoPreparacion,
  Elegir,
  ErrorTarifa,
  mensajeErrorTarifa,
  useAvisoCambios,
} from "./centro-copiado-tarifarios-controles";

const canales = [
  { value: "mostrador", label: "Mostrador" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "web", label: "Web" },
  { value: "app_movil", label: "App móvil" },
] as const;
const pendientes = {
  SIN_VERSION_VIGENTE: "Sin versión vigente",
  TARIFARIO_NO_DISPONIBLE: "Tarifario no disponible",
  MONEDA_INCOMPATIBLE: "Moneda incompatible",
};
type Asignacion = api.PoliticaPrecios["canales"][api.CanalCopiado];
function valorAsignacion(a: Asignacion) {
  return a.modalidad === "TARIFARIO" ? a.tarifarioId : a.modalidad;
}
function desdeSeleccion(s: string): Asignacion {
  return s === "HEREDAR" || s === "MOTOR"
    ? { modalidad: s }
    : { modalidad: "TARIFARIO", tarifarioId: s };
}
export function CentroCopiadoCanales({
  puedeGestionar,
  revisionTarifarios,
  activo,
}: {
  puedeGestionar: boolean;
  revisionTarifarios: number;
  activo: boolean;
}) {
  const { zonaHoraria } = useConfigRegional();
  const [base, setBase] = useState<api.BorradorPolitica | null>(null);
  const [contenido, setContenido] = useState<api.PoliticaPrecios | null>(null);
  const [lista, setLista] = useState<api.ResumenTarifario[]>([]);
  const [preview, setPreview] = useState<api.VistaCanales | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [descartar, setDescartar] = useState(false);
  const bloqueo = useRef(false);
  const cambios =
    !!contenido &&
    JSON.stringify(contenido) !== JSON.stringify(base?.contenido);
  const cambiosRef = useRef(cambios);
  const interacciones = useRef(0);
  function editar(c: api.PoliticaPrecios) {
    interacciones.current++;
    setContenido(c);
  }
  useEffect(() => {
    cambiosRef.current = cambios;
  }, [cambios]);
  useAvisoCambios(cambios);
  useEffect(() => {
    if (!activo) return;
    let viva = true;
    const interaccionInicial = interacciones.current;
    api
      .listarTarifarios()
      .then((l) => {
        if (viva) setLista(l);
      })
      .catch((e) => {
        if (viva) setError(mensajeErrorTarifa(e));
      });
    // Actualiza la vista previa al volver a Canales; nunca reemplaza una edición en curso.
    api
      .previsualizarCanales()
      .then((p) => {
        if (
          viva &&
          interaccionInicial === interacciones.current &&
          !bloqueo.current &&
          !cambiosRef.current
        ) {
          setBase(p.borrador);
          setContenido(p.borrador.contenido);
          setPreview(p);
        }
      })
      .catch((e) => {
        if (viva) setError(mensajeErrorTarifa(e));
      })
      .finally(() => {
        if (viva) setCargando(false);
      });
    return () => {
      viva = false;
    };
  }, [revisionTarifarios, activo]);
  async function recargar() {
    if (bloqueo.current) return;
    interacciones.current++;
    bloqueo.current = true;
    setOcupado(true);
    setError(null);
    try {
      const [p, l] = await Promise.all([
        api.previsualizarCanales(),
        api.listarTarifarios(),
      ]);
      setBase(p.borrador);
      setContenido(p.borrador.contenido);
      setPreview(p);
      setLista(l);
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
      setCargando(false);
    }
  }
  async function guardar() {
    if (!base || !contenido || !puedeGestionar || bloqueo.current) return false;
    interacciones.current++;
    bloqueo.current = true;
    setOcupado(true);
    setError(null);
    let guardado = false;
    try {
      const b = await api.guardarPoliticaTarifarios(base.revision, contenido);
      setBase(b);
      setContenido(b.contenido);
      setPreview(null);
      guardado = true;
      toast.success("Asignación por canal guardada en preparación.");
      try {
        setPreview(await api.previsualizarCanales());
      } catch {
        setError(
          "La asignación se guardó, pero no se pudo actualizar la vista previa. Usá Actualizar vista previa.",
        );
      }
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
    return guardado;
  }
  const opciones = (a: Asignacion, heredar: boolean) => [
    ...(heredar
      ? [{ value: "HEREDAR", label: "Heredar política general" }]
      : []),
    { value: "MOTOR", label: "Motor de cotización" },
    ...lista.map((t) => ({ value: t.id, label: t.nombre })),
    ...(a.modalidad === "TARIFARIO" &&
    !lista.some((t) => t.id === a.tarifarioId)
      ? [
          {
            value: a.tarifarioId,
            label: "Tarifario asignado no disponible en el listado",
          },
        ]
      : []),
  ];
  const previewActual =
    !cambios && preview && preview.borrador.revision === base?.revision;
  return (
    <div className="grid gap-4">
      <AvisoPreparacion />
      <ErrorTarifa error={error} />
      <Card>
        <CardHeader>
          <CardTitle>Precios por canal de venta</CardTitle>
          <CardDescription>
            Definí una política general y sólo las excepciones que necesites.
            Varios canales pueden compartir un tarifario sin duplicarlo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {cargando ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            contenido && (
              <>
                <FieldGroup>
                  <Elegir
                    etiqueta="Política general"
                    valor={valorAsignacion(contenido.general)}
                    opciones={opciones(contenido.general, false)}
                    disabled={!puedeGestionar || ocupado}
                    onChange={(v) => {
                      const general = desdeSeleccion(v);
                      if (general.modalidad !== "HEREDAR")
                        editar({ ...contenido, general });
                    }}
                    ayuda="Los canales sin excepción heredan esta elección."
                  />
                </FieldGroup>
                <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {canales.map((c) => (
                    <Elegir
                      key={c.value}
                      etiqueta={c.label}
                      valor={valorAsignacion(contenido.canales[c.value])}
                      opciones={opciones(contenido.canales[c.value], true)}
                      disabled={!puedeGestionar || ocupado}
                      onChange={(v) =>
                        editar({
                          ...contenido,
                          canales: {
                            ...contenido.canales,
                            [c.value]: desdeSeleccion(v),
                          },
                        })
                      }
                    />
                  ))}
                </FieldGroup>
              </>
            )
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">En preparación</Badge>
            {cambios && <Badge variant="secondary">Cambios sin guardar</Badge>}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={() => {
                  if (cambios) setDescartar(true);
                  else void recargar();
                }}
              >
                {cambios
                  ? "Recargar asignación guardada"
                  : "Actualizar vista previa"}
              </Button>
              {puedeGestionar && (
                <Button
                  loading={ocupado}
                  disabled={!cambios || ocupado}
                  onClick={() => void guardar()}
                >
                  Guardar canales
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vista previa de la asignación guardada</CardTitle>
          <CardDescription>
            {cambios
              ? "Guardá los cambios para comprobar qué versión resolvería cada canal."
              : previewActual
                ? `Evaluada el ${new Intl.DateTimeFormat("es-AR", { timeZone: zonaHoraria, dateStyle: "short", timeStyle: "short" }).format(new Date(preview.evaluadoEl))} (${zonaHoraria}). Moneda: ${preview.monedaCodigo}. Actualizá la vista para comprobar una vigencia programada.`
                : "Actualizá la vista previa para comprobar la asignación."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewActual && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Selección</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.canales.map((c) => (
                  <TableRow key={c.canalVenta}>
                    <TableCell>
                      {canales.find((x) => x.value === c.canalVenta)?.label}
                    </TableCell>
                    <TableCell>
                      {c.origen === "GENERAL"
                        ? "Política general"
                        : "Excepción del canal"}
                    </TableCell>
                    <TableCell>
                      {c.estado === "MOTOR" ? (
                        "Motor de cotización"
                      ) : c.estado === "PENDIENTE" ? (
                        <Badge variant="outline">
                          Pendiente · {pendientes[c.motivo]}
                        </Badge>
                      ) : (
                        `${c.version.nombre} · versión ${c.version.numero}`
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Esta vista comprueba la selección de tarifario y versión; no
            verifica que cada combinación tenga precio ni activa el cálculo de
            pedidos.
          </p>
        </CardContent>
      </Card>
      <ConfirmacionSalida
        open={descartar}
        cambios={1}
        donde="la asignación por canal"
        guardando={ocupado}
        onSeguirEditando={() => setDescartar(false)}
        onDescartarYSalir={() => {
          setDescartar(false);
          void recargar();
        }}
        onGuardarYSalir={async () => {
          if (await guardar()) setDescartar(false);
        }}
      />
    </div>
  );
}
