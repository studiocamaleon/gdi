# Legajos: la nómina como fuente única del costo de la persona

Análisis previo a implementación — 2026-07-25.
Decisión tomada: **el sueldo de cada persona se carga en el legajo**, y los
centros de costo lo consumen.

Este documento es el paso de análisis. No hay código todavía.

---

## 1. El problema, con evidencia

La sospecha inicial fue "Empleados en Registros, empleados en Gastos fijos y
Usuarios parecen lo mismo en tres lugares". Al mirar el sistema, el diagnóstico
es distinto y peor:

**El sueldo de cada persona se vuelve a tipear en cada centro de costo donde
esa persona trabaja, y nada garantiza que los valores coincidan.**

En los datos reales de desarrollo, período `2026-07`:

| Persona | Sueldo base declarado |
|---|---|
| Hector Alence | 2.000.000 |
| **Ivan Sanz** | **2.000.000 en IMP-005/006/008 · 1.500.000 en IMP-007** |
| Ivan Pavka | 1.700.000 |
| Eliana Laghi | 1.700.000 |
| Jonatan Plaza | 2.000.000 |
| Lucas Gomez | 1.800.000 |
| Yasmin | 1.700.000 |

Iván Sanz está asignado a cuatro centros. En tres de ellos su sueldo base dice
2.000.000 y en el cuarto dice 1.500.000. No hay forma de saber cuál es el
correcto mirando el sistema, y no hay nada que lo detecte: cada fila es válida
por su cuenta.

Esto no es un error de carga aislado. Es la consecuencia inevitable del modelo:
si el mismo número hay que escribirlo N veces, eventualmente difieren.

### El segundo síntoma: dos nóminas que no se hablan

| Fuente | Alimenta | Total mensual (2026-07) |
|---|---|---|
| Componentes SUELDOS + CARGAS de los centros | La **tarifa hora** de cada centro | **$18.937.500** |
| `GastoFijoEstructura` categoría SUELDOS | El **punto de equilibrio** | **$12.600.000** |

$6.337.500 de diferencia por mes. El desacople entre ambos es **deliberado** —
está documentado y la pantalla de Gastos fijos lo explica— porque responden
preguntas distintas. Pero desacoplado no es lo mismo que sin conciliar: hoy
nadie puede decir si esa brecha es intencional o un número que quedó viejo.

---

## 2. Estado actual verificado

### 2.1 Los tres conceptos y por qué NO son lo mismo

| Concepto | Qué es | Cardinalidad real hoy |
|---|---|---|
| **`User`** | Una identidad que entra al sistema | Puede no ser empleado (contador externo, dueño) |
| **`Empleado`** | Una persona de la empresa | **5 de 7 no tienen usuario vinculado** |
| **Línea de sueldo** | Un costo mensual, repartido entre centros con % | 22 componentes SUELDOS/CARGAS para 7 personas |

La relación correcta ya está en el schema: `Empleado.userId` es opcional
(`schema.prisma:948`), y un empleado se asigna a N centros vía
`CentroCostoRecurso`. **No hay que fusionar nada.** El modelo de identidad está
bien; lo que está mal es dónde vive la plata.

### 2.2 El pipeline actual del costo laboral

```
Empleado (Registros)
   │  nombre, sector, ocupación, fecha de ingreso — SIN datos de sueldo
   ▼
CentroCostoRecurso (tipoRecurso = EMPLEADO)          ← Costos › Centro › paso 2
   │  empleadoId ✔  porcentajeAsignacion ✔  valorMensual = NULL (siempre)
   │
   ├──────────────► capacidad hora-hombre del centro
   │                (costos-configuracion-periodo.service.ts:786)
   │
   ▼
CentroCostoComponenteCostoPeriodo (SUELDOS / CARGAS)  ← Costos › Centro › paso 3
      nombre = "Sueldo neto - Ivan Sanz"   ← el nombre es texto libre
      importeMensual = sueldoNeto × porcentajeAsignacion / 100
      detalleJson = { empleadoId, empleadoNombre, sueldoNeto,
                      cargasSociales, porcentajeAsignacion, part }
   │
   ▼
tarifa hora del centro (costos-tarifas.service.ts:195)
   MANO_OBRA = SUELDOS + CARGAS, persistida aparte para cobrar
   la hora hombre sólo en setup/cleanup
```

