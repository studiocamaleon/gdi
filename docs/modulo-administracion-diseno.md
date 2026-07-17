# Módulo de Administración — diseño técnico

> 2026-07-16 · rama `feat/modulo-pagos`. Fuente: "Grafo — Módulo de
> Administración, Pagos y Flujo de Caja" (investigación julio 2026, PDF del
> usuario) + decisiones de la conversación. Este doc traduce esa
> investigación a modelo de datos, contratos y etapas de implementación.

## 1. Principios (del PDF, innegociables)

1. **Las tres cifras.** Todo cobro distingue: **facturado** (precio del
   comprobante), **neto acreditado** (menos comisión del medio + IVA sobre
   la comisión) y **disponible real** (menos retenciones/percepciones y
   considerando plazo de acreditación). La UI las muestra siempre.
2. **Convivir con el contador, no reemplazarlo.** Grafo gestiona la plata y
   entrega datos limpios (Libro IVA, retenciones, aging). No es un ERP
   contable: sin plan de cuentas, sin asientos, sin balances.
3. **Todo paramétrico por tenant.** Comisiones, alícuotas, plazos y topes
   cambian seguido: son datos configurables, jamás constantes en código.
4. **Delegación de lo fiscal.** Facturación vía `InvoicingProvider`
   (TusFacturasAPP en AR), bancos vía `BankingProvider` (Prometeo/Belvo).
   El dominio emite "comprobantes" abstractos; el provider los materializa.
5. **El puente orden→caja es el diferencial.** Una OT aprobada con seña ya
   es una entrada proyectada del flujo de caja, antes de que exista factura.

## 2. Decisiones de arquitectura (cerradas 2026-07-16)

- **Imputación comprobante-céntrica con anticipos a orden.** El cobro se
  imputa a comprobantes (uno o varios, parcial o total). La **seña** es un
  cobro con `ordenId` y sin imputaciones (anticipo a cuenta); al facturar
  la orden, el anticipo se imputa al comprobante. El tab Pagos de la OT es
  una **vista** de la cta. cte. filtrada por orden (anticipos + cobros
  imputados a comprobantes de esa orden), no un modelo aparte.
- **Comprobante primero, ARCA después.** `Comprobante` nace completo
  (tipo/letra/PV/número/CAE/estado fiscal) detrás de `InvoicingProvider`
  desde el día 1, con provider **`manual`** (registrar comprobantes
  emitidos por fuera) antes de integrar TusFacturasAPP. Cero retrabajo al
  conectar el provider real.
- **`MetodoPago` administrativo separado del catálogo de pricing.** El
  catálogo de comisiones/impuestos del Tab Precio sigue siendo pricing.
  Tesorería tiene su propio catálogo (comisión, IVA s/comisión, plazo,
  retención, cuenta destino). Se cruzan recién en el diferencial
  "neto por plan de cuotas → contribución" (etapa F3).
- **Módulo API propio `administracion`** con submódulos (metodos-pago,
  tesoreria, cobros, comprobantes) y sección **Administración** en el
  sidebar. Las vistas de OT consumen sus endpoints.
- **Denormalizados recalculables** (patrón OT): `CuentaFondos.saldo`,
  `Comprobante.saldoPendiente`, `Cobro.disponibleReal` se mantienen en la
  misma transacción que los muta y siempre pueden recomputarse desde las
  filas fuente.

## 3. Prerrequisitos sobre entidades existentes

Hoy NO existen datos fiscales (verificado en schema):

| Entidad | Campos a agregar |
|---|---|
| `Cliente` | `cuit String?`, `condicionFiscal` ('RI' \| 'monotributo' \| 'exento' \| 'consumidor_final', default consumidor_final), `limiteCredito Decimal?` |
| `Proveedor` | `cuit String?`, `condicionFiscal String?` |
| Tenant (nueva tabla `ConfiguracionFiscal`) | cuit, razonSocial, condicionFiscal, nº IIBB, domicilio fiscal, puntos de venta habilitados, `proveedorFacturacion` ('manual' \| 'tusfacturas'), referencia de credenciales (nunca el secreto en claro; env/secret store) |

