# Centros de costo — snapshot de la base de datos

**Fecha del relevamiento:** 2026-07-10 (actualizado tras republicar tarifas) · **Tenant:** gdi-demo (Grafica Corporearte) · **Período de referencia:** 2026-07

Los 7 centros están activos, en la **Planta principal**. Montos en ARS.

---

## Vista general

| Código | Nombre | Tipo | Categoría | Unidad base | Imputación | Área | Responsable |
|---|---|---|---|---|---|---|---|
| IMP-001 | Impresion Digital Laser | PRODUCTIVO | IMPRESION | HORA_MÁQUINA | DIRECTA | Impresion | Lucas Gomez |
| IMP-002 | Impresion Gran Formato | PRODUCTIVO | IMPRESION | HORA_MÁQUINA | DIRECTA | Impresion | Ivan Sanz |
| IMP-003 | Produccion & Taller | PRODUCTIVO | TERMINACION | HORA_HOMBRE | DIRECTA | Impresion | Hector Alence |
| IMP-004 | Administracion & Gerencia | ADMINISTRATIVO | ADMINISTRACION | NINGUNA | **REPARTO** | Impresion | Lucas Gomez |
| PRE-001 | Diseño Grafico & Pre-prensa | PRODUCTIVO | PREPRENSA | HORA_HOMBRE | DIRECTA | Preprensa | Ivan Pavka |
| TER-001 | Grabado/Corte Laser | PRODUCTIVO | TERMINACION | HORA_MÁQUINA | DIRECTA | Terminacion | Hector Alence |
| VP-002 | Ventas & Centro de Copiado | ADMINISTRATIVO | COMERCIAL | HORA_HOMBRE | DIRECTA | Impresion | Yasmin |

## Tarifas del período 2026-07 (republicadas 2026-07-10)

Las 7 tarifas están **publicadas y alineadas con su borrador calculado** ✅.

| Centro | Tarifa publicada | Costo mensual | Capacidad práctica |
|---|---|---|---|
| IMP-001 Impresion Digital Laser | **$ 14.520,86/h** | $ 2.555.671 | 176 h |
| IMP-002 Impresion Gran Formato | **$ 51.724,45/h** | $ 8.275.913 | 160 h |
| IMP-003 Produccion & Taller | **$ 26.750,22/h** | $ 8.132.068 | 304 h |
| IMP-004 Administracion & Gerencia | $ 19.886,36/h (se reparte, no tarifa pasos) | $ 3.500.000 | 176 h |
| PRE-001 Diseño Grafico & Pre-prensa | **$ 20.743,80/h** | $ 4.646.611 | 224 h |
| TER-001 Grabado/Corte Laser | **$ 8.930,71/h** | $ 893.071 | 100 h |
| VP-002 Ventas & Centro de Copiado | **$ 21.086,81/h** | $ 3.373.889 | 160 h |

> Historial del incidente: hasta el 2026-07-10, 5 de las 7 tarifas publicadas
> eran valores planos que el helper de `motor.spec.ts` upserteaba al correr los
> tests de la API contra la base de desarrollo ($22.727 o $6.000 con capacidad
> 1 h). Se republicaron el 2026-07-10 y se aisló la suite de tests en una base
> dedicada para que no vuelva a ocurrir (ver Observaciones).

---

## Detalle por centro (período 2026-07)

### IMP-001 · Impresion Digital Laser — $14.520,86/h
- **Capacidad**: 22 días × 8 h = 176 h teóricas, 0% improductivo → 176 h prácticas.
- **Personal asignado**: Ivan Pavka (30%) y Eliana Laghi (30%) — sueldos netos $510.000 + cargas $240.000 c/u (prorrateados).
- **Maquinaria como recurso del período**: Ricoh PRO C5100 (compra $10M, vida útil 60 meses, depreciación lineal ≈ $166.667/mes; sin datos de energía).
- **Máquinas que tarifan por este centro** (centro de costo principal): Ricoh PRO C5100, Ricoh 9003, Ricoh C8003 MPC, DTF UV HanColor 30cm, Felder F500 CNC.
- Histórico: capacidad y tarifas desde 2026-03 (entonces 15% improductivo y Heidelberg SM74 como recurso; queda un recurso EMPLEADO de 2026-03 sin nombre, probablemente huérfano).

### IMP-002 · Impresion Gran Formato — $51.724,45/h
- **Capacidad**: 20 × 8 = 160 h.
- **Personal**: Ivan Sanz (100%) — sueldo $2.000.000 + cargas $1.000.000.
- **Maquinaria del período**: DTF Textil Han Color 60 ($20M/60m), DTF UV HanColor 30cm ($20M/60m), Refretonic MT1800 Ecosolvente ($9M/36m), UV Híbrida Hancolor ($60M/36m) — depreciaciones ≈ $2,9M/mes combinadas.
- **Activo fijo**: Computadoras (depreciación $291.667/mes).
- **Máquinas que tarifan acá**: Refretonic MT1800, UV Híbrida Hancolor.
- Es el centro más caro ($8,3M/mes) por las depreciaciones de las impresoras de gran formato — su tarifa horaria real es 3,5× la de impresión láser.

