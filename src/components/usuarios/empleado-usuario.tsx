"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEmpleados } from "@/lib/empleados-api";
import {
  editarUsuario,
  getUsuarios,
  type UsuarioDelTenant,
} from "@/lib/usuarios-api";

export function EmpleadoUsuario({
  usuario,
  onCerrar,
  onGuardado,
}: {
  usuario: UsuarioDelTenant;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [empleadoId, setEmpleadoId] = useState(usuario.empleado?.id ?? "");
  const [opciones, setOpciones] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">(
    "cargando",
  );
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void Promise.all([getEmpleados(), getUsuarios()])
      .then(([empleados, usuarios]) => {
        if (!vigente) return;
        const ocupados = new Set(
          usuarios.usuarios
            .filter((u) => u.id !== usuario.id && u.empleado)
            .map((u) => u.empleado!.id),
        );
        const disponibles = empleados.filter((e) => !ocupados.has(e.id));
        const items = disponibles.map((e) => ({
          value: e.id,
          label: e.nombreCompleto,
        }));
        // El legajo actual puede estar de baja: se puede conservar o desvincular.
        if (
          usuario.empleado &&
          !items.some((e) => e.value === usuario.empleado!.id)
        ) {
          items.unshift({
            value: usuario.empleado.id,
            label: `${usuario.empleado.nombreCompleto} (vínculo actual)`,
          });
        }
        setOpciones([{ value: "", label: "Sin vincular" }, ...items]);
        setEstado("listo");
      })
      .catch(() => {
        if (vigente) setEstado("error");
      });
    return () => {
      vigente = false;
    };
  }, [usuario, intento]);

  async function guardar() {
    if (
      guardando ||
      estado !== "listo" ||
      empleadoId === (usuario.empleado?.id ?? "")
    )
      return;
    setGuardando(true);
    try {
      await editarUsuario(usuario.id, { empleadoId: empleadoId || null });
      await onGuardado();
      toast.success(
        empleadoId ? "Empleado vinculado." : "Empleado desvinculado.",
      );
      onCerrar();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar el vínculo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !guardando) onCerrar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Empleado vinculado</DialogTitle>
          <DialogDescription>
            {usuario.nombreCompleto || usuario.email} · Rol: {usuario.rolNombre}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-disabled={guardando || estado !== "listo"}>
            <FieldLabel htmlFor="empleado-vinculado">Empleado</FieldLabel>
            {estado === "cargando" && <p role="status">Cargando empleados…</p>}
            {estado === "error" && (
              <>
                <p role="alert">
                  No se pudieron consultar los empleados disponibles.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEstado("cargando");
                    setIntento((n) => n + 1);
                  }}
                >
                  Reintentar
                </Button>
              </>
            )}
            {estado === "listo" && (
              <Select
                items={opciones}
                value={empleadoId}
                onValueChange={(id) => setEmpleadoId(id ?? "")}
                disabled={guardando}
              >
                <SelectTrigger
                  id="empleado-vinculado"
                  className="w-full"
                  aria-describedby="empleado-vinculado-ayuda"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {opciones.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <FieldDescription id="empleado-vinculado-ayuda">
              Se usará como vendedor en las nuevas OT y presupuestos cuando no
              elijas otro. También sirve para la mesa de trabajo y las
              comisiones. Conservás el rol y los permisos actuales.
            </FieldDescription>
            {estado === "listo" && opciones.length === 1 && (
              <FieldDescription>
                No hay empleados disponibles. Podés crear tu legajo en Registros
                → Empleados. Los legajos vinculados a otra cuenta deben
                desvincularse primero.
              </FieldDescription>
            )}
            <FieldDescription>
              Las ventas anteriores conservan su vendedor.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={
              guardando ||
              estado !== "listo" ||
              empleadoId === (usuario.empleado?.id ?? "")
            }
            onClick={() => void guardar()}
          >
            {guardando ? "Guardando…" : "Guardar vínculo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
