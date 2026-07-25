"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  crearRol,
  editarRol,
  type CatalogoPermisos,
  type RolDelTenant,
} from "@/lib/usuarios-api";

/** Lo que se guarda por módulo. `ver` implica leer; `gestionar` arrastra `ver`. */
type Nivel = "ninguno" | "ver" | "gestionar";

/**
 * El editor de un rol: una matriz de módulos por nivel de acceso.
 *
 * Tres opciones por módulo y no cuatro casillas de CRUD. La matriz completa
 * (ver/crear/editar/eliminar × 8 módulos) da 32 tildes que nadie termina de
 * leer, y en una imprenta de seis personas no existe "puede crear clientes pero
 * no editarlos". Ver docs/usuarios-roles-permisos-diseno.md
 */
export function RolEditor({
  rol,
  catalogo,
  onCerrar,
  onGuardado,
}: {
  /** null = rol nuevo. Con `esDelSistema` sólo se editan los permisos. */
  rol: RolDelTenant | null;
  catalogo: CatalogoPermisos;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [nombre, setNombre] = React.useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(rol?.descripcion ?? "");
  const [niveles, setNiveles] = React.useState<Record<string, Nivel>>(() =>
    nivelesDesde(rol?.permisos ?? [], catalogo),
  );
  const [transversales, setTransversales] = React.useState<Set<string>>(
    () => new Set((rol?.permisos ?? []).filter((p) => p.includes("."))
      .filter((p) => catalogo.transversales.some((t) => t.clave === p))),
  );
  const [guardando, setGuardando] = React.useState(false);

  const esNuevo = rol === null;
  const bloqueadoElNombre = rol?.esDelSistema ?? false;

  const guardar = async () => {
    const permisos = [
      ...Object.entries(niveles).flatMap(([modulo, nivel]) =>
        nivel === "ninguno" ? [] : [`${modulo}.${nivel}`],
      ),
      ...transversales,
    ];
    if (permisos.length === 0) {
      toast.error("Un rol sin permisos no le sirve a nadie.");
      return;
    }
    setGuardando(true);
    try {
      if (esNuevo) {
        await crearRol({
          nombre,
          descripcion: descripcion.trim() || undefined,
          permisos,
        });
        toast.success(`Rol "${nombre}" creado.`);
      } else {
        await editarRol(rol.id, {
          ...(bloqueadoElNombre ? {} : { nombre }),
          descripcion: descripcion.trim(),
          permisos,
        });
        toast.success("Rol actualizado. Sus usuarios lo sienten en el acto.");
      }
      await onGuardado();
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el rol.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="usr-form">
      <div className="int-section-intro">
        <h3>
          {esNuevo
            ? "Rol nuevo"
            : rol.esDelSistema
              ? `${rol.nombre} · de fábrica`
              : `Editar ${rol.nombre}`}
        </h3>
        <p>
          {rol?.esDelSistema
            ? "Podés ajustarle los permisos. El nombre no se cambia: es la referencia común de todas las imprentas."
            : "Elegí qué puede ver y qué puede tocar en cada módulo."}
        </p>
      </div>

      <div className="usr-form-grid" style={{ marginBottom: 16 }}>
        <label className="usr-campo">
          <span>Nombre del rol</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={bloqueadoElNombre}
            placeholder="Encargado de depósito"
            autoFocus={esNuevo}
          />
        </label>
        <label className="usr-campo">
          <span>Para qué es</span>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional, pero ayuda a elegirlo"
          />
        </label>
      </div>

      <div className="usr-matriz">
        {catalogo.modulos.map((m) => (
          <div
            className={`usr-mod${m.enElPlan ? "" : " fuera"}`}
            key={m.clave}
          >
            <div className="usr-mod-txt">
              <div className="usr-mod-nm">
                {m.label}
                {!m.enElPlan && (
                  <span
                    className="int-pill"
                    title="Tu plan no incluye este módulo. Podés dejarlo configurado: cuando lo actives, el rol ya está listo."
                  >
                    NO INCLUIDO EN TU PLAN
                  </span>
                )}
              </div>
              <div className="usr-mod-desc">{m.descripcion}</div>
            </div>
            <div className="usr-niveles">
              {(["ninguno", "ver", "gestionar"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`usr-nivel${niveles[m.clave] === n ? " on" : ""}`}
                  onClick={() =>
                    setNiveles((prev) => ({ ...prev, [m.clave]: n }))
                  }
                >
                  {n === "ninguno" ? "Sin acceso" : n === "ver" ? "Ver" : "Editar"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="int-section-intro" style={{ marginTop: 20 }}>
        <h3>Aparte de los módulos</h3>
        <p>
          Estos no pertenecen a una sola pantalla: se aplican en todas donde
          aparece el dato.
        </p>
      </div>
      <div className="usr-matriz">
        {catalogo.transversales.map((t) => (
          <div className="usr-mod" key={t.clave}>
            <div className="usr-mod-txt">
              <div className="usr-mod-nm">{t.label}</div>
              <div className="usr-mod-desc">{t.descripcion}</div>
            </div>
            <div className="usr-niveles">
              <button
                type="button"
                className={`usr-nivel${transversales.has(t.clave) ? "" : " on"}`}
                onClick={() =>
                  setTransversales((prev) => {
                    const n = new Set(prev);
                    n.delete(t.clave);
                    return n;
                  })
                }
              >
                No
              </button>
              <button
                type="button"
                className={`usr-nivel${transversales.has(t.clave) ? " on" : ""}`}
                onClick={() =>
                  setTransversales((prev) => new Set(prev).add(t.clave))
                }
              >
                Sí
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="usr-form-acciones">
        <button className="btn ghost" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </button>
        <button
          className="btn primary"
          onClick={() => void guardar()}
          disabled={guardando}
        >
          {guardando ? "Guardando…" : esNuevo ? "Crear rol" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

/**
 * Los permisos guardados, leídos como niveles. Un `gestionar` gana sobre su
 * `ver` —el backend guarda uno solo, pero un rol viejo podría traer los dos—.
 */
function nivelesDesde(
  permisos: string[],
  catalogo: CatalogoPermisos,
): Record<string, Nivel> {
  const out: Record<string, Nivel> = {};
  for (const m of catalogo.modulos) {
    out[m.clave] = permisos.includes(`${m.clave}.gestionar`)
      ? "gestionar"
      : permisos.includes(`${m.clave}.ver`)
        ? "ver"
        : "ninguno";
  }
  return out;
}
