"use client";

/**
 * Gastos fijos de estructura — ABM. Es la fuente ÚNICA del pool de costos
 * fijos del punto de equilibrio del Panel general. Independiente de los
 * centros de costo (que arman tarifas). Ver docs/gastos-fijos-estructura-diseno.md
 */

import * as React from "react";
import { toast } from "sonner";
import { Plus, Download, Pencil, Trash2, Power } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CATEGORIAS_GASTO_FIJO,
  createGastoFijo,
  eliminarGastoFijo,
  getGastosFijos,
  importarGastosDesdeTarifas,
  toggleGastoFijo,
  updateGastoFijo,
  type CategoriaGastoFijo,
  type GastoFijo,
} from "@/lib/gastos-fijos-api";

const fmtAR = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_GASTO_FIJO.map((c) => [c.value, c.label]),
);
function mesActual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}
function vigenteEn(g: GastoFijo, mes: string): boolean {
  return g.activo && g.vigenteDesde <= mes && (g.vigenteHasta === null || mes <= g.vigenteHasta);
}

type FormState = {
  id: string | null;
  nombre: string;
  categoria: CategoriaGastoFijo;
  importeMensual: string;
  vigenteDesde: string;
  vigenteHasta: string;
  notas: string;
};

const FORM_VACIO: FormState = {
  id: null,
  nombre: "",
  categoria: "SUELDOS",
  importeMensual: "",
  vigenteDesde: mesActual(),
  vigenteHasta: "",
  notas: "",
};

