"use client";
import { useState } from "react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  numeroMedida,
  mapaCopiasCad,
  type CopiasPaginaCad,
  type paginasCad,
  type PerfilCadCopiado,
} from "@/lib/centro-copiado-cad";
import s from "./centro-copiado-sheet.module.css";

export function DetallePaginasCad({
  id,
  nombre,
  paginas,
  perfil,
  copias,
  copiasPorPagina,
  onCopiasPagina,
  onUnificar,
}: {
  id: string;
  nombre: string;
  paginas: ReturnType<typeof paginasCad>;
  perfil?: PerfilCadCopiado;
  copias: number;
  copiasPorPagina?: CopiasPaginaCad[];
  onCopiasPagina: (pagina: number, copias: number) => void;
  onUnificar: () => void;
}) {
  const [bloque, setBloque] = useState(0);
  const porPagina = copiasPorPagina !== undefined;
  const mapa = mapaCopiasCad({ copiasPorPagina });
  const inicio = bloque * 50;
  return (
    <div className={s.detalleCad} id={id}>
      {porPagina && (
        <div className={s.cabeceraDesglose}>
          <div>
            <strong>Copias por página</strong>
            <span>
              Numeración del PDF original · Sólo páginas seleccionadas
            </span>
          </div>
          <ActionButton variant="tertiary" onPress={onUnificar}>
            Usar {copias} {copias === 1 ? "copia" : "copias"} en todas
          </ActionButton>
        </div>
      )}
      <p>
        <strong>{perfil?.impresoraNombre ?? "Planos CAD"}</strong> · Tamaño real
        100% · Simple faz. Calidad según preferencias de Windows.
      </p>
      <div className={s.medidasScroll}>
        <table aria-label={`Páginas CAD de ${nombre}`}>
          <thead>
            <tr>
              <th>Página</th>
              <th>Original</th>
              <th>Copias</th>
              <th>Giro</th>
              <th>Salida en rollo</th>
              <th>Validación</th>
            </tr>
          </thead>
          <tbody>
            {paginas.slice(inicio, inicio + 50).map((p) => (
              <tr key={p.pagina}>
                <td>{p.pagina}</td>
                <td>
                  {numeroMedida(p.anchoMm)} × {numeroMedida(p.altoMm)} mm
                </td>
                <td>
                  {porPagina ? (
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      className={`${s.inputMini} ${s.copiasPagina}`}
                      aria-label={`Copias de la página ${p.pagina} de ${nombre}`}
                      value={mapa.get(p.pagina) ?? copias}
                      onChange={(e) =>
                        onCopiasPagina(
                          p.pagina,
                          Math.min(
                            10000,
                            Math.max(
                              1,
                              Math.trunc(Number(e.target.value)) || 1,
                            ),
                          ),
                        )
                      }
                    />
                  ) : (
                    copias
                  )}
                </td>
                <td>{p.plan ? `${p.plan.giro}°` : "—"}</td>
                <td>
                  {p.plan
                    ? `${numeroMedida(p.plan.anchoSalidaMm)} × ${numeroMedida(p.plan.largoSalidaMm)} mm`
                    : "—"}
                </td>
                <td className={p.error ? s.rangoError : undefined}>
                  {p.error ?? (p.plan ? "Entra al 100%" : "Elegí un perfil")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginas.length > 50 && (
        <div className={s.paginacionCad}>
          <span>
            {inicio + 1}–{Math.min(inicio + 50, paginas.length)} de{" "}
            {paginas.length} páginas seleccionadas
          </span>
          <ActionButton
            variant="tertiary"
            isDisabled={bloque === 0}
            onPress={() => setBloque(bloque - 1)}
          >
            Anterior
          </ActionButton>
          <ActionButton
            variant="tertiary"
            isDisabled={inicio + 50 >= paginas.length}
            onPress={() => setBloque(bloque + 1)}
          >
            Siguiente
          </ActionButton>
        </div>
      )}
      <p>
        La salida incluye los márgenes del rollo. El envío de planos desde la OT
        se habilitará en la siguiente etapa.
      </p>
    </div>
  );
}
