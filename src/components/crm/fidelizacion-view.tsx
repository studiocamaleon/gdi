"use client";

import * as React from "react";
import { toast } from "sonner";
import { CoinsIcon, SaveIcon } from "lucide-react";
import {
  actualizarFidelizacion,
  type FidelizacionResumen,
} from "@/lib/fidelizacion-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fmt = (n: number) => new Intl.NumberFormat("es-AR").format(n);
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);

export function FidelizacionView({
  initial,
  puedeConfigurar,
}: {
  initial: FidelizacionResumen;
  puedeConfigurar: boolean;
}) {
  const [config, setConfig] = React.useState(initial.config);
  const [saving, startSaving] = React.useTransition();
  const guardar = () =>
    startSaving(async () => {
      try {
        // La respuesta también contiene metadatos de sólo lectura. El PATCH
        // envía exclusivamente los campos editables aceptados por el DTO.
        const next = await actualizarFidelizacion({
          acumulacionActiva: config.acumulacionActiva,
          porcentajeMargen: config.porcentajeMargen,
          montoBase: config.montoBase,
          puntosBase: config.puntosBase,
        });
        setConfig(next);
        toast.success("Configuración de fidelización guardada.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar.",
        );
      }
    });
  const m = initial.metricas;
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 self-start flex-col gap-6 p-4 pb-20 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CoinsIcon />
            <h1 className="text-2xl font-semibold">Fidelización</h1>
            <Badge variant={config.acumulacionActiva ? "default" : "secondary"}>
              {config.acumulacionActiva ? "Acumulando" : "Acumulación pausada"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Convertí una parte del margen real en puntos auditables para tus
            clientes.
          </p>
        </div>
        {puedeConfigurar ? (
          <Button onClick={guardar} disabled={saving}>
            <SaveIcon data-icon="inline-start" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        ) : null}
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Puntos vigentes"
          value={fmt(m.saldoPuntos)}
          description={`${fmt(m.reservadosPuntos)} reservados`}
        />
        <Kpi
          title="Equivalente pendiente"
          value={money(m.equivalenteMonetario)}
          description="Bonificaciones comprometidas"
        />
        <Kpi
          title="Puntos emitidos"
          value={fmt(m.emitidos)}
          description="Mes actual"
        />
        <Kpi
          title="Puntos canjeados"
          value={fmt(m.canjeados)}
          description={`Mes actual · ${fmt(m.clientes)} clientes con cuenta`}
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Reglas del programa</CardTitle>
          <CardDescription>
            La equivalencia queda bloqueada después del primer movimiento.
            Pausar sólo detiene nuevas ganancias; los saldos existentes siguen
            siendo canjeables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid md:grid-cols-2 xl:grid-cols-4">
            <Field orientation="horizontal">
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="fidelizacion-activa">
                  Acumular puntos
                </FieldLabel>
                <FieldDescription>Activa nuevas ganancias.</FieldDescription>
              </div>
              <Switch
                id="fidelizacion-activa"
                checked={config.acumulacionActiva}
                disabled={!puedeConfigurar}
                onCheckedChange={(v) =>
                  setConfig({ ...config, acumulacionActiva: v })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fidelizacion-pct">% del margen</FieldLabel>
              <Input
                id="fidelizacion-pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                disabled={!puedeConfigurar}
                value={config.porcentajeMargen}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    porcentajeMargen: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fidelizacion-monto">
                Monto de referencia
              </FieldLabel>
              <Input
                id="fidelizacion-monto"
                type="number"
                min="0.01"
                disabled={!puedeConfigurar || config.conversionBloqueada}
                value={config.montoBase}
                onChange={(e) =>
                  setConfig({ ...config, montoBase: Number(e.target.value) })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fidelizacion-puntos">
                Puntos equivalentes
              </FieldLabel>
              <Input
                id="fidelizacion-puntos"
                type="number"
                min="1"
                disabled={!puedeConfigurar || config.conversionBloqueada}
                value={config.puntosBase}
                onChange={(e) =>
                  setConfig({ ...config, puntosBase: Number(e.target.value) })
                }
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>
            Libro mayor de ganancias, canjes, ajustes y reversiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.recientes.length ? (
                initial.recientes.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      {new Date(mov.createdAt).toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>{mov.cliente?.nombre ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {mov.tipo.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {mov.deltaPuntos > 0 ? "+" : ""}
                      {fmt(mov.deltaPuntos)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Todavía no hay movimientos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function Kpi({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
