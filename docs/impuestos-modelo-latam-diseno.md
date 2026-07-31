# Impuestos — modelo LATAM (diseño)

> Estado: Fases 1 (reubicación), 2 (categoría × régimen, AR neutral), 2.5 (vista
> "librito") y perfiles por país (AR/CL/UY/PY/PE/CO/BO/MX/EC/HN) **implementadas**
> en `feat/impuestos-comisiones`. Motor multi-país: cobra salvo Monotributo/Exento.
> Pendiente: régimen fino por país (NRUS, RESIMPLE…), capa sub-nacional, retenciones,
> Brasil (aparte), y Comisiones (dominio separado).
> Alcance de este doc: **sólo Impuestos**. Comisiones se analiza aparte después.
> Fecha: 2026-07-31.

## 1. Objetivo y disparadores

Dos pedidos del usuario:

1. **Reubicar Impuestos (y Comisiones) a Configuración**, a nivel tenant. No son
   costos técnicos, se configuran una vez y casi no se tocan → no merecen lugar
   fijo en el sidebar bajo *Costos*.
2. **Repensar el modelo de impuestos** para que sirva a LATAM, no sólo a
   Argentina. Hoy, cada producto que se crea debe "marcar" el impuesto que se le
   imputa, y eso probablemente no sea la forma correcta. Antes de tocar código:
   investigar cómo funciona lo impositivo en AR y otros países, y contrastar.

Este documento cierra el paso de **investigación** y propone el **framework** y
los **cambios** al modelo. No incluye implementación.

## 2. Estado actual (lo que hay en el código)

**Modelos (Prisma):**

- `ProductoImpuestoCatalogo` — catálogo de impuestos del tenant. Campos clave:
  `porcentaje`, `baseCalculo` (NETO | BRUTO_COBRADO), `traslado` (POR_FUERA |
  POR_DENTRO), `alcance` (**PRODUCTO** | **TENANT**), `activo`.
- `ProductoImpuestoAplicado` — pivot Producto ⇄ Impuesto (el "marcado" por
  producto, para el alcance PRODUCTO).
- `ProductoComision*` — análogos para comisiones (fuera de alcance acá).
- `ConfiguracionFiscal` — **el emisor**: `condicionFiscal` (RI | monotributo |
  exento), CUIT, ingresos brutos, punto de venta, proveedor de e-factura. **Todo
  el circuito es ARCA/argentino** (`soloPais: "AR"` en la config).
- `Cliente.condicionFiscal` — RI | monotributo | exento | consumidor_final |
  exterior.
- `RetencionPercepcion` — ya existe una tabla para retenciones/percepciones.
- `Tenant.paisCodigo` / `monedaCodigo` / `zonaHoraria` — **la base multi-país ya
  existe** (el módulo multi-moneda/zona se hizo). Lo que NO existe es país en el
  catálogo de impuestos.

**Motor de cálculo:** `apps/api/src/productos-servicios/precio/aplicar-precio.service.ts`
codifica la normativa AR (rediseño 2026-07-08): IVA POR_FUERA sobre el neto,
IIBB base neto y cheque base bruto POR_DENTRO vía gross-up, comisiones embebidas.
La fórmula `neto = costo / (1 − margen − internos − comisiones)` es correcta y
**agnóstica**; lo AR-específico son los *inputs* (qué impuestos, qué bases).

**Sidebar:** "Impuestos" y "Comisiones" cuelgan de **Costos**
(`nav-items.ts`), apuntando a `/productos-servicios/*-catalogo`.

**UX del "marcado":** en el Tab Precio del producto, `SeccionImpuestos`
(`tab-precio-completo.tsx`) te hace **tildar del catálogo qué impuestos aplican a
cada producto**. Producto nuevo = tildar de nuevo (el dolor reportado).

## 3. Marco impositivo LATAM (investigación)

Tabla comparativa (2025-2026). "Imprenta" = venta de impresos comerciales +
servicios gráficos.

