# Análisis del gap: Routings alternativos completos

> Documento del Paso 4 del plan de validación. Objetivo: decidir si el modelo necesita extenderse para soportar **N rutas distintas por producto**, o si las **alternativas por paso** + **sub-productos** alcanzan.

---

## §1 Marco

### Tres enfoques de modelado

**A) Status quo (lo que hay hoy)**
- 1 producto → 1 ruta (`procesoDefinicionDefaultId` único en `ProductoServicio`).
- Las variaciones se modelan con: pasos opcionales (`activacionV2 = OPCIONAL`), pasos condicionales (`CONDICIONAL` + JsonLogic), alternativas por paso (`ProcesoOperacionAlternativa` con override de máquina/perfil/tiempos), reglas de selección.
- Variantes (`ProductoVariante`) tienen su propio `procesoDefinicionId` opcional pero hoy no se usa para ese fin.

**B) Routings alternativos completos**
- 1 producto → N rutas (`ProcesoDefinicion[]` por producto).
- Usuario elige al cotizar entre varios "armados productivos" enteros.
- Cada ruta es independiente: distintas máquinas, distintos pasos, distintos materiales.

**C) Híbrido (recomendación del experto del texto inicial)**
- A) por defecto.
- B) cuando la divergencia entre flujos supera un umbral. Criterio sugerido: si **>40% de los pasos cambian** o si **cambian las máquinas centrales** (no solo perfiles), usar B.

---

## §2 Casos detectados en los 3 productos analizados

Cada caso lo evaluamos por **% de pasos que cambian** entre los flujos posibles.

### Tarjetas de Visita

| Caso | Pasos que cambian | % cambio | ¿Necesita routing alternativo? |
|---|---|---|---|
| Tarjeta CMYK vs BN | Cambia material (perfil máquina) | 0% (mismos pasos) | NO. Es alternativa de perfil. |
| Tarjeta simple vs doble faz | Cambia parámetro perfil | 0% | NO. Es alternativa de perfil. |
| Tarjeta con/sin diseño | Activa/desactiva 1 paso (Diseño) | 1/6 = 17% | NO. Es paso opcional. |
| Tarjeta con/sin laminado | Activa/desactiva 1 paso (Laminado) | 1/6 = 17% | NO. Es paso opcional. |
| Tarjeta papel vs PVC | Cambia máquina (Ricoh → Hibrida UV) y posiblemente paso adicional | 1-2/6 = 17-33% | DUDOSO. Probable status quo + alternativa de máquina. |
| Tarjeta laser (digital) vs offset | Cambian todos los pasos de impresión + agregar planchas, calibración | >60% | **SÍ, routing alternativo claro**. **PERO**: Corporearte hoy no tiene offset (no aparece en máquinas). Caso teórico, no real ahora. |
| Tarjeta con relieve / hot stamping | Agrega 1-2 pasos (acabado_decorativo) | 1-2/6 = 17-33% | NO. Pasos opcionales adicionales. |
| Tarjeta numerada (vouchers) | Agrega 1 paso (numeración) | 1/7 = 14% | NO. Paso opcional. |

**Tarjetas**: **0 casos reales** que requieran routing alternativo. Todo se resuelve con A.

### Vinilo adhesivo blanco

| Caso | Pasos que cambian | % cambio | ¿Necesita routing alternativo? |
|---|---|---|---|
| Vinilo 4 PASS vs 6 PASS vs 8 PASS | Cambia perfil máquina | 0% | NO. Alternativas de perfil + regla. |
| Vinilo blanco vs transparente vs translúcido | Cambia material | 0% | NO. Alternativa de material. |
| Vinilo con/sin laminado | Activa/desactiva 1 paso | 1/N | NO. Paso opcional. |
| Vinilo con/sin instalación | Activa/desactiva 1 paso | 1/N | NO. Paso opcional o sub-producto. |
| Vinilo rectangular (refilado simple) vs forma libre (plotter) | Cambia 1 paso de corte (Skycut vs cuchilla) | 1/N | NO. Alternativa de máquina. |
| Vinilo impreso (PRS-0004) vs vinilo de corte (PRS-0005) | El segundo NO se imprime. Cambian 2-3 pasos sustancialmente | >50% | **SÍ, routing alternativo claro**. **PERO** hoy ya están como 2 productos separados — funciona. La pregunta es si conviene unificar como 1 producto "Vinilo" con 2 routings. |

**Vinilo**: **1 caso "fuerte"** que ya está resuelto como 2 productos separados (status quo válido).

### Talonarios

