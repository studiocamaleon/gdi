# F6 — Avance operativo explicable de OT, lotes y campañas

Implementado el 11/09/2026. Este hito cubre avance de operaciones; el registro
cuantitativo de unidades buenas/rechazadas y entregas físicas sigue postergado.

## Criterio común

La API y la web usan el mismo módulo puro `common/progreso-produccion.ts`.
Se suman los tiempos estimados de las operaciones completadas y se dividen por
el trabajo previsto. Iniciar, pausar o bloquear una operación no acredita trabajo
completado; reabrirla retira su aporte. Los tiempos reales y el tiempo transcurrido
no cambian el porcentaje ni los tiempos cotizados.

Las participaciones de una operación compartida no agregan trabajo. Una OT sólo
alcanza 100% con todas sus operaciones completas; el redondeo queda limitado a
99% mientras haya alguna pendiente. Un estado editado manualmente y el antiguo
campo almacenado `progresoPct` no sustituyen el cálculo al consultar.

Si faltan tiempos positivos en parte de una ruta, se conserva el criterio previo
de usar la mediana de los tiempos disponibles, ahora con explicación explícita.
Sin ningún tiempo utilizable se cuenta la proporción de operaciones, sin inventar
minutos. Sin operaciones se informa ausencia de cálculo. Los borradores y las OT
canceladas no participan del progreso productivo.

La campaña suma trabajo estimado de sus OT, sin promediar porcentajes redondeados.
Una OT de una hora no pesa como una de cien horas. Si alguna OT con operaciones no
tiene tiempos, el agregado usa operaciones para todas y explica esa limitación:
no mezcla minutos con cantidades de operaciones. Las OT sin ruta se informan como
cobertura incompleta y no permiten confirmar el 100% de la campaña.

## Interfaz y contratos

- OT: mismo porcentaje en listado, productos y pestaña Producción. Explicación de
  tiempos y operaciones; desglose colapsado por lote con cantidad prevista, avance
  y operaciones completadas. Tabla con alto máximo y desplazamiento interno.
- Tablero: porcentajes por trabajo ponderados, con explicación al foco/hover.
- Campañas: agregado ponderado y explicación, incluyendo cada OT en el detalle.
- Seguimiento público y Panel General: misma fórmula para el producto comercial
  y sus componentes. El seguimiento no recibe costos ni snapshots internos.
- Los listados sólo leen estado, duración y rol de los pasos; no cargan geometría.
  El detalle de lotes incorpora identidad y pasos mediante una consulta acotada
  a los productos de la OT y al tenant. No hay migración ni recálculo de nesting.

## Validación

- 19 pruebas unitarias del cálculo: duraciones desiguales, reapertura, redondeo,
  participaciones, Decimal, tiempos ausentes/inválidos, exclusiones y campañas.
- Integración PostgreSQL con los lotes ejecutables reales de F6: cuatro lotes de
  50; completar uno da 25% de OT/seguimiento y 100/0/0/0 por lote. Listado y detalle
  coinciden aunque el porcentaje almacenado sea distinto. Una segunda OT con
  triple trabajo reduce el agregado a 6%; cancelarla restaura 25%. Se verifica
  reapertura y aislamiento entre tenants. Todo se revierte al finalizar.
- Regresión API del alcance: 228 pruebas aprobadas, 5 optativas no ejecutadas.
- Regresión web completa: 896 pruebas aprobadas, incluidas 5 nuevas de render y
  accesibilidad de la explicación y del desglose por lote.
- TypeScript web, builds de API y web (Turbopack), y CSS guard aprobados. La revisión ESLint del
  código nuevo pasa; el servicio histórico de OT conserva diagnósticos previos
  de formato/tipos no introducidos por este incremento.
- Revisión visual sobre OT-2026-0054 sin modificar sus operaciones: 15 de 2340
  minutos completados, 1% global, lote A 3% y los otros tres al 0%.

Los resultados de pruebas no certifican rendimiento cloud ni producción física.
El avance operativo es consistente con lo registrado en las operaciones; no es
una medición de unidades terminadas, rechazadas o entregadas.
