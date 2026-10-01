"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  crearRol,
  editarRol,
  type CatalogoPermisos,
  type RolDelTenant,
} from "@/lib/usuarios-api";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon } from "lucide-react";
import {
  nivelesDesde,
  permisosDesdeNiveles,
  vistasDelModulo,
  type NivelAcceso as Nivel,
} from "@/lib/roles-vistas";
import styles from "./rol-editor.module.css";
import { expandirVistas } from "@/lib/permisos-vistas";

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
    () =>
      new Set(
        [...expandirVistas(rol?.permisos ?? [])]
          .filter((p) => p.includes("."))
          .filter((p) => catalogo.transversales.some((t) => t.clave === p)),
      ),
  );
  const [guardando, setGuardando] = React.useState(false);

  const esNuevo = rol === null;
  const bloqueadoElNombre = rol?.esDelSistema ?? false;

  const guardar = async () => {
    const permisos = permisosDesdeNiveles(niveles, transversales);
    if (permisos.length <= 1) {
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
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar el rol.",
      );
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

      <div className={styles.secciones}>
        {catalogo.modulos.map((m) => {
          const vistas = vistasDelModulo(m);
          const permitidas = vistas.filter(
            (v) => niveles[v.clave] !== "ninguno",
          ).length;
          const comunes = new Set(vistas.map((v) => niveles[v.clave]));
          const nivel = comunes.size === 1 ? [...comunes][0] : undefined;
          return (
            <Collapsible key={m.clave} className={styles.seccion}>
              <div className={styles.cabecera}>
                <CollapsibleTrigger className={styles.desplegar}>
                  <ChevronDownIcon aria-hidden />
                  <span>
                    <strong>{m.label}</strong>
                    <small>
                      {permitidas} de {vistas.length} vistas habilitadas
                      {nivel === undefined ? " · Personalizado" : ""}
                    </small>
                  </span>
                </CollapsibleTrigger>
                {!m.enElPlan && <Badge variant="outline">Fuera del plan</Badge>}
                <SelectorNivel
                  label={`Toda la sección ${m.label}`}
                  valor={nivel}
                  gestion={vistas.some((v) => v.permiteGestion)}
                  onChange={(n) =>
                    setNiveles((prev) => ({
                      ...prev,
                      ...Object.fromEntries(
                        vistas.map((v) => [
                          v.clave,
                          n === "gestionar" && !v.permiteGestion ? "ver" : n,
                        ]),
                      ),
                    }))
                  }
                />
              </div>
              <CollapsibleContent>
                <div className={styles.vistas}>
                  {vistas.map((v) => (
                    <div className={styles.fila} key={v.clave}>
                      <span>{v.label}</span>
                      <SelectorNivel
                        label={v.label}
                        valor={niveles[v.clave]}
                        gestion={v.permiteGestion}
                        onChange={(n) =>
                          setNiveles((prev) => ({ ...prev, [v.clave]: n }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
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

function SelectorNivel({
  label,
  valor,
  gestion,
  onChange,
}: {
  label: string;
  valor?: Nivel;
  gestion: boolean;
  onChange: (n: Nivel) => void;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      aria-label={label}
      value={valor ? [valor] : []}
      onValueChange={(v) => {
        if (v[0]) onChange(v[0] as Nivel);
      }}
    >
      <ToggleGroupItem value="ninguno">Sin acceso</ToggleGroupItem>
      <ToggleGroupItem value="ver">Ver</ToggleGroupItem>
      {gestion && (
        <ToggleGroupItem value="gestionar">Gestionar</ToggleGroupItem>
      )}
    </ToggleGroup>
  );
}