| País | Impuesto / tasa gral. | ¿Tasa depende del producto? | ¿Por dentro? | Régimen que apaga el IVA | Exhibición del precio | Impuesto sub-nacional a la venta | Libro (imprenta) | Org. e-factura |
|---|---|---|---|---|---|---|---|---|
| 🇦🇷 AR | IVA 21% | Sí: 21 / 10,5 / 27 / exento | No | Monotributo | Según comprador (RI→discrim / CF→incluido) | **IIBB provincial** (por dentro) | **Exento** | ARCA |
| 🇺🇾 UY | IVA 22% | Sí: 22 / 10 / exento | No | Literal E, Monotributo | Siempre incluido | Ninguno | Exento | DGI (CFE) |
| 🇵🇾 PY | IVA 10% | Sí: 10 / 5 / exento | No | RESIMPLE | Siempre incluido (desglose columnar) | Ninguno | Exento | DNIT (SIFEN) |
| 🇨🇱 CL | IVA 19% | **No: tasa única** (afecto/exento) | No | — (casi siempre cobra) | Boleta incl / factura discrim | Ninguno | **Afecto 19%** | SII |
| 🇵🇪 PE | IGV 18% (16+2 IPM) | Sí: gravado / exonerado / inafecto | No | **NRUS** (sólo boleta) | Boleta incl / factura discrim | IPM ya embebido | Exonerado (+reintegro) | SUNAT |
| 🇨🇴 CO | IVA 19% | Sí (el más granular): 19 / 5 / **exento** / **excluido** | No | No responsable de IVA | Precio incl / factura desglosa | **ICA municipal** (por ingreso) | **Excluido** | DIAN |
| 🇧🇴 BO | IVA 13% | No: tasa única (+ tasa cero) | **Sí (efectiva ~14,94%)** | RTS (sin factura) | Siempre incluido | **IT 3%** nacional concurrente | Tasa cero | SIN (SIAT) |
| 🇲🇽 MX | IVA 16% (8% frontera) | Sí: 16 / 8 / 0 / exento | No | RESICO **no toca IVA** (sólo ISR) | Discriminado en CFDI | Ninguno | Comercial 16% | SAT (CFDI) |
| 🇪🇨 EC | IVA 15% | Sí: 15 / 0 / exento | No | RIMPE-NP no cobra / RIMPE-Empr sí | Discriminado | Ninguno | Tasa 0% | SRI |
| 🇭🇳 HN | **ISV** 15% (18% selectivo) | Sí: 15 / 18 / exento / exonerado | No | Régimen Simplificado (< L 250k/año) no cobra | Discriminado | **Municipal** (Industria/Comercio, por dentro) | Exento | SAR (CAI) |
| 🇧🇷 BR | **Multi-tributo** (ICMS+IPI+ISS+PIS/COFINS; reforma IBS/CBS 2026-33) | Sí, y por nivel de gobierno | Sí (ICMS) | Simples Nacional (sustituye todo) | Por dentro | **ICMS estatal / ISS municipal** | Servicio vs mercadería (Súmula 156) | SEFAZ+municipio |

### Hallazgos estructurales (lo que importa para el modelo)

1. **La alícuota es una categoría del PRODUCTO, no un impuesto que se "tilda".**
   En todos los países la tasa depende del tipo de bien/servicio (general /
   reducida / exento / excluido / cero). Una imprenta cae casi siempre en
   **general**; la excepción transversal es el **libro/publicación** (exento en
   AR/UY/PY/CO, exonerado en PE, cero en BO/EC… **pero afecto en Chile**).

2. **El régimen del EMISOR es el interruptor del IVA — y no es binario.** Tiene
   tres efectos posibles:
   - *No toca el IVA* (MX RESICO: sólo cambia el impuesto a la renta).
   - *Apaga el IVA* (AR Monotributo, UY Literal E, PY RESIMPLE, PE NRUS, CO No
     responsable, BO RTS, EC RIMPE-Negocio-Popular).
   - *Sustituye el cálculo entero* (BR Simples Nacional).

3. **La exhibición del precio difiere por país.** UY/PY/BO: siempre IVA incluido.
   CL/CO/EC/MX: se exhibe incluido al público pero la factura discrimina. AR: es
   el raro — depende del comprador (Factura A discrimina, B incluye).

4. **Hay una capa sub-nacional/concurrente sólo en algunos países**, y es
   heterogénea: **IIBB** provincial (AR, "por dentro"), **ICA** municipal (CO,
   por ingreso × municipio × actividad), **IT 3%** nacional pero concurrente al
   IVA (BO). CL, PE, UY, PY, MX, EC no tienen. No es "un impuesto más del
   catálogo": es una capa parametrizada por jurisdicción.

5. **Retenciones/percepciones son una capa aparte, sobre el cobro/pago, no sobre
   el precio.** Pesan muchísimo en CO (reteIVA 15% + retefuente + reteICA), PE
   (detracciones SPOT + retenciones/percepciones de IGV) y BO; poco en CL. No
   alteran el débito fiscal del emisor: ajustan el neto cobrado y generan
   comprobantes de retención. Ya tenemos `RetencionPercepcion` como semilla.

