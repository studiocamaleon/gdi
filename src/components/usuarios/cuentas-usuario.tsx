"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getCuentasAsignables,
  guardarCuentasUsuario,
  type UsuarioDelTenant,
  type CuentaAsignable,
} from "@/lib/usuarios-api";
import styles from "./cuentas-usuario.module.css";
export function CuentasUsuario({
  usuario,
  onCerrar,
  onGuardado,
}: {
  usuario: UsuarioDelTenant;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [acceso, setAcceso] = React.useState(
    usuario.accesoCuentas ?? {
      restringidas: false,
      operables: [],
      destinos: [],
    },
  );
  const [cuentas, setCuentas] = React.useState<CuentaAsignable[]>([]);
  const [estado, setEstado] = React.useState<"cargando" | "listo" | "error">(
    "cargando",
  );
  const [guardando, setGuardando] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    void getCuentasAsignables()
      .then((c) => {
        if (vivo) {
          setCuentas(c);
          setEstado("listo");
        }
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    return () => {
      vivo = false;
    };
  }, []);
  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarCuentasUsuario(usuario.id, acceso);
      await onGuardado();
      toast.success("Cuentas y destinos actualizados.");
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !guardando) onCerrar();
      }}
    >
      <DialogContent className={styles.dialogo}>
        <DialogHeader>
          <DialogTitle>Cajas y cuentas de trabajo</DialogTitle>
          <DialogDescription>
            {usuario.nombreCompleto || usuario.email} · El rol sigue definiendo
            qué acciones puede hacer.
          </DialogDescription>
        </DialogHeader>
        <ToggleGroup
          aria-label="Alcance de las cuentas"
          variant="outline"
          value={[acceso.restringidas ? "asignadas" : "todas"]}
          onValueChange={(v) => {
            if (v[0])
              setAcceso((a) => ({ ...a, restringidas: v[0] === "asignadas" }));
          }}
        >
          <ToggleGroupItem value="asignadas">
            Sólo las asignadas
          </ToggleGroupItem>
          <ToggleGroupItem value="todas">Todas las cuentas</ToggleGroupItem>
        </ToggleGroup>
        {acceso.restringidas && (
          <div className={styles.listas}>
            {estado === "cargando" && <p role="status">Cargando cuentas…</p>}
            {estado === "error" && (
              <p role="alert">
                No se pudieron consultar las cuentas. Cerrá y volvé a intentar.
              </p>
            )}
            {estado === "listo" && (
              <>
                {(["operables", "destinos"] as const).map((tipo) => (
                  <FieldSet key={tipo}>
                    <FieldLegend>
                      {tipo === "operables"
                        ? "Cuentas que puede operar"
                        : "Destinos de transferencia"}
                    </FieldLegend>
                    <FieldDescription>
                      {tipo === "operables"
                        ? "Puede ver saldo y movimientos. Los permisos del rol habilitan arqueos y transferencias."
                        : "Sólo verá el nombre y la moneda del destino. No podrá consultar su saldo ni retirar dinero."}
                    </FieldDescription>
                    {!cuentas.length && (
                      <p>No hay cuentas activas para asignar.</p>
                    )}
                    {cuentas.map((c) => (
                      <Field orientation="horizontal" key={c.id}>
                        <Checkbox
                          aria-label={`${c.nombre} · ${c.moneda}`}
                          id={`${tipo}-${c.id}`}
                          checked={acceso[tipo].includes(c.id)}
                          onCheckedChange={(activo) =>
                            setAcceso((a) => ({
                              ...a,
                              [tipo]: activo
                                ? [...a[tipo], c.id]
                                : a[tipo].filter((id) => id !== c.id),
                            }))
                          }
                        />
                        <FieldLabel htmlFor={`${tipo}-${c.id}`}>
                          {c.nombre} · {c.moneda}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldSet>
                ))}
                <p className={styles.aclaracion}>
                  Una lista vacía significa que no tiene cuentas autorizadas.
                  Los cobros y pagos también respetan las cuentas asignadas.
                </p>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={guardando || estado !== "listo"}
            onClick={() => void guardar()}
          >
            {guardando ? "Guardando…" : "Guardar acceso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