Hallazgos de este pipeline:

1. **El importe se calcula en el navegador**, no en el API
   (`centro-costo-configurator.tsx:227`, `createEmployeeDerivedComponent`). El
   backend recibe el resultado ya multiplicado.
2. **`CentroCostoRecurso.valorMensual` está en `null` en las 13 filas.** La
   columna existe para esto y no se usa; la plata está del otro lado.
3. **El vínculo con la persona existe pero vive en `detalleJson`.** Los 7
   `empleadoId` del JSON resuelven a empleados reales — o sea, el dato está
   bien, sólo que en un campo que no se puede consultar, indexar ni proteger
   con FK.
4. **Cada período hay que rehacerlo.** Hay un "copiar configuración anterior"
   (`centro-costo-configurator.tsx:960`), pero copia el centro entero: un
   aumento de sueldo obliga a entrar centro por centro.

### 2.3 Dónde se carga hoy, en la práctica

Para dar de alta a una persona con su costo, hoy hay que:

1. Registros › Empleados › Nuevo — datos personales.
2. Costos › Centro de costo A › paso 2 — asignarla, poner el %.
3. Costos › Centro de costo A › paso 3 — escribir sueldo neto y cargas.
4. Repetir 2 y 3 **en cada centro** donde trabaje.
5. Gastos fijos — actualizar a mano la línea SUELDOS del punto de equilibrio.

Iván Sanz requiere 9 pasos y que el sueldo se escriba 4 veces.

---

## 3. El marco: cuatro cosas distintas

La confusión se disuelve separando cuatro conceptos que hoy están mezclados:

| Concepto | Pregunta que responde | Dónde debe vivir |
|---|---|---|
| **Identidad** | ¿Quién entra al sistema? | `User` + `Membership` |
| **Persona** | ¿Quién trabaja acá? | `Empleado` (el legajo) |
| **Remuneración** | ¿Cuánto cuesta esa persona por mes? | **Legajo** ← hoy está en los centros |
| **Asignación** | ¿Qué parte de su tiempo va a cada centro? | `CentroCostoRecurso` (ya está bien) |

La remuneración es un atributo **de la persona**, no del centro. El centro sólo
declara qué porcentaje de esa persona consume. Hoy el sistema los tiene
invertidos: el centro declara el sueldo, y el mismo sueldo aparece en varios
centros.

### La regla que ordena todo

> **Un dato se carga en el lugar donde alguien lo sabe, una sola vez, y se
> consume donde hace falta.**

Quien sabe cuánto gana Iván es RRHH / el dueño, mirando el recibo de sueldo — no
el que configura la tarifa del centro IMP-007.

---

## 4. Qué cambia

### 4.1 El legajo gana la remuneración, con vigencia

El sueldo cambia en el tiempo (paritarias, ascensos). El sistema ya modela todo
lo demás con vigencia por período `YYYY-MM` (`CentroCostoRecurso.periodo`,
`GastoFijoEstructura.vigenteDesde/Hasta`), así que la remuneración sigue el
mismo patrón: **filas con vigencia, no un campo que se pisa.**

Esto además da algo que hoy no existe: el historial. "¿Cuánto ganaba Iván en
marzo?" es hoy irrecuperable salvo mirando el período viejo del centro.

### 4.2 Los centros de costo pasan a consumir

El paso 3 del configurador deja de pedir sueldo y cargas. Muestra, en modo
lectura, lo que sale del legajo para ese período y qué parte imputa según el %:

```
Personas asignadas
  Iván Sanz     35% imputado al centro
                Sueldo $2.000.000 + cargas $1.000.000  (del legajo, jul-2026)
                → imputa $700.000 + $350.000
                                              [ Ver legajo ]
```

El cálculo se muda al API. Hoy lo hace el navegador, lo cual está bien mientras
el número lo tipee el usuario ahí mismo; deja de estarlo cuando el origen es
otra entidad.

### 4.3 Gastos fijos ofrece la nómina real

La línea SUELDOS del punto de equilibrio pasa a poder decir *"traer de los
legajos: $18.937.500"*. Si el usuario prefiere otro número, lo pone — pero la
pantalla muestra la diferencia y por qué. La brecha de $6,3M deja de ser
invisible.