6. **Bolivia rompe un supuesto: IVA "por dentro".** El 13% es parte del precio
   (efectiva 14,94%). El motor ya tiene la primitiva POR_DENTRO, pero acá aplica
   al impuesto principal, no a un interno.

7. **Brasil es cualitativamente distinto** y no encaja en el modelo IVA-único:
   multi-nivel (federal + 27 estados + >5.500 municipios), dualidad ICMS-vs-ISS
   que golpea de lleno a las imprentas (el mismo impreso es servicio o mercadería
   según personalización), tres tipos de documento electrónico y una reforma en
   transición. **Fuera del alcance inicial** → fasear aparte, idealmente vía
   proveedor fiscal local o esperando la consolidación IBS/CBS.

## 4. El framework: cuatro ejes + una capa aparte

El impuesto de una línea de venta se resuelve cruzando cuatro ejes, más
retenciones como capa separada:

```
IVA de la línea = f( PAÍS , RÉGIMEN DEL EMISOR , CATEGORÍA DEL PRODUCTO , COMPRADOR )
Retenciones/percepciones = g( PAÍS , operación , comprador-como-agente )   ← sobre el cobro, no el precio
Capa sub-nacional (IIBB/ICA/IT) = h( PAÍS , jurisdicción , actividad )      ← costo "por dentro" del emisor
```

| Eje | Qué define | Dónde vive | Frecuencia de cambio |
|---|---|---|---|
| **País** | Impuesto, tasas por clase, por-dentro?, exhibición, e-factura, capa sub-nacional | Config **fija por país** (semilla del sistema) | Nunca (salvo reforma) |
| **Emisor (tenant)** | Si cobra IVA y cómo (enum de régimen con efecto) | `ConfiguracionFiscal` extendida | Rara vez (una vez) |
| **Producto** | Categoría de tasa (general/reducida/exento/…) | Campo `categoriaFiscal` en el producto | Al crear el producto, default general |
| **Cliente** | Comprobante y discriminación (id fiscal + condición) | `Cliente` (ya existe) | Por cliente |

**La clave del rediseño:** el producto declara **una categoría de tasa**, no
"tilda impuestos". Default = general ⇒ **producto nuevo no requiere ninguna
acción**. El país + el régimen del emisor traducen esa categoría a la alícuota
concreta (o a "sin IVA").

## 5. Diagnóstico del modelo actual

**Lo que está bien y se conserva:**

- La fórmula de gross-up y las primitivas `traslado` (POR_DENTRO/POR_FUERA) y
  `baseCalculo` (NETO/BRUTO_COBRADO) — sirven para IVA, IIBB, IT, cheque.
- El `alcance` TENANT — perfecto para la capa sub-nacional/concurrente (IIBB, IT,
  ICA) que aplica a todo sin marcar producto por producto.
- `RetencionPercepcion` como semilla de la capa de retenciones.
- La base multi-país (`paisCodigo`, moneda, zona) ya instalada.

**Lo que falla / falta:**

1. **No hay dimensión PAÍS en los impuestos.** El catálogo es tenant-scoped pero
   asume AR. No hay semilla de "perfil impositivo por país".
2. **El IVA se modela como "tildá el impuesto por producto"** en vez de "el
   producto es de categoría X". Esto es el dolor reportado y no escala: obliga a
   marcar cada producto y a recrear el catálogo por tenant.
3. **El régimen del emisor no gatea el IVA.** Un tenant Monotributo igual tendría
   que tildar/destildar IVA por producto. Debería derivarse de
   `ConfiguracionFiscal.condicionFiscal` con un enum de efecto.
4. **`condicionFiscal` del emisor es AR-only** (RI/monotributo/exento). Necesita
   generalizarse por país (NRUS, RESIMPLE, RIMPE, No-responsable, RTS…).
5. **El IVA por-dentro (BO) y las clases exento-vs-excluido (CO)** no están
   contempladas como categorías de primera clase.
6. **Ubicación:** el catálogo vive en el sidebar de Costos, no en Configuración.

## 6. Modelo propuesto (cambios de datos)

> Nota: es el destino de diseño, no el plan de migración. La ejecución se
> fasea (ver §8) y arranca por AR para no romper lo que hoy factura real.