### IMP-003 · Produccion & Taller — $26.750,22/h
- **Capacidad**: 20 × 8 = 160 h teóricas pero **304 h prácticas** (capacidad multiplicada por dotación: 2 personas). En 2026-06 era 320 h.
- **Personal**: Jonatan Plaza (100%, $2M + $1M cargas), Hector Alence (90%, $1,8M + $900K cargas).
- **Maquinaria del período**: Polar 92 ED ($10M/24m), Laminadora BOPP ($1M/24m).
- **Gasto general**: Limpieza $320.000/mes.
- **Activo fijo**: Herramientas varias (depreciación $500.000/mes).
- **Máquinas que tarifan acá**: Polar 92 ED, Laminadora BOPP, DTF Textil HanColor 60, Mimaki CR60.
- Usado además como centro horario manual en 1 paso de config.

### IMP-004 · Administracion & Gerencia — reparto
- Único centro con **imputación REPARTO**: sus $3,5M/mes se distribuyen a los centros productivos en el cálculo de tarifas (no tarifa pasos directamente).
- **Personal**: Lucas Gomez (100%) — sueldo $2.500.000 + cargas $1.000.000.
- Sin maquinaria ni gastos adicionales cargados.

### PRE-001 · Diseño Grafico & Pre-prensa — $20.743,80/h
- **Capacidad**: 20 × 8 = 160 h teóricas → **224 h prácticas** (dotación ~1,4 FTE).
- **Personal**: Ivan Pavka (70%) y Eliana Laghi (70%) — $1.190.000 + $560.000 cargas c/u (complemento del 30% que va a IMP-001).
- **Activo fijo**: Computadoras (depreciación $333.333/mes).
- Costo mensual $4,65M: ~$3,83M de componentes directos + la porción del reparto de Administración.
- Centro horario manual de 3 pasos de config (pre-prensa/diseño).

### TER-001 · Grabado/Corte Laser — $8.930,71/h
- **Capacidad**: 20 días × **5 h** = 100 h (única jornada reducida del catálogo). Centro nuevo: solo tiene 2026-07 cargado.
- **Personal**: Hector Alence (10% — complemento de su 90% en IMP-003).
- **Maquinaria**: Cortadora láser 130×90 ($15M/60m ≈ $250.000/mes).
- Centro más barato ($893K/mes). Ninguna máquina lo referencia como centro principal todavía y ningún paso de config lo usa — coherente con que el paso de corte láser aún no está modelado en el catálogo (cuando se modele, es el candidato natural para el tiempo manual obligatorio del comercial).

### VP-002 · Ventas & Centro de Copiado — $21.086,81/h
- **Capacidad**: 20 × 8 = 160 h.
- **Personal**: Yasmin (100%) — $1.700.000 + $800.000 cargas.
- **Maquinaria del período**: Ricoh 5100 ($1M/36m), Ricoh 6055 ($6M/36m), HP DesignJet T950 ($15M/60m), Anilladora ($500K/36m), Plastificadora ($260K/36m).
- **Activo fijo**: Computadora de mostrador ($208.333/mes).
- **Máquinas que tarifan acá**: HP DesignJet T950 MCP.
- Es el centro horario **más usado en el catálogo**: 40 pasos de config lo referencian como centro manual — ver observación 2: esa asignación fue pisada por los tests y hay que revisarla.

---

## Observaciones

1. ✅ **Resuelto — tarifas publicadas**: el 2026-07-10 se republicaron las 7 tarifas de julio con los valores calculados reales (antes 5 estaban pisadas por valores de test). Los tests de la API ahora corren contra una base dedicada (`gdi_saas_test`, forzada por el setup de Jest) y ya no pueden tocar la base de desarrollo.
2. ⚠️ **Pendiente — centros de pasos reasignados por tests**: antes del aislamiento, el helper de `motor.spec.ts` apuntó **todos los pasos de config sin máquina (T-1/T-2/T-4) a VP-002**. Los 40 pasos que hoy tarifan por VP-002 (20 trabajo_manual, 9 pre_prensa, 8 diseno_grafico, 2 montaje, 1 corte_manual) hay que revisarlos a mano desde el editor de pasos; lo esperable sería pre_prensa/diseño → PRE-001 y trabajo manual/montaje → IMP-003. Ojo: la tarifa de VP-002 ($21.087) hoy es parecida a la de PRE-001 ($20.744), así que el impacto en precios es menor, pero la imputación contable queda mal.
3. **Energía sin cargar**: todas las máquinas tienen `potenciaNominalKw = 0` y `tarifaEnergiaKwh = 0` — el costo energético no está entrando en ninguna tarifa.
4. **Asignaciones de personal consistentes**: los splits suman 100% por persona (Pavka y Laghi 30/70 entre IMP-001 y PRE-001; Alence 90/10 entre IMP-003 y TER-001), con sueldos prorrateados coherentes.
5. **Recursos vs. máquinas-principal desalineados en IMP-001**: como recursos del período solo está la Ricoh PRO C5100, pero 5 máquinas tarifan por este centro (incluida la Felder F500 CNC, que es de corte, y la DTF UV que también aparece en IMP-002 como recurso). Vale una revisada para que el costo del centro refleje todas las máquinas que tarifan por él, o mover las máquinas a su centro correcto.
6. **Junio quedó con publicadas de test** en IMP-001, IMP-002, IMP-004 y VP-002 (solo IMP-003 y PRE-001 tienen 2026-06 real). Si no se re-cotiza nada contra junio, es solo ruido histórico.
7. **Recurso huérfano**: IMP-001 tiene un empleado sin nombre en 2026-03 (probable registro colgado de un empleado borrado). Inocuo pero limpiable.