export function GastosFijosPanel({ initialGastos }: { initialGastos: GastoFijo[] }) {
  const [gastos, setGastos] = React.useState<GastoFijo[]>(initialGastos);
  const [form, setForm] = React.useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = React.useState(false);
  const [importando, setImportando] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<GastoFijo | null>(null);

  const mes = mesActual();
  const totalVigente = gastos.filter((g) => vigenteEn(g, mes)).reduce((a, g) => a + g.importeMensual, 0);
  const editando = form.id !== null;

  const recargar = React.useCallback(async () => {
    try {
      setGastos(await getGastosFijos());
    } catch {
      toast.error("No se pudo actualizar la lista.");
    }
  }, []);

  function editar(g: GastoFijo) {
    setForm({
      id: g.id,
      nombre: g.nombre,
      categoria: g.categoria,
      importeMensual: String(g.importeMensual),
      vigenteDesde: g.vigenteDesde,
      vigenteHasta: g.vigenteHasta ?? "",
      notas: g.notas ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const importe = Number(form.importeMensual);
    if (!form.nombre.trim()) return toast.error("Poné un nombre al gasto.");
    if (!Number.isFinite(importe) || importe < 0) return toast.error("El importe mensual no es válido.");
    if (!/^\d{4}-\d{2}$/.test(form.vigenteDesde)) return toast.error("Indicá el mes de inicio de vigencia.");
    if (form.vigenteHasta && form.vigenteHasta < form.vigenteDesde)
      return toast.error('La vigencia "hasta" no puede ser anterior a "desde".');

    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      importeMensual: importe,
      vigenteDesde: form.vigenteDesde,
      vigenteHasta: form.vigenteHasta || null,
      notas: form.notas.trim() || null,
    };

    setGuardando(true);
    try {
      if (form.id) {
        await updateGastoFijo(form.id, payload);
        toast.success("Gasto fijo actualizado.");
      } else {
        await createGastoFijo(payload);
        toast.success("Gasto fijo agregado.");
      }
      setForm(FORM_VACIO);
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(g: GastoFijo) {
    try {
      await toggleGastoFijo(g.id);
      await recargar();
    } catch {
      toast.error("No se pudo cambiar el estado.");
    }
  }

  async function importar() {
    setImportando(true);
    try {
      const r = await importarGastosDesdeTarifas();
      if (r.motivo === "ya_existen_gastos") {
        toast.info("Ya tenés gastos cargados; la importación no pisa nada.");
      } else if (r.motivo === "sin_datos" || r.importados === 0) {
        toast.info("No hay tarifas publicadas de dónde importar.");
      } else {
        toast.success(`Importados ${r.importados} gastos ($${fmtAR(r.total)}/mes).`);
        await recargar();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="module-page" style={{ display: "flex", flexDirection: "column", gap: 20, padding: "24px 28px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Gastos fijos de estructura</h1>
          <p style={{ color: "var(--muted-text, #6e6e76)", margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, maxWidth: 640 }}>
            La estructura mensual que tu facturación debe cubrir. Es la base del{" "}
            <strong>punto de equilibrio</strong> del Panel general. Es independiente de los centros
            de costo (que sirven para las tarifas): podés tener sueldos en ambos lados sin doble conteo.
          </p>
        </div>
        <div style={{ textAlign: "right", minWidth: 200 }}>
          <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-text, #6e6e76)" }}>
            Total fijo vigente ({mes})
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${fmtAR(totalVigente)}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted-text, #6e6e76)" }}>por mes</div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{editando ? "Editar gasto fijo" : "Agregar gasto fijo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <Field>
                <FieldLabel htmlFor="gf-nombre">Nombre</FieldLabel>
                <Input id="gf-nombre" value={form.nombre} placeholder="Ej: Alquiler del local"
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gf-categoria">Categoría</FieldLabel>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as CategoriaGastoFijo }))}>
                  <SelectTrigger id="gf-categoria"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_GASTO_FIJO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="gf-importe">Importe mensual</FieldLabel>
                <Input id="gf-importe" type="number" min={0} step="0.01" value={form.importeMensual} placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, importeMensual: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gf-desde">Vigente desde</FieldLabel>
                <Input id="gf-desde" type="month" value={form.vigenteDesde}
                  onChange={(e) => setForm((f) => ({ ...f, vigenteDesde: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gf-hasta">Vigente hasta (opcional)</FieldLabel>
                <Input id="gf-hasta" type="month" value={form.vigenteHasta}
                  onChange={(e) => setForm((f) => ({ ...f, vigenteHasta: e.target.value }))} />
              </Field>
            </FieldGroup>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Button type="submit" disabled={guardando}>
                <Plus size={15} /> {editando ? "Guardar cambios" : "Agregar gasto"}
              </Button>
              {editando ? (
                <Button type="button" variant="ghost" onClick={() => setForm(FORM_VACIO)} disabled={guardando}>Cancelar</Button>
              ) : null}
              <div style={{ flex: 1 }} />
              {gastos.length === 0 ? (
                <Button type="button" variant="outline" onClick={importar} disabled={importando}>
                  <Download size={15} /> Importar desde tarifas
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos fijos cargados</CardTitle>
        </CardHeader>
        <CardContent>
          {gastos.length === 0 ? (
            <div style={{ padding: "32px 8px", textAlign: "center", color: "var(--muted-text, #6e6e76)", fontSize: 13.5 }}>
              Todavía no cargaste gastos fijos. Agregá uno arriba, o importá tu estructura actual desde las tarifas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Importe mensual</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastos.map((g) => {
                  const vig = vigenteEn(g, mes);
                  return (
                    <TableRow key={g.id} style={{ opacity: g.activo ? 1 : 0.55 }}>
                      <TableCell style={{ fontWeight: 500 }}>{g.nombre}</TableCell>
                      <TableCell>{CAT_LABEL[g.categoria] ?? g.categoria}</TableCell>
                      <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>${fmtAR(g.importeMensual)}</TableCell>
                      <TableCell style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                        {g.vigenteDesde} → {g.vigenteHasta ?? "∞"}
                      </TableCell>
                      <TableCell>
                        {!g.activo ? <Badge variant="outline">Inactivo</Badge>
                          : vig ? <Badge>Vigente</Badge>
                          : <Badge variant="secondary">Fuera de vigencia</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <Button type="button" variant="ghost" size="icon" onClick={() => editar(g)} title="Editar"><Pencil size={15} /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => alternar(g)} title={g.activo ? "Desactivar" : "Activar"}><Power size={15} /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setAEliminar(g)} title="Eliminar"><Trash2 size={15} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(o) => { if (!o) setAEliminar(null); }}
        titulo="Eliminar gasto fijo"
        descripcion={<>Se quita <strong>{aEliminar?.nombre}</strong> del cálculo del punto de equilibrio.</>}
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={async () => {
          if (!aEliminar) return;
          try {
            await eliminarGastoFijo(aEliminar.id);
            toast.success("Gasto fijo eliminado.");
            setAEliminar(null);
            await recargar();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
          }
        }}
      />
    </div>
  );
}
