# Simulación de flujo (Fase 2b) — diseño

> 2026-07-17, rama `feat/capacidad-estaciones`. Sucesora de
> docs/capacidad-estaciones-diseno.md §10: le pone TIEMPO a la carga en
> camino (fase 2a la mostraba sin timing, D11) y calcula la fecha estimada
> de fin de cada item. Es el motor que después responde la Fase 3 ("si este
> trabajo entra ahora, ¿cuándo sale?").

## 1. Qué resuelve

- **ETA por item**: "este item termina ≈ martes 22", comparada contra la
  fecha de entrega → señal "no llega" ANTES de que el retraso exista.
- **Timing de lo en camino**: de las horas en camino de una estación,
  cuánto llega HOY (lo que el operador debe esperar en su turno).

## 2. Decisiones

- **D1 — Motor en el front, puro y determinista.** Mismos datos que el
  tablero (pasos materializados + estaciones + medianas); sin backend
  nuevo. Vive en `src/lib/flujo-produccion.ts`.
- **D2 — List-scheduling con capacidad finita.** Cada estación es un set de
  `puestos` servidores; cada item avanza secuencialmente por sus pasos
  restantes. Se programa siempre el candidato que puede ARRANCAR antes
  (max(listo, puesto libre), avanzado al calendario); empates por
  prioridad: urgente > entrega más próxima > orden de LLEGADA a la
  estación (FIFO real) > orden de OT. Aproximación suficiente para ETAs
  operativas, no un scheduler óptimo.
- **D3 — Pasos en curso descuentan lo transcurrido**: restante =
  max(duración − minutos desde `iniciadoEl`, 5). Un paso "olvidado abierto"
  no infla la proyección.
- **D4 — Bloqueados: se asume desbloqueo inmediato** y el resultado del
  item se marca `asumeDesbloqueo` (la ETA es optimista y la UI lo señala).
  La alternativa (excluirlos) haría desaparecer trabajo real.
- **D5 — Estación sin calendario → calendario default L–V 9–18 y flag
  `parcial`**. Pasos sin estación resuelta → sin restricción de capacidad
  (sólo suman su duración) y `parcial`. La ETA se muestra con señal de
  estimación parcial, nunca se oculta.
- **D6 — Paso sin duración (ni propia ni mediana) → el item queda
  `sinEstimar`**: sin ETA, sin inventar defaults (coherente con D6 de
  capacidad).
- **D7 — Feriados**: el motor recibe `noLaborables: Set<"YYYY-MM-DD">`,
  poblado desde `GET /produccion/dias-no-laborables` (tabla tenant
  `DiaNoLaborable`, gestionada en el panel de estaciones). Tablero y
  cotizador lo pasan; los días cargados no aportan capacidad.
- **D8 — Horizonte 120 días**: si un paso no consigue ventana en ese
  horizonte (calendario vacío/absurdo), el item queda sin ETA.
- **D14 — Los pasos TERCERIZADOS no consumen taller** (2026-07-20). Un paso
  con `tipoEjecucion:'tercerizado'` lo produce un proveedor: **no ocupa un
  puesto de ninguna estación** (corre en paralelo a la producción propia) y
  su costo en tiempo es el lead time `plazoProveedorDias`, sumado en **días
  HÁBILES** con los feriados del taller — no minutos de estación. Lo único
  que hace es correr el reloj del item y liberar al paso siguiente. Se
  resuelven al principio de cada vuelta del scheduler, antes de repartir
  capacidad, y se drenan en cadena si la ruta tiene dos seguidos.
  Corolarios: **nunca toman la mediana de su familia** (esa mediana se midió
  sobre pasos internos y no dice nada del proveedor), y **no marcan
  `parcial`** — no son un supuesto, es un dato cargado. Si el paso no tiene
  `plazoProveedorDias`, aplica D6: `sinEstimar`, no se inventa una ETA.
  Ver `docs/productos-tercerizados-diseno.md` §Lead time.

## 3. Algoritmo

```
restantes(item) = pasos !hecho ordenados por índice
init: readyAt(item) = ahora; en_curso → ocupa ya un puesto de su estación
       con su restante (D3); bloqueado en frontera → asumeDesbloqueo.
loop hasta agotar:
  para cada item con pasos restantes:
    startCand = avanzarAVentana(cal, max(readyAt, puestoMasLibre(estación)))
  elegir el item de menor startCand (empate → D2)
  fin = sumarMinutosLaborales(cal, startCand, duración)
  ocupar puesto; readyAt(item) = fin; registrar llegada del paso (readyAt
  previo) para el timing por estación
finEstimado(item) = readyAt final
```

## 4. Salidas y UI

- `porItem`: `{ finEstimado, sinEstimar, parcial, asumeDesbloqueo }`.
  - **Vista Por items**: bajo la fecha de entrega, "fin ≈ mar 22" — en
    ROJO con "no llega" si la ETA supera la entrega (la señal del
    vendedor). "~" delante si `parcial` o `asumeDesbloqueo`.
- `llegadasPorEstacion`: pasos futuros con su hora estimada de llegada.
  - **Card de estación**: el "+2h en camino" se desglosa: "(40 min hoy)".

## 5. Casos borde

- Item terminado o sin ruta → no participa.
- Todos los puestos ocupados por en_curso → los pendientes arrancan cuando
  el primero libere (no antes), aunque estén listos.
- `iniciadoEl` null en un en_curso (dato viejo) → restante = duración
  completa.
- Cola que cruza fin de semana / días sin franja → `sumarMinutosLaborales`
  salta ventanas; validado contra casos a mano.
- ETA en el pasado (trabajo atrasadísimo pero posible hoy) → se muestra
  normal ("hoy HH:MM").

## 6. Fase 3 — Demora sugerida en el cotizador (2026-07-17)

`estimarDemoraNuevos()` corre la misma simulación con la carga viva del
tablero MÁS items hipotéticos construidos desde `item.cotizacion.pasos`
(el motor ya trae familia, centro y minutos por paso ANTES de emitir).

- **D9 — Lo nuevo compite sin urgencia y sin entrega**: pierde todos los
  empates contra el trabajo ya comprometido (su `ordenNumero` ordena
  después de cualquier OT real). Promesa conservadora.
- **D10 — Sólo en creación/borrador.** Una orden emitida ya ESTÁ en las
  colas del tablero: volver a simular sus items los contaría dos veces.
- **D11 — Foto al montar la ficha**: las colas (tablero + estaciones +
  medianas) se cargan una vez al abrir; la ETA se recalcula en memoria al
  agregar/editar items. Si los fetches fallan, la ficha sigue sin
  sugerencia.
- **D12 — Presentación**: bajo la fecha de entrega de la orden, "El taller
  la terminaría ≈/~ mar 21/07" — en ROJO "— después de la fecha elegida"
  si la fecha prometida es anterior a la ETA; por item, fila "Sistema
  estima" junto a su fecha. "~" = supuestos (tooltip con el motivo);
  items sin pasos o sin tiempos → sin sugerencia, nunca inventada.

- **D13 — Margen de seguridad configurable** (2026-07-17):
  `ConfiguracionProduccion.margenEtaDias` por tenant (0–15, default 0),
  editado en "Calendario del taller" del panel de estaciones. Son días
  HÁBILES (L–V no feriado) que se suman a la ETA cruda SÓLO al sugerir la
  fecha prometible en el cotizador — el tablero sigue mostrando ETAs
  crudas de operación. La línea pasa a "terminaría ≈ mar 21 · prometé
  desde jue 23" con TRES niveles contra la fecha elegida: rojo "después
  de la fecha elegida" (< ETA, no llega), ámbar "queda sin margen"
  (entre ETA y sugerida) y limpio (≥ sugerida). Con margen 0 todo se
  comporta como antes.
