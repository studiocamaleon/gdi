"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AwardIcon,
  CoinsIcon,
  GiftIcon,
  HistoryIcon,
  LockKeyholeIcon,
  PauseCircleIcon,
  CircleCheckIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "lucide-react";
import {
  actualizarFidelizacion,
  type FidelizacionResumen,
} from "@/lib/fidelizacion-api";
import {
  Card,
  Chip,
  Description as FieldDescription,
  Input,
  Label as FieldLabel,
  Switch,
} from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ListMetric } from "@/components/design-system/list-metric";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { Field, FieldGroup } from "@/components/ui/field";
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
  const scope = useDesignScope();
  const m = initial.metricas;
  return (
    <section {...scope} className={`${theme.theme} ${listPage.page}`}>
      <div className={styles.contenido}>
        <header className={listPage.header}>
          <div>
            <div className={styles.tituloLinea}>
              <h1>Fidelización</h1>
              <Chip
                size="sm"
                variant={config.acumulacionActiva ? "soft" : "secondary"}
                color={config.acumulacionActiva ? "success" : "default"}
                className={styles.estadoPrograma}
              >
                {config.acumulacionActiva ? (
                  <CircleCheckIcon aria-hidden />
                ) : (
                  <PauseCircleIcon aria-hidden />
                )}
                {config.acumulacionActiva
                  ? "Acumulando"
                  : "Acumulación pausada"}
              </Chip>
            </div>
            <p className={listPage.subtitle}>
              Convertí una parte del margen real en puntos auditables para tus
              clientes.
            </p>
          </div>
          {puedeConfigurar ? (
            <Button onPress={guardar} isDisabled={saving}>
              <SaveIcon size={16} aria-hidden />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          ) : null}
        </header>

        <section
          className={styles.kpis}
          aria-label="Indicadores de fidelización"
        >
          <ListMetric
            label="Puntos vigentes"
            value={fmt(m.saldoPuntos)}
            hint={`${fmt(m.reservadosPuntos)} reservados`}
            icon={CoinsIcon}
            tone="brand"
          />
          <ListMetric
            label="Equivalente pendiente"
            value={money(m.equivalenteMonetario)}
            hint="Bonificaciones comprometidas"
            icon={GiftIcon}
          />
          <ListMetric
            label="Puntos emitidos"
            value={fmt(m.emitidos)}
            hint="Mes actual"
            icon={TrendingUpIcon}
          />
          <ListMetric
            label="Puntos canjeados"
            value={fmt(m.canjeados)}
            hint={`Mes actual · ${fmt(m.clientes)} clientes con cuenta`}
            icon={UsersRoundIcon}
          />
        </section>

        <Card className={styles.reglas} aria-labelledby="fidelizacion-reglas">
          <div className={styles.reglasIntro}>
            <div className={styles.seccionTitulo}>
              <span className={styles.iconoSeccion}>
                <AwardIcon size={18} aria-hidden />
              </span>
              <h2 id="fidelizacion-reglas">Reglas del programa</h2>
            </div>
            <strong className={styles.reglasDestacado}>
              Una recompensa respaldada por margen real.
            </strong>
            <p>
              La equivalencia queda bloqueada después del primer movimiento.
              Pausar sólo detiene nuevas ganancias; los saldos existentes siguen
              siendo canjeables.
            </p>
            <dl className={styles.reglaResumen}>
              <div>
                <dt>
                  <TrendingUpIcon size={15} aria-hidden />
                  Acumulación
                </dt>
                <dd>{config.porcentajeMargen}% del margen</dd>
              </div>
              <div>
                <dt>
                  <CoinsIcon size={15} aria-hidden />
                  Equivalencia
                </dt>
                <dd>
                  {fmt(config.puntosBase)} pts = {money(config.montoBase)}
                </dd>
              </div>
            </dl>
          </div>
          <div className={styles.reglasFormulario}>
            <header className={styles.formularioTitulo}>
              <div className={styles.seccionTitulo}>
                <span className={styles.iconoSeccion}>
                  <SlidersHorizontalIcon size={18} aria-hidden />
                </span>
                <h2>Economía de puntos</h2>
              </div>
              {config.conversionBloqueada ? (
                <Chip
                  size="sm"
                  variant="secondary"
                  className={styles.estadoPrograma}
                >
                  <LockKeyholeIcon aria-hidden />
                  Equivalencia protegida
                </Chip>
              ) : null}
            </header>
            <FieldGroup className={styles.campos}>
              <Switch
                id="fidelizacion-activa"
                className={styles.campoSwitch}
                isSelected={config.acumulacionActiva}
                isDisabled={!puedeConfigurar}
                onChange={(v) => setConfig({ ...config, acumulacionActiva: v })}
              >
                <Switch.Content className={styles.switchContenido}>
                  <div className={styles.switchTexto}>
                    <FieldLabel>Acumular puntos</FieldLabel>
                    <FieldDescription>
                      Activa nuevas ganancias.
                    </FieldDescription>
                  </div>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
              <Field className={styles.campo}>
                <FieldLabel htmlFor="fidelizacion-pct">% del margen</FieldLabel>
                <Input
                  className={focus.singleBorder}
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
                  className={focus.singleBorder}
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
                  className={focus.singleBorder}
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
        </Card>

        <Card
          className={styles.movimientos}
          aria-labelledby="fidelizacion-movimientos"
        >
          <header className={styles.movimientosHeader}>
            <span className={styles.iconoSeccion}>
              <HistoryIcon size={18} aria-hidden />
            </span>
            <div>
              <h2 id="fidelizacion-movimientos">Movimientos recientes</h2>
              <p>Libro mayor de ganancias, canjes, ajustes y reversiones.</p>
            </div>
            <Chip
              size="sm"
              variant="secondary"
              className={styles.movimientosCantidad}
            >
              {initial.recientes.length} registros
            </Chip>
          </header>
          <Table
            className={styles.tabla}
            aria-label="Movimientos recientes de fidelización"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className={styles.numero}>Puntos</TableHead>
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
                        <Chip size="sm" variant="secondary">
                        {etiquetaMovimiento(mov.tipo)}
                      </Chip>
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
                  <TableCell colSpan={4} className={styles.vacio}>
                    Todavía no hay movimientos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </section>
  );
}