1. **Perfil impositivo por país (semilla del sistema).** Nuevo concepto
   `PerfilImpositivoPais` (o seed en código, no editable por el tenant):
   - Impuesto principal: nombre (IVA/IGV), organismo e-factura.
   - **Clases de tasa** disponibles con su %: p.ej. AR → {general 21, reducida
     10,5, incrementada 27, exento 0}; CL → {general 19, exento 0}; CO → {general
     19, reducida 5, exento 0 c/crédito, excluido 0 s/crédito}.
   - Flags: `ivaPorDentro` (sólo BO), `exhibicion` (incluido | segun_comprador),
     capa sub-nacional presente (IIBB/ICA/IT/none).

2. **Categoría fiscal en el producto.** Campo `categoriaFiscalCodigo` en
   `Producto` (o en la config de precio), que referencia una clase de tasa del
   país. Default = `general`. Reemplaza al pivot `ProductoImpuestoAplicado` para
   el IVA. (El pivot puede seguir vivo para casos avanzados, pero deja de ser el
   camino normal.)

3. **Régimen del emisor con efecto sobre el IVA.** Extender
   `ConfiguracionFiscal`: `regimenFiscal` (enum por país) → derivar
   `cobraIva: boolean` y `puedeEmitirFacturaConCredito: boolean`. El motor
   consulta esto **antes** de aplicar cualquier categoría de producto: si
   `cobraIva=false`, el IVA se apaga globalmente.

4. **Capa sub-nacional como config de jurisdicción (no del catálogo genérico).**
   IIBB (AR, por provincia/actividad + Convenio Multilateral), ICA (CO, por
   municipio/actividad), IT (BO, 3% nacional). Se mantienen con `alcance: TENANT`
   y `traslado: POR_DENTRO`, pero parametrizadas por jurisdicción del emisor.

5. **Retenciones/percepciones = módulo aparte** sobre `RetencionPercepcion`,
   aplicado en cobro/pago, no en el precio. Reglas `(país, operación,
   comprador-agente) → %`. Fuera del alcance de esta primera etapa de Impuestos.

6. **Cliente:** ya tiene `condicionFiscal`; generalizar el enum por país y usarlo
   para elegir comprobante y discriminación (mayormente ya está).

## 7. Reubicación a Configuración

- Mover las entradas "Impuestos" y "Comisiones" del módulo **Costos**
  (`nav-items.ts`) a **Configuración** (`configuracion-secciones.ts`), con su
  permiso. Configuración ya es país-aware (`soloPais`), así que la sección de
  impuestos puede mostrar sólo lo pertinente al país del tenant.
- Las rutas actuales `/productos-servicios/*-catalogo` pueden quedar (redirigidas)
  o moverse bajo `/configuracion/...`. Decisión de menor riesgo: mover la entrada
  del menú y, si se quiere prolijidad, la ruta.
- El "marcado por producto" del Tab Precio se **simplifica a elegir la categoría
  fiscal** del producto (un select con default general), no una lista de tildes.

## 8. Alcance y fases

- **Brasil: fuera de alcance.** Se documenta como caso especial; se faseará vía
  proveedor fiscal local o tras la consolidación IBS/CBS.
- **Orden sugerido:**
  1. **Reubicación a Configuración** (bajo riesgo, valor inmediato, no toca el
     motor). Puede ir primero y sola.
  2. **Categoría fiscal en el producto** + gateo por régimen del emisor, con
     **AR primero** (paridad exacta con lo que hoy factura: general 21 / libro
     exento / Monotributo apaga). Verificar neutralidad al centavo.
  3. **Perfil por país** + generalización del régimen y las clases (UY, PY, CL,
     PE, CO, BO, MX, EC) — habilita el resto de LATAM.
  4. **Capa sub-nacional** parametrizada (IIBB primero, ya existe la lógica).
  5. **Retenciones/percepciones** como módulo de cobro/pago (etapa propia).

## 9. Decisiones abiertas (para el usuario)

1. **Profundidad de la etapa 1.** ¿Arrancamos sólo por la **reubicación** a
   Configuración (rápido, visible) y dejamos el rediseño del modelo para una
   segunda tanda? ¿O vamos directo al modelo país×régimen×categoría?
2. **Categoría fiscal: ¿reemplaza o convive con el pivot actual?** Recomendación:
   la categoría es el camino normal; el pivot queda para casos raros o se retira.
3. **Perfil por país: ¿semilla en código o tabla editable?** Recomendación:
   semilla del sistema (no la toca el tenant), con override sólo si aparece la
   necesidad.
4. **¿Qué países habilitamos de entrada?** AR es obligatorio. ¿Sumamos ya
   UY/CL/otro por demanda concreta, o dejamos el framework listo y activamos por
   país cuando haya un cliente real?