**No** se fuerza la igualdad: la decisión de que los dos módulos estén
desacoplados es correcta (el punto de equilibrio puede incluir sueldos de
socios que no imputan a ningún centro productivo, como pasa hoy con la línea
"Sueldos socios" de $6.000.000). Lo que cambia es que la diferencia sea
explícita en vez de accidental.

---

## 5. Modelo de datos propuesto

### 5.1 Nueva entidad: `EmpleadoRemuneracion`

```prisma
/// Lo que cuesta una persona por mes, con vigencia. Fuente ÚNICA del costo
/// laboral: los centros de costo consumen de acá, no al revés.
model EmpleadoRemuneracion {
  id             String    @id @default(uuid()) @db.Uuid
  tenantId       String    @db.Uuid
  empleadoId     String    @db.Uuid
  /// 'YYYY-MM' — primer mes de vigencia (inclusive).
  vigenteDesde   String
  /// 'YYYY-MM' — último mes (inclusive); null = vigente.
  vigenteHasta   String?
  /// Neto de bolsillo.
  sueldoNeto     Decimal   @db.Decimal(14, 2)
  /// Cargas sociales y aportes patronales del mes.
  cargasSociales Decimal   @db.Decimal(14, 2)
  /// Por qué cambió: 'paritaria' | 'ascenso' | 'correccion' | 'alta' | 'otro'.
  motivo         String?
  notas          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  ...
  @@index([tenantId, empleadoId, vigenteDesde])
}
```

Costo total de la persona = `sueldoNeto + cargasSociales`. Se guardan separados
porque el motor ya distingue SUELDOS de CARGAS y la tarifa los suma con la
etiqueta MANO_OBRA.

### 5.2 Cambio en `CentroCostoComponenteCostoPeriodo`

Agregar **`empleadoId`** como columna real con FK, además del `detalleJson` que
ya lo tiene. Es lo que habilita consultar "cuánto cuesta Iván" sin parsear
texto, y lo que hace posible la Fase B (costo por persona, margen por operario).

`detalleJson` se mantiene por compatibilidad y para la trazabilidad del
cálculo, pero deja de ser el único lugar donde vive el vínculo.

### 5.3 Lo que NO cambia

- `Empleado` — sigue igual, sólo gana la relación a remuneraciones.
- `CentroCostoRecurso` — sigue declarando persona + % + período. Es correcto.
  `valorMensual` queda como está (null para empleados); no se usa y no vale la
  pena migrarlo.
- El motor de costeo, las tarifas y el punto de equilibrio consumen los mismos
  campos que hoy. **Este cambio no toca el cálculo, sólo el origen del dato.**

---

## 6. Casos de uso

| # | Caso | Hoy | Después |
|---|---|---|---|
| 1 | Alta de empleado con su costo | 5+ pasos, sueldo escrito N veces | Legajo una vez, asignar % por centro |
| 2 | Aumento por paritaria | Entrar a cada centro de cada persona | Una fila nueva de remuneración |
| 3 | Persona pasa de un centro a otro | Borrar componentes de A, crear en B | Cambiar el % — el costo lo sigue |
| 4 | "¿Cuánto gana Iván?" | Imposible sin parsear texto | Está en el legajo |
| 5 | "¿Cuánto ganaba en marzo?" | Irrecuperable | Historial de vigencias |
| 6 | "¿Cuánto me cuesta la nómina?" | Sumar 22 componentes a mano | Un total en el legajo |
| 7 | Conciliar punto de equilibrio | Nadie lo hace | La pantalla muestra la brecha |
| 8 | Cerrar un período nuevo | Re-tipear todo | La remuneración vigente ya aplica |

---

## 7. Journey de carga

**Antes** (Iván Sanz, 4 centros): 9 pasos, sueldo escrito 4 veces, sin
validación cruzada. Resultado real: dos sueldos distintos para la misma persona.

**Después**:

1. Registros › Legajos › Iván Sanz › Remuneración → sueldo neto, cargas,
   vigente desde. **Una vez.**
2. Costos › cada centro › paso 2 → asignar el %. La validación de que la suma
   no supere 100% ya existe (`costos-validaciones.service.ts:329`).
3. Paso 3 → sólo lectura: muestra lo que imputa cada persona.

El sueldo se escribe una vez. La inconsistencia deja de ser posible por
construcción, no por disciplina.