| Caso | Pasos que cambian | % cambio | ¿Necesita routing alternativo? |
|---|---|---|---|
| Talonario simple vs duplicado vs triplicado | Activa pasos condicionales (impresión copia 1, copia 2) + cambia papel | 2-3/N | NO con CONDICIONAL real (P4-debt). |
| Talonario con/sin numeración | Activa/desactiva 1 paso | 1/N | NO. Paso opcional. |
| Talonario con/sin tapa | Sub-producto opcional | 1/N | NO con sub-productos (P6). |
| Talonario emblocado (engomado) vs Talonario abrochado (grapa) | Cambia 1 paso (encuadernado) | 1/N = ~10% | DUDOSO. Hoy son 2 productos separados (PRS-0007 y PRS-0006). Podría ser 1 producto con alternativa del paso encuadernado. |
| Talonario digital vs talonario offset (gran tirada) | Cambian todos los pasos de impresión + planchas | >60% | **SÍ, routing alternativo claro**. Mismo caveat que tarjetas: Corporearte no tiene offset. |
| Talonario A4 vs medio oficio vs custom | Cambia formato | 0% | NO. Variantes del producto. |

**Talonarios**: **0 casos reales** ahora que requieran routing alternativo. 1 caso teórico (offset) y 1 caso editorial (emblocado vs abrochado).

---

## §3 Veredicto del análisis

**De 19 casos analizados en los 3 productos**:
- **15 casos (79%)** se resuelven con A (status quo: pasos opcionales/condicionales + alternativas + materiales + sub-productos cuando estén).
- **2 casos (10%)** se resuelven con A pero requieren features que están como gap (CONDICIONAL real para multi-copia, sub-productos para tapa).
- **0 casos (0%)** REALMENTE requieren routings alternativos completos hoy en Corporearte.
- **2 casos (10%)** son teóricos pero NO aplican (offset, tarjeta PVC) porque la imprenta no tiene esa tecnología.

### Recomendación

**Adoptar enfoque C (Híbrido) a futuro, pero NO implementarlo ahora.**

Razones:
1. **Hoy no hay un solo caso real en Corporearte** que justifique el costo de implementar routings alternativos completos. El 79% se resuelve con lo que ya existe + cerrar P4-debt + P6.
2. El gap dolor que el usuario identificó ("routings alternativos completos") es **anticipatorio**, no actual. Es válido como visión, pero ejecutarlo hoy es prematuro.
3. La complejidad de B/C es alta: requiere extender schema (`ProcesoDefinicion[]` por producto), refactorear UI (selector de "armado productivo" al cotizar), refactorear cotización (qué ruta evaluar), versionar snapshots con la ruta elegida, manejar evolución de rutas. Estimado: 6-10 semanas-persona.
4. Si Corporearte agrega offset o tecnología radicalmente distinta, **el caso aparece naturalmente** y ahí se construye. Hasta entonces, agregar routings alternativos es feature ficticia.
5. El feedback del experto del texto coincide: "operaciones opcionales dentro de un único routing [...] routings alternativos cuando la ruta cambia sustancialmente". Lo que el experto dice como "cambia sustancialmente" no se ve en los 3 productos analizados.

### Lo que SÍ hay que hacer ahora (en lugar de routings alternativos)

Por orden de impacto en las 19 preguntas resueltas + gaps reales:

1. **Cerrar P4-debt #1** (CONDICIONAL real con JsonLogic) — habilita multi-copia talonario sin ruta nueva.
2. **Implementar P6** (sub-productos) — habilita tapa de talonario, cartel iluminado, etc.
3. **Cargar más alternativas en seeds** (los 4 perfiles de Ricoh, los 3 PASS de Hibrida UV, los 2 perfiles de Skycut, las 2 caras de Laminadora BOPP). Es **data**, no código. Resuelve T09, T10, V06.
4. **Cargar reglas de selección** (`ReglaDeSeleccion`) básicas: papel → perfil máquina, cantidad → tipo máquina. Requiere P7 (UI) o seedearlas a mano por SQL.
5. **Si después aparece un caso B/C real**, evaluar entonces. Documentar en `routings-alternativos-cuando-aplique.md` futuro.

### Si en algún momento se decide implementar B/C

Lineamientos para no fallar:
- Reusar `ProcesoDefinicion`. Cambiar la relación 1:1 (`ProductoServicio.procesoDefinicionDefaultId`) por 1:N (`ProcesoDefinicion.productoServicioId`). Ese campo ya existe en el schema (chequear).
- Agregar selector "armado" al cotizar (al lado del selector de variante).
- Snapshot debe persistir el `procesoDefinicionId` elegido para reproducibilidad.
- Migrar productos existentes asignando "ruta principal" a la default actual.
- Tests de regresión: cualquier producto sin alternativas seguir cotizando igual.

---

## §4 Decisión escrita

> **2026-04-23**: Mantener enfoque A (status quo). NO implementar routings alternativos completos por ahora. Re-evaluar si aparece caso real (offset, tecnología nueva) o si la complejidad de gestionar muchas alternativas/condicionales por paso supera la complejidad de modelar 2 rutas.
>
> Foco actual: cerrar P4-debt + P6 + cargar data faltante en seeds (alternativas + reglas básicas). Esto resuelve el 79-89% de las preguntas del Paso 3 sin cambiar la arquitectura.
