"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Chip } from "@heroui/react";
import {
  listarLotesFacturacion,
  obtenerLoteFacturacion,
  type LoteFacturacion,
} from "@/lib/administracion-api";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionButton } from "@/components/design-system/action-button";
import s from "./facturacion.module.css";

const firmaAvance = (l: LoteFacturacion) =>
  `${l.estado}:${l.items.filter((i) => i.estado === "emitida").length}`;
const finalizado = (l: LoteFacturacion) =>
  ["completado", "con_observaciones"].includes(l.estado);
const estados = {
  pendiente: "En espera",
  procesando: "Emitiendo facturas",
  esperando_envios: "Esperando confirmación de los envíos",
  completado: "Facturas y envíos completados",
  con_observaciones: "Terminado con observaciones",
};
const fiscal = {
  pendiente: "Pendiente de emitir",
  emitiendo: "Procesando emisión fiscal",
  emitida: "Factura emitida",
  error: "No emitida",
  verificar: "Resultado fiscal por verificar",
};
const avisos = {
  pendiente: "Aviso pendiente",
  enviada: "Envío confirmado",
  omitida: "Aviso no enviado",
  fallida: "Falló la preparación o el envío",
  verificar: "Envío por verificar",
};

export function FacturacionLotes({ revision }: { revision: number }) {
  const router = useRouter();
  const fecha = useFecha();
  const [seleccionado, setSeleccionado] = React.useState<string | null>(null);
  const [lotes, setLotes] = React.useState<LoteFacturacion[]>([]);
  const [error, setError] = React.useState(false);
  const [reintento, setReintento] = React.useState(0);
  const refrescar = React.useRef(router.refresh);
  refrescar.current = router.refresh;
  const anteriores = React.useRef<Map<string, string>>(new Map());
  React.useEffect(() => {
    let cerrado = false;
    let timer: ReturnType<typeof setTimeout>;
    async function consultar() {
      let demora = 5_000;
      try {
        const nuevos = await listarLotesFacturacion();
        const objetivo = new URLSearchParams(window.location.search).get(
          "lote",
        );
        if (
          objetivo &&
          /^[a-f0-9-]{36}$/i.test(objetivo) &&
          !nuevos.some((l) => l.id === objetivo)
        )
          nuevos.unshift(await obtenerLoteFacturacion(objetivo));
        if (!cerrado) setSeleccionado(objetivo);
        if (cerrado) return;
        if (
          nuevos.some(
            (l) =>
              anteriores.current.has(l.id) &&
              anteriores.current.get(l.id) !== firmaAvance(l),
          )
        )
          refrescar.current();
        anteriores.current = new Map(nuevos.map((l) => [l.id, firmaAvance(l)]));
        setLotes(nuevos);
        setError(false);
        if (!nuevos.some((l) => !finalizado(l))) demora = 30_000;
      } catch {
        if (!cerrado) setError(true);
        demora = 15_000;
      }
      if (!cerrado) timer = setTimeout(consultar, demora);
    }
    void consultar();
    return () => {
      cerrado = true;
      clearTimeout(timer);
    };
  }, [revision, reintento]);
  if (!lotes.length && !error) return null;
  return (
    <Card className={s.card} id="lotes-facturacion">
      <Card.Header className={s.cardHeader}>
        <div>
          <Card.Title>Mis lotes de facturación</Card.Title>
          <Card.Description>
            Podés salir de esta pantalla. Te avisaremos en la campanita cuando
            termine la emisión y los envíos, o si algo requiere revisión.
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content className={s.resultBody}>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No pudimos actualizar el avance</AlertTitle>
            <AlertDescription>
              El lote sigue guardado. Volveremos a consultar automáticamente.
              <ActionButton
                variant="outline"
                onPress={() => setReintento((v) => v + 1)}
              >
                Actualizar avance
              </ActionButton>
            </AlertDescription>
          </Alert>
        )}
        {lotes.map((lote) => {
          const procesadas = lote.items.filter((i) =>
            ["emitida", "error", "verificar"].includes(i.estado),
          ).length;
          const emitidas = lote.items.filter(
            (i) => i.estado === "emitida",
          ).length;
          const enviadas = lote.items.filter(
            (i) => i.avisoEstado === "enviada",
          ).length;
          return (
            <details
              key={lote.id}
              id={`lote-${lote.id}`}
              open={!finalizado(lote) || seleccionado === lote.id}
            >
              <summary>
                {fecha.fechaHoraCorta(lote.createdAt)} · {estados[lote.estado]}{" "}
                · {emitidas}/{lote.items.length} facturas · {enviadas} envíos
                confirmados
              </summary>
              <Progress
                value={(procesadas / Math.max(1, lote.items.length)) * 100}
                aria-label="Avance de emisión"
              >
                <ProgressLabel>
                  {procesadas} de {lote.items.length} facturas procesadas
                </ProgressLabel>
              </Progress>
              <ul className={s.resultList} aria-label="Avance por orden">
                {lote.items.map((item) => (
                  <li key={item.id} data-ok={item.estado === "emitida"}>
                    <div>
                      <strong>{item.numeros.join(", ")}</strong>
                      <p>
                        <Chip
                          variant="soft"
                          color={
                            item.estado === "emitida"
                              ? "success"
                              : ["error", "verificar"].includes(item.estado)
                                ? "warning"
                                : "default"
                          }
                        >
                          {fiscal[item.estado]}
                        </Chip>{" "}
                        {item.error}
                      </p>
                      {item.estado === "emitida" && (
                        <p>
                          {avisos[item.avisoEstado]}
                          {item.avisoDetalle ? `: ${item.avisoDetalle}` : ""}
                        </p>
                      )}
                      {item.comprobanteId && (
                        <Link
                          href={`/administracion/comprobantes/${item.comprobanteId}`}
                        >
                          Ver comprobante
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </Card.Content>
    </Card>
  );
}