---

## 8. Impacto en lo existente

| Qué | Impacto | Riesgo |
|---|---|---|
| Tarifa hora del centro | Ninguno en el cálculo: mismos componentes, mismo origen SUGERIDO | Bajo |
| Capacidad hora-hombre | Ninguno: sigue saliendo del `%` del recurso | Ninguno |
| Motor de costeo / hora hombre | Ninguno: consume la tarifa ya calculada | Ninguno |
| Punto de equilibrio | Ninguno hasta que el usuario decida conciliar | Bajo |
| Configurador de centro (front) | Paso 3 pierde los inputs de sueldo; el cálculo se muda al API | **Medio** |
| Períodos históricos | Se conservan tal cual; el backfill no los reescribe | Bajo |

El riesgo concentrado está en el configurador, que es una pantalla grande
(`centro-costo-configurator.tsx`, ~2.400 líneas). Conviene tocarla en un paso
propio, después de que el legajo ya tenga los datos.

---

## 9. Migración y backfill

El backfill puede reconstruir la nómina desde lo que ya existe, porque
`detalleJson` tiene `empleadoId` y `sueldoNeto`:

1. Por cada `(empleadoId, periodo)` con componentes SUELDOS, tomar el
   `sueldoNeto` y `cargasSociales` del JSON → crear `EmpleadoRemuneracion` con
   `vigenteDesde = periodo`.
2. **Los casos inconsistentes no se resuelven solos.** Iván Sanz tiene 2.000.000
   y 1.500.000: el backfill toma el valor de mayor frecuencia y **deja el caso
   marcado** para que una persona lo confirme. Elegir en silencio sería
   inventar un sueldo.
3. Poblar `empleadoId` en los componentes desde `detalleJson`.
4. No tocar importes ya calculados: los períodos cerrados quedan como están.

Con los datos de dev: 7 personas, 3 períodos (`2026-03`, `2026-06`, `2026-07`),
**1 conflicto a confirmar**.

---

## 10. Fases

**Fase A — La nómina al legajo** (este documento)
`EmpleadoRemuneracion` + UI en el legajo + backfill + el configurador pasa a
consumir. Gastos fijos ofrece traer la nómina real.

**Fase B — Costo por persona**
Con `empleadoId` real en los componentes: margen por operario, costo real de un
paso. Hoy figura como imposible.

**Fase C — La capa de RRHH del legajo**, por valor decreciente:
1. **Ausencias y licencias** — la de más valor: hoy si alguien está de licencia,
   la estación sigue creyendo que tiene sus horas y el ETA miente.
2. **Documentos** (certificados, contratos) — barato: R2 ya está, falta un scope
   `EMPLEADO`; hoy hay 9 scopes y ninguno es empleado.
3. **Adelantos** — al final y con cuidado: es movimiento de plata, toca
   Tesorería. Registrar, no liquidar.

---

## 11. Lo que queda afuera, a propósito

- **Liquidación de sueldos** (convenios, escalas, aguinaldo, SICOSS). Es un
  producto en sí mismo, compite con el estudio contable del cliente, y un error
  nuestro se convierte en un problema legal de ellos. El sistema **registra** lo
  que le dicen que se paga; no lo calcula.
- **Fichaje / control de asistencia.** El sistema ya mide tiempo de trabajo por
  paso; medir presencia es otra cosa y requiere hardware o una app de fichaje.
- **Fusionar `User` y `Empleado`.** Son distintos y la evidencia lo confirma: 5
  de 7 empleados no tocan el sistema.

---

## 12. Preguntas abiertas

1. **Socios.** La línea "Sueldos socios" ($6.000.000) del punto de equilibrio no
   corresponde a ningún centro productivo. ¿Los socios son legajos con
   remuneración y sin asignación a centros, o quedan como línea suelta de gastos
   fijos? Afecta directamente cómo se concilia la brecha de $6,3M.
2. **Aguinaldo y cargas variables.** ¿El costo mensual es el mismo los 12 meses,
   o hay que prever un prorrateo del aguinaldo? Cambia si la remuneración se
   modela como mensual o como anual/12.
3. **El conflicto de Iván Sanz** — ¿2.000.000 o 1.500.000? Hay que resolverlo
   antes del backfill.
