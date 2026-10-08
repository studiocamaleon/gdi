"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HistoryIcon, LayersIcon, ChevronDownIcon } from "lucide-react";
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
import { ActionLink } from "@/components/design-system/action-link";
import s from "./facturacion-lotes.module.css";

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

export function FacturacionLotes({
  revision = 0,
  historial = false,
}: {
  revision?: number;
  historial?: boolean;
}) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = React.useState<string | null>(null);
  const [lotes, setLotes] = React.useState<LoteFacturacion[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [anterioresLotes, setAnterioresLotes] = React.useState<
    LoteFacturacion[]
  >([]);
  const [hayMas, setHayMas] = React.useState(false);
  const [cargandoMas, setCargandoMas] = React.useState(false);
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
        const nuevos = await listarLotesFacturacion({ activos: !historial });
        if (!cerrado && historial)
          setHayMas((current) =>
            anteriores.current.size === 0 ? nuevos.length === 20 : current,
          );
        const objetivo = new URLSearchParams(window.location.search).get(
          "lote",
        );
        if (
          historial &&
          objetivo &&
          /^[a-f0-9-]{36}$/i.test(objetivo) &&
          !nuevos.some((l) => l.id === objetivo)
        )
          nuevos.unshift(await obtenerLoteFacturacion(objetivo));
        if (!cerrado) setSeleccionado(objetivo);
        if (cerrado) return;
        if (
          [...anteriores.current.keys()].some(
            (id) => !nuevos.some((l) => l.id === id),
          ) ||
          nuevos.some(
            (l) =>
              anteriores.current.has(l.id) &&
              anteriores.current.get(l.id) !== firmaAvance(l),
          )
        )
          refrescar.current();
        anteriores.current = new Map(nuevos.map((l) => [l.id, firmaAvance(l)]));
        setLotes((current) =>
          historial
            ? [
                ...new Map(
                  [...nuevos, ...current].map((l) => [l.id, l]),
                ).values(),
              ]
            : nuevos,
        );
        setError(false);
        setCargando(false);
        if (!nuevos.some((l) => !finalizado(l))) demora = 30_000;
      } catch {
        if (!cerrado) {
          setError(true);
          setCargando(false);
        }
        demora = 15_000;
      }
      if (!cerrado) timer = setTimeout(consultar, demora);
    }
    void consultar();
    return () => {
      cerrado = true;
      clearTimeout(timer);
    };
  }, [revision, reintento, historial]);
  const visibles = historial
    ? [
        ...new Map(
          [...lotes, ...anterioresLotes].map((l) => [l.id, l]),
        ).values(),
      ]
    : lotes.filter((l) => !finalizado(l));
  async function cargarMas() {
    setCargandoMas(true);
    try {
      const pagina = await listarLotesFacturacion({
        cursor: visibles.at(-1)?.id,
      });
      setAnterioresLotes((current) => [...current, ...pagina]);
      setHayMas(pagina.length === 20);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargandoMas(false);
    }
  }
  if (!historial && !visibles.length && !error) return null;
  return (
    <Card className={s.card} id="lotes-facturacion">
      <Card.Header className={s.cardHeader}>
        <span className={s.icon}>
          <LayersIcon aria-hidden />
        </span>
        <div>
          <Card.Title>
            {historial ? "Actividad de tus lotes" : "Facturación en curso"}
          </Card.Title>
          <Card.Description>
            {historial
              ? "Consultá el resultado de cada factura y sus envíos. Los lotes terminados se conservan acá."
              : "Podés seguir trabajando. Te avisaremos en la campanita cuando terminen las facturas y los envíos."}
          </Card.Description>
        </div>
        {!historial && (
          <ActionLink
            href="/administracion/facturacion/lotes"
            variant="outline"
          >
            <HistoryIcon aria-hidden /> Ver historial
          </ActionLink>
        )}
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
        {historial && !visibles.length && !error && (
          <div className={s.empty}>
            <LayersIcon aria-hidden />
            <h3>
              {cargando ? "Consultando tus lotes…" : "Todavía no tenés lotes"}
            </h3>
            <p>
              Cuando emitas varias facturas juntas, podrás consultar su
              resultado acá.
            </p>
          </div>
        )}
        {visibles.map((lote) => (
          <DetalleLoteFacturacion
            key={lote.id}
            lote={lote}
            seleccionado={seleccionado === lote.id}
          />
        ))}
        {historial && hayMas && (
          <ActionButton
            variant="outline"
            isPending={cargandoMas}
            onPress={cargarMas}
          >
            Ver lotes anteriores
          </ActionButton>
        )}
      </Card.Content>
    </Card>
  );
}

export function DetalleLoteFacturacion({
  lote,
  seleccionado = false,
}: {
  lote: LoteFacturacion;
  seleccionado?: boolean;
}) {
  const fecha = useFecha();
  const procesadas = lote.items.filter((i) =>
    ["emitida", "error", "verificar"].includes(i.estado),
  ).length;
  const emitidas = lote.items.filter((i) => i.estado === "emitida").length;
  const enviadas = lote.items.filter((i) => i.avisoEstado === "enviada").length;
  return (
    <details id={`lote-${lote.id}`} open={!finalizado(lote) || seleccionado}>
      <summary>
        <span className={s.loteTitle}>
          <span className={s.date}>{fecha.fechaHoraCorta(lote.createdAt)}</span>
          <strong>{estados[lote.estado]}</strong>
        </span>
        <span className={s.summaryMetrics}>
          <span>
            <b>
              {emitidas}/{lote.items.length}
            </b>{" "}
            facturas emitidas
          </span>
          <span>
            <b>
              {enviadas}/{emitidas}
            </b>{" "}
            envíos confirmados
          </span>
        </span>
        <ChevronDownIcon className={s.chevron} aria-hidden />
      </summary>
      <div className={s.detailBody}>
        {lote.estado === "esperando_envios" && (
          <p className={s.waiting}>
            Las facturas ya están emitidas. La confirmación de WhatsApp puede
            demorar unos minutos; podés seguir trabajando.
          </p>
        )}
        <Progress
          value={(procesadas / Math.max(1, lote.items.length)) * 100}
          aria-label="Avance de emisión"
          aria-valuetext={`${procesadas} de ${lote.items.length} facturas procesadas`}
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
      </div>
    </details>
  );
}