**Selección automática de letra** (matriz emisor→receptor). Implementada y
testeada en `apps/api/src/administracion/letra-comprobante.ts`; fuente:
[ARCA, régimen general](https://www.afip.gob.ar/facturacion/regimen-general/comprobantes.asp).

| receptor ↓ / emisor → | RI | Monotributo | Exento |
|---|---|---|---|
| Responsable Inscripto | **A** | C | C |
| Monotributo | **A** | C | C |
| Exento | **B** | C | C |
| Consumidor final | **B** | C | C |
| Exterior (exportación) | **E** | E | E |

> **Corrección (2026-07-16): la clase M ya no existe.** La RG 5762/2025 la
> abrogó desde el 01/12/2025. Quien no acredita solvencia patrimonial emite
> igual una **A con leyenda** ("PAGO EN CBU INFORMADA" u "OPERACIÓN SUJETA A
> RETENCIÓN"), así que la leyenda es un atributo del emisor
> (`ConfiguracionFiscal.leyendaFacturaA`) y no una letra aparte. Ojo que
> varias fuentes secundarias siguen diciendo que RI→Monotributo es B: la
> fuente oficial dice **A**.

Una **A exige CUIT del receptor** (`bloqueoEmision`): sin él ARCA rechaza la
emisión. Con provider TFA, la condición del receptor se valida contra padrón
por CUIT.

## 4. Modelo de datos (Prisma, convenciones del schema actual)

Todas con `tenantId @db.Uuid` + tenant relation cascade + índices por
tenant. Montos `Decimal @db.Decimal(14, 2)`; alícuotas `Decimal(6, 3)`;
moneda `VarChar(3)` default 'ARS'.

### MetodoPago
`codigo` (unique por tenant), `nombre`, `tipo` ('efectivo' | 'transferencia'
| 'qr_interoperable' | 'debito' | 'credito' | 'credito_cuotas' | 'mp_qr' |
'mp_link' | 'cheque' | 'echeq' | 'debin' | 'otro'), `comisionPct`,
`ivaComisionPct` (default 21), `plazoAcreditacionDias Int`,
`sufreRetencion Boolean`, `cuentaDestinoDefaultId?` → CuentaFondos,
`planesCuotasJson?` (etapa F3: [{cuotas, costoFinancieroPct}]), `activo`,
`orden Int`. Seed inicial por tenant con el catálogo del PDF (cap. 4).

### CuentaFondos
`tipo` ('caja' | 'banco'), `nombre`, `banco?`, `cbuAlias?`, `moneda`,
`saldo Decimal` (denormalizado), `datosOpenBankingJson?` (F3), `activo`.

### MovimientoFondos
`cuentaId`, `fecha`, `tipo` ('entrada' | 'salida'), `monto` (positivo),
`concepto`, `origenTipo` ('cobro' | 'pago' | 'transferencia' | 'valor' |
'ajuste_arqueo'), `cobroId?`, `pagoId?`, `valorId?`,
`transferenciaParId?` (movimiento espejo de la otra cuenta), `ordenId?`
(traza a producción), `comprobanteId?`, `estadoConciliacion` ('pendiente'
| 'conciliado' | 'diferencia', default pendiente — se usa en F3),
`saldoPosterior Decimal` (corrido, para el extracto).

### Comprobante
`clase` ('FA' | 'NC' | 'ND'), `letra` ('A'|'B'|'C'|'M'|'E'|'T'),
`puntoVenta Int`, `numero Int?` (null hasta emisión), `fecha`,
`clienteId`, `ordenId?` (origen), `cotizacionId?`, `condicionVenta`
('contado' | 'cta_cte'), `vencimiento?`, `neto`, `iva`,
`otrosImpuestos`, `total`, `moneda`, `tipoCambio Decimal(14,4)`,
`estadoFiscal` ('borrador' | 'pendiente_cae' | 'emitido' | 'rechazado' |
'anulado'), `cae String?`, `caeVencimiento?`, `providerRef Json?`
(respuesta cruda del provider), `comprobanteAsociadoId?` (NC/ND → FA),
`itemsJson` (proyección facturada: descripcion, cantidad, unitario, iva%,
subtotal — desde items de OT o libres), `saldoPendiente` (denormalizado =
total − imputaciones − aplicación de NC), `motivoRechazo?`.
`@@unique([tenantId, letra, puntoVenta, numero])`.

### Cobro
`clienteId`, `fecha`, `metodoPagoId`, `cuentaDestinoId`,
`montoBruto`, `comisionMonto`, `comisionIvaMonto`, `netoAcreditado`
(= bruto − comisión − IVA comisión), `retencionesTotal`,
`disponibleReal` (= neto − retenciones), `fechaAcreditacionEstimada`,
`estadoAcreditacion` ('pendiente' | 'acreditado'), `ordenId?` (anticipo /
traza), `valorId?` (si el medio es cheque/echeq), `moneda`, `tipoCambio`,
`notas?`, `anuladoEl?` + `imputaciones[]`, `retenciones[]`.
**Regla:** `Σ imputaciones.monto ≤ montoBruto`; el resto es "a cuenta".
El movimiento de fondos se genera al registrar (efectivo/transferencia) o
al acreditar el valor (cheques) — ver máquina de estados del Valor.

### CobroImputacion
`cobroId`, `comprobanteId`, `monto`. Actualiza `saldoPendiente` del
comprobante en la misma transacción.

### RetencionPercepcion
`direccion` ('sufrida' | 'practicada'), `cobroId?` / `pagoId?` (XOR),
`regimen` ('SICORE_IVA' | 'SICORE_GANANCIAS' | 'IIBB_RET' | 'IIBB_PERC' |
'SIRCREB' | 'SIRCUPA' | 'SIRTAC' | 'PERCEPCION_IVA' | 'otro'),
`jurisdiccion?` (provincia), `base`, `alicuota`, `monto`,
`nroComprobante?`, `periodoFiscal` ('YYYY-MM'). Reporte de sufridas por
período = query directa sobre esta tabla (insumo contador, cap. 5 PDF).

### Valor (cheque / echeq)
`origen` ('tercero' | 'propio'), `formato` ('fisico' | 'echeq'),
`modalidad` ('comun' | 'diferido'), `numero`, `banco`, `importe`,
`moneda`, `fechaEmision`, `fechaPago?` (diferido), `estado` (ver §5),
`clienteId?` (recibido de), `proveedorId?` (endosado a), `cobroId?`,
`pagoId?`, `cuentaDepositoId?`, `endososJson?`, `motivoRechazo?`.

### Pago + PagoImputacion + ComprobanteCompra  *(Fase 2 — definidas acá, se migran cuando toque)*
Espejo de Cobro/Imputacion/Comprobante para proveedores, con
`retenciones practicadas` (Grafo como agente) y órdenes de pago.

### MovimientoBancario  *(Fase 3 — open banking)*
`cuentaId`, `fecha`, `monto`, `descripcion`, `referencia`,
`movimientoFondosId?` (match), `estadoMatch` ('auto' | 'manual' |
'pendiente' | 'descartado'), `rawJson`.

### Cuenta corriente
**No es tabla**: es la proyección cronológica de Comprobantes (debe),
Cobros/NC (haber) y anticipos por cliente, con saldo corrido computado.
Límite de crédito vive en `Cliente.limiteCredito`.

## 5. Máquinas de estado

**Comprobante.estadoFiscal**
`borrador → pendiente_cae → emitido` · `pendiente_cae → rechazado →
(corregir) → pendiente_cae` · `emitido → anulado` (solo vía NC según
reglas; borrador se puede eliminar). Provider `manual`: `borrador →
emitido` directo (número tipeado, CAE opcional).

**Valor — tercero (recibido):**
`cartera → endosado` (a proveedor, se vuelve medio de un Pago) ·
`cartera → depositado → acreditado` (genera MovimientoFondos entrada +
acredita el Cobro asociado) · `depositado → rechazado` (revierte: el
cobro vuelve a pendiente, el comprobante recupera saldo, la cta. cte. del
cliente se debita de nuevo + evento).

**Valor — propio (emitido):**
`cartera(emitido) → debitado(pagado)` · `→ rechazado`.

**Cobro.estadoAcreditacion:** `pendiente → acreditado` (automático por
fecha estimada en medios electrónicos — job o al consultar; manual/por
valor en cheques). El flujo de caja proyecta con los pendientes.

## 6. Cálculo de las tres cifras (registrar cobro)

```
bruto                = monto ingresado
comision             = bruto × metodo.comisionPct / 100
ivaComision          = comision × metodo.ivaComisionPct / 100
netoAcreditado       = bruto − comision − ivaComision
retencionesTotal     = Σ lineas retención (cada una: base × alícuota / 100,
                       editable — la retención real la define el agente)
disponibleReal       = netoAcreditado − retencionesTotal
fechaAcreditacion    = fecha + metodo.plazoAcreditacionDias (hábiles: v1
                       usa días corridos, mejora posterior)
```
El backend recalcula y valida contra lo enviado (tolerancia $1, patrón
OT). Las líneas de retención son editables porque el % del padrón varía
por contribuyente; el método solo *sugiere* (flag `sufreRetencion`).

## 7. API (módulo `administracion`)

Convenciones existentes: `@CurrentSession()`, tenant en todos los where,
DTOs class-validator, paginación estándar, eventos de auditoría con
usuarioId/datosJson/origen (mismo enfoque que ordenes-trabajo).

**Etapa B**
- `GET/POST/PATCH /administracion/metodos-pago` (+ toggle)
- `GET/POST/PATCH /administracion/cuentas` (+ movimientos paginados)
- `POST /administracion/cuentas/transferencias` (par de movimientos)
- `POST /administracion/cuentas/:id/arqueo` (ajuste con diferencia)
- `POST /administracion/cobros` (con retenciones[], valor?, ordenId?,
  imputaciones[] opcional) · `GET /administracion/cobros` ·
  `POST /administracion/cobros/:id/anular`
- `GET /ordenes-trabajo/:id/pagos` → vista para el tab Pagos de la OT
  (anticipos + cobros imputados a comprobantes de la orden + totales de
  las 3 cifras). Reemplaza el mock `OrdenTrabajoPago`.

**Etapa C**
- `GET/POST/PATCH /administracion/comprobantes` · `POST .../:id/emitir`
  (provider) · `POST .../:id/anular` · items desde OT: el POST acepta
  `ordenId` y arma `itemsJson` desde los items persistidos de la orden.
- `POST /administracion/cobros/:id/imputaciones` (y quitar)
- `GET /administracion/clientes/:id/cuenta-corriente` (cronológico +
  saldo corrido + límite) · `GET /administracion/deudores` (aging)

**Etapa D**
- `ConfiguracionFiscal` del tenant (GET/PUT) ·
  `GET /administracion/padron/:cuit` (via provider) ·
  provider `tusfacturas` implementando `InvoicingProvider`.

**Interfaz `InvoicingProvider`**
```ts
emitir(comprobante): Promise<{ numero, cae, caeVencimiento, raw } | { rechazo }>
consultarPadron(cuit): Promise<{ condicionFiscal, razonSocial } | null>
```

## 8. Integración con lo existente

- **OT tab Pagos**: deja el preview mock; consume `GET /ordenes-trabajo/:id/pagos`.
  "Registrar cobro" del tab crea un Cobro real con `ordenId` (anticipo) o
  imputado si la orden ya tiene comprobante. El cronograma de vencimientos
  (plan de cuotas del preview) queda para una iteración posterior como
  `PlanCobranza` opcional de la orden — no bloquea F1.
- **Eventos de OT**: cobro/anticipo vinculado a orden genera evento
  (`cobro_registrado`, `cobro_anulado`) con datosJson {cobroId, monto,
  metodo} — la taxonomía ya lo prevé.
- **Comprobante ← OT**: `POST /comprobantes` con `ordenId` toma cliente,
  items (proyección persistida), montos y moneda de la orden. La orden
  linkea sus comprobantes en la ficha (tab Pagos).
- **Flujo proyectado (F3)**: entradas = cta. cte. por vencimiento +
  valores a acreditar + **OTs activas con saldo no facturado** (el puente
  orden→caja). Todo ya trazable vía `ordenId` en cobros/comprobantes.
- **Contribución por cuotas (F3)**: `planesCuotasJson` del método +
  desglose de contribución existente en la ficha.

## 9. Etapas y entregables

| Etapa | Contenido | Verificable |
|---|---|---|
| **A** | Este doc + contrato TS `src/lib/administracion.ts` + migraciones base (prerrequisitos fiscales + MetodoPago/CuentaFondos/MovimientoFondos/Cobro/Imputacion/Retencion/Valor/Comprobante) | migra + seed catálogo métodos |
| **B** | API métodos/cuentas/cobros + vista tesorería + catálogo métodos + registrar cobro v2 + tab Pagos OT real (diseños Prioridad 1 del usuario) | cobrar una seña de OT real con 3 cifras y verla en tesorería |
| **C** | Comprobantes (provider manual) + imputaciones + cta. cte. + aging (diseños Prioridad 2) | facturar una OT, imputarle el anticipo, ver cta. cte. y aging |
| **D** | ConfiguracionFiscal + TusFacturasAPP + letra automática + padrón | emitir FA real con CAE desde una OT |
| **E** | Fase 2 PDF: valores completos en UI, retenciones report, CxP | ciclo completo de un echeq + reporte para el contador |
| **F** | Fase 3 PDF: conciliación (Prometeo) + flujo 13 semanas | conciliación automática sobre cuenta real |

## 10. Fuera de alcance (explícito)

Plan de cuentas / asientos / balances (es del contador) · facturación
multi-país (F4, cuando haya cliente) · dispersión de pagos cuenta a
cuenta (segunda ola open banking) · flujo indirecto. La trampa a evitar
(PDF cap. 11): no construir un ERP contable completo.
