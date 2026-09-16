"use client";

import { useEffect, useMemo, useState } from "react";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Input, TextField } from "@heroui/react";
import { ChevronDown, ChevronUp, History, Search } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import {
  getTerminadosTablero,
  type PaginaTerminadosTablero,
} from "@/lib/ordenes-trabajo-api";
import { buildItemView } from "@/lib/produccion-item-view";
import type { TableroItemData } from "@/lib/tablero-produccion";
import type { Estacion } from "@/lib/estaciones";
import { TableroLista } from "./tablero-lista";
import s from "./tablero-lista.module.css";

export function TableroTerminados({
  estaciones,
  zona,
  revision,
  onItems,
  onOpen,
}: {
  estaciones: Estacion[];
  zona: string;
  revision: number;
  onItems: (items: TableroItemData[]) => void;
  onOpen: (id: string) => void;
}) {
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState({
    page: 1,
    q: "",
    desde: "",
    hasta: "",
  });
  const [respuesta, setRespuesta] = useState<{
    key: string;
    datos?: PaginaTerminadosTablero;
    error?: string;
  } | null>(null);
  const [intento, setIntento] = useState(0);
  const requestKey = JSON.stringify([consulta, revision, intento]);
  const vigenteRespuesta = respuesta?.key === requestKey ? respuesta : null;
  const datos = vigenteRespuesta?.datos;
  const error = vigenteRespuesta?.error;
  const loading = abierto && !vigenteRespuesta;
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    getTerminadosTablero(consulta)
      .then((res) => {
        if (!vigente) return;
        setRespuesta({ key: requestKey, datos: res });
        onItems(res.items);
      })
      .catch((err) => {
        if (vigente)
          setRespuesta({
            key: requestKey,
            error:
              err instanceof Error
                ? err.message
                : "No se pudieron consultar los terminados.",
          });
      });
    return () => {
      vigente = false;
    };
  }, [abierto, consulta, requestKey, onItems]);
  const items = useMemo(
    () => (datos?.items ?? []).map((i) => buildItemView(i, estaciones, zona)),
    [datos, estaciones, zona],
  );
  return (
    <section
      {...scope}
      className={`${designTheme} ${s.history}`}
      aria-label="Consulta de trabajos terminados"
    >
      <div className={s.historyHeader}>
        <div>
          <h2>Trabajos terminados</h2>
          <p>
            Consultá trabajos anteriores por OT, cliente o fecha de entrega.
          </p>
        </div>
        <ActionButton
          variant="outline"
          aria-expanded={abierto}
          aria-controls="tablero-terminados"
          onPress={() => {
            setAbierto(!abierto);
            if (abierto) {
              setRespuesta(null);
              onItems([]);
            }
          }}
        >
          <History size={15} />
          {abierto ? "Ocultar terminados" : "Ver terminados"}
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </ActionButton>
      </div>
      {abierto && (
        <div id="tablero-terminados" className={s.historyBody}>
          <form
            className={s.historyFilters}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setConsulta({
                page: 1,
                q: String(f.get("q") ?? "").trim(),
                desde: String(f.get("desde") ?? ""),
                hasta: String(f.get("hasta") ?? ""),
              });
            }}
          >
            <TextField
              className={s.searchField}
              name="q"
              aria-label="Buscar trabajos terminados"
              defaultValue={consulta.q}
            >
              <span className={s.fieldLabel}>OT, trabajo o cliente</span>
              <Input maxLength={120} placeholder="Buscar en terminados…" />
            </TextField>
            <TextField
              className={s.dateField}
              name="desde"
              aria-label="Entrega desde"
              defaultValue={consulta.desde}
            >
              <span className={s.fieldLabel}>Entrega desde</span>
              <Input type="date" />
            </TextField>
            <TextField
              className={s.dateField}
              name="hasta"
              aria-label="Entrega hasta"
              defaultValue={consulta.hasta}
            >
              <span className={s.fieldLabel}>Entrega hasta</span>
              <Input type="date" />
            </TextField>
            <ActionButton type="submit" variant="outline" isDisabled={loading}>
              <Search size={14} />
              Buscar
            </ActionButton>
          </form>
          {loading ? (
            <div role="status" className={s.notice}>
              <GdiSpinner /> Consultando terminados…
            </div>
          ) : error ? (
            <div role="alert" className={s.notice}>
              {error}{" "}
              <ActionButton
                variant="outline"
                onPress={() => setIntento((n) => n + 1)}
              >
                Reintentar
              </ActionButton>
            </div>
          ) : datos ? (
            <>
              <TableroLista
                terminados
                items={items}
                estaciones={estaciones}
                zona={zona}
                onOpen={onOpen}
              />
              <div className={s.pager}>
                <span>
                  Página {datos.page} · {datos.items.length} trabajos · Órdenes
                  más recientes primero
                </span>
                <div className={s.pagerActions}>
                  <ActionButton
                    variant="outline"
                    isDisabled={datos.page <= 1}
                    onPress={() =>
                      setConsulta((q) => ({ ...q, page: q.page - 1 }))
                    }
                  >
                    Anterior
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    isDisabled={!datos.hasMore}
                    onPress={() =>
                      setConsulta((q) => ({ ...q, page: q.page + 1 }))
                    }
                  >
                    Siguiente
                  </ActionButton>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
