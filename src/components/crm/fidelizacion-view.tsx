"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AwardIcon,
  CoinsIcon,
  GiftIcon,
  HistoryIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "lucide-react";
import {
  actualizarFidelizacion,
  type FidelizacionResumen,
} from "@/lib/fidelizacion-api";
import { Button } from "@/components/ui/button";
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

import styles from "./fidelizacion-view.module.css";

const fmt = (n: number) => new Intl.NumberFormat("es-AR").format(n);
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);

const etiquetaMovimiento = (tipo: string) =>
  tipo
    .replaceAll("_", " ")
    .toLocaleLowerCase("es-AR")
    .replace(/^./, (letra) => letra.toLocaleUpperCase("es-AR"));

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
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <div className={styles.tituloGrupo}>
          <span className={styles.iconoModulo} aria-hidden="true">
            <AwardIcon />
          </span>
          <div>
            <span className={styles.eyebrow}>Relaciones que vuelven</span>
            <div className={styles.tituloLinea}>
              <h1>Fidelización</h1>
              <span
                className={styles.estadoPrograma}
                data-activa={config.acumulacionActiva}
              >
                <i aria-hidden="true" />
              {config.acumulacionActiva ? "Acumulando" : "Acumulación pausada"}
              </span>
            </div>
            <p>
              Convertí una parte del margen real en puntos auditables para tus
              clientes.
            </p>
          </div>
        </div>
        {puedeConfigurar ? (
          <Button
            className={styles.guardar}
            onClick={guardar}
            disabled={saving}
          >
            <SaveIcon data-icon="inline-start" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        ) : null}
      </header>
      <section className={styles.kpis} aria-label="Indicadores de fidelización">
        <Kpi
          title="Puntos vigentes"
          value={fmt(m.saldoPuntos)}
          description={`${fmt(m.reservadosPuntos)} reservados`}
          Icon={CoinsIcon}
          principal
        />
        <Kpi
          title="Equivalente pendiente"
          value={money(m.equivalenteMonetario)}
          description="Bonificaciones comprometidas"
          Icon={GiftIcon}
        />
        <Kpi
          title="Puntos emitidos"
          value={fmt(m.emitidos)}
          description="Mes actual"
          Icon={TrendingUpIcon}
        />
        <Kpi
          title="Puntos canjeados"
          value={fmt(m.canjeados)}
          description={`Mes actual · ${fmt(m.clientes)} clientes con cuenta`}
          Icon={UsersRoundIcon}
        />
      </section>

      <section className={styles.reglas}>
        <header className={styles.reglasIntro}>
          <span className={styles.reglasIcono} aria-hidden="true">
            <SlidersHorizontalIcon />
          </span>
          <span className={styles.reglasKicker}>Reglas del programa</span>
          <h2>Una recompensa respaldada por margen real.</h2>
          <p>
            La equivalencia queda bloqueada después del primer movimiento.
            Pausar sólo detiene nuevas ganancias; los saldos existentes siguen
            siendo canjeables.
          </p>
          <div className={styles.reglaResumen}>
            <div>
              <span>Acumulación</span>
              <strong>{config.porcentajeMargen}% del margen</strong>
            </div>
            <div>
              <span>Equivalencia</span>
              <strong>
                {fmt(config.puntosBase)} pts = {money(config.montoBase)}
              </strong>
            </div>
          </div>
        </header>

        <div className={styles.reglasFormulario}>
          <div className={styles.formularioTitulo}>
            <div>
              <span>Configuración</span>
              <h2>Economía de puntos</h2>
            </div>
            {config.conversionBloqueada ? (
              <span className={styles.bloqueada}>Equivalencia protegida</span>
            ) : null}
          </div>
          <FieldGroup className={styles.campos}>
            <Field orientation="horizontal" className={styles.campoSwitch}>
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
            <Field className={styles.campo}>
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
            <Field className={styles.campo}>
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
            <Field className={styles.campo}>
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
        </div>
      </section>

      <section className={styles.movimientos}>
        <header className={styles.movimientosHeader}>
          <span className={styles.movimientosIcono} aria-hidden="true">
            <HistoryIcon />
          </span>
          <div>
            <h2>Movimientos recientes</h2>
            <p>
            Libro mayor de ganancias, canjes, ajustes y reversiones.
            </p>
          </div>
          <span className={styles.movimientosCantidad}>
            {initial.recientes.length} registros
          </span>
        </header>
        <div className={styles.tablaWrap}>
          <Table className={styles.tabla}>
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
                      <span className={styles.tipoMovimiento}>
                        {etiquetaMovimiento(mov.tipo)}
                      </span>
                    </TableCell>
                    <TableCell
                      className={styles.puntosMovimiento}
                      data-positivo={mov.deltaPuntos > 0}
                    >
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
        </div>
      </section>
    </main>
  );
}

function Kpi({
  title,
  value,
  description,
  Icon,
  principal = false,
}: {
  title: string;
  value: string;
  description: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  principal?: boolean;
}) {
  return (
    <article className={`${styles.kpi} ${principal ? styles.kpiPrincipal : ""}`}>
      <span className={styles.kpiIcono} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.kpiTexto}>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}
