# Fase 3 — Receta productiva y BOM versionada

**Estado:** EN DESARROLLO — reabierta tras auditoría funcional
**Rama:** `visual-ilusion/fase-3-receta-bom`  
**Plan rector:** `docs/visual-ilusion-plan-maestro.md`  
**Contrato visual:** `docs/visual-ilusion-lenguaje-visual.md`

## 1. Resultado buscado

La fase convierte la configuración productiva vigente de un `Producto` en una
receta industrial explícita, publicable y trazable. La receta responde qué
materiales, componentes, procesos, recursos y documentos necesita el producto;
la cotización y la OT conservan la revisión exacta utilizada.

No se crea un segundo motor de costos. El motor universal por pasos, el nesting,
los slots, las máquinas, los perfiles, los centros de costo, los cargos y las
tercerizaciones continúan siendo la fuente de cálculo. La receta agrega sobre
ellos un límite de versión y publicación.

## 2. Relevamiento del punto de partida

Grafoprint ya dispone de:

- `Producto` con unidad comercial, medidas y atributos;
- rutas alternativas y `RutaVersion`;
- configuración de pasos obligatorios, opcionales y condicionales;
- slots relacionales con rol `SUSTRATO | COMPONENTE | CONSUMIBLE | PACKAGING`;
- selección fija, comercial, automática o heredada de materiales;
- fórmulas, factores, fuentes de medida, candidatos y variantes;
- máquinas, perfiles, centros de costo, dotación y tercerizaciones;
- cargos directos de paso/cotización;
- snapshot de ruta, costos y valores en `CotizacionItem.snapshotJson`;
- materialización de pasos de OT desde el snapshot de la cotización.

Lo que falta no es otro calculador, sino:

1. identidad y ciclo de vida de una receta;
2. revisiones publicadas inmutables;
3. BOM consolidada, independiente de cómo se reparte entre pasos;
4. componentes fabricados con identidad propia cuando requieren ejecución;
5. requisitos documentales declarativos por receta/nodo;
6. merma explícita adicional cuando no proviene de nesting/geometría;
7. vínculo directo de cotización y OT con la revisión usada;
8. validaciones de unidades, ciclos, referencias y desvío entre configuración
   viva y receta publicada.

## 3. Decisión de arquitectura

### 3.1 La configuración actual es el editor técnico; la receta es el contrato

La ruta y la configuración de pasos continúan siendo el lugar donde se define
cómo se fabrica y se costea. Una revisión de receta toma una fotografía canónica
de esa configuración y materializa proyecciones relacionales para consulta,
validación, reporting y futuras reservas.

Así se evita mantener dos editores y dos motores que puedan contradecirse.

### 3.2 Adopción opt-in y compatibilidad

- Producto sin receta publicada: conserva el comportamiento histórico.
- Producto con receta publicada: cotiza sólo si la configuración vigente
  coincide con la huella de la revisión publicada elegida.
- Si alguien modifica ruta, slots, máquinas o cargos, la revisión publicada no
  cambia. El producto queda “con cambios sin publicar” hasta crear/publicar una
  nueva revisión.
- Cotizaciones y OTs antiguas mantienen sus snapshots y FKs nulas.

### 3.3 Estados

```text
BORRADOR ── publicar ──> PUBLICADA ── deprecar ──> DEPRECADA
    ↑                         │
    └──── clonar nueva ──────┘
```

- Puede existir un solo borrador por receta.
- Publicar es transaccional y congela número, huella, snapshot y líneas.
- Una revisión publicada/deprecada nunca se edita.
- Deprecar impide nuevas selecciones, pero no altera cotizaciones ni OTs.

## 4. Modelo de dominio

### `ProductoReceta`

Raíz estable por producto y ruta alternativa: código, nombre, revisión actual
publicada y estado. Un producto puede tener varias recetas cuando ofrece vías
de fabricación realmente distintas; cada vía evoluciona sin invalidar a las
otras.

### `ProductoRecetaRevision`

Número, estado, ruta alternativa/versionada de origen, huella canónica,
snapshot completo, notas de cambio, autoría y fechas de publicación/deprecado.

### `ProductoRecetaMaterial`

Proyección relacional de cada slot: nodo/paso, código, nombre, rol, política de
selección, material/variante cuando es fija, unidad, fórmula, base, factor,
fuente de medida, merma adicional y política de costo. Los candidatos completos
permanecen también en el snapshot canónico.

### `ProductoRecetaRecurso`

Proyección por nodo de máquina, perfil, capacidad/centro de costo, dotación y
tercerización. No crea tarifas nuevas ni duplica el cálculo vigente.

### `ProductoRecetaComponente`

Sólo para componentes con identidad productiva propia. Referencia otro producto,
cantidad/fórmula/unidad y política de ejecución. Un accesorio comprado simple
continúa siendo un slot de rol `COMPONENTE`; no se convierte artificialmente en
subproducto.

### `ProductoRecetaDocumento`

Requisito declarativo por receta o nodo: nombre, propósito, etapa, tipo de
aprobación y obligatoriedad. En una campaña/OT se vincula con un
`ArchivoMaestro` concreto y reutiliza los gates de la Fase 2.

## 5. Huella y snapshot canónicos

La huella SHA-256 se calcula sobre una proyección estable y ordenada que incluye:

- identidad técnica del producto que afecta fabricación;
- ruta alternativa y versión;
- pasos base y extras en orden;
- activación, cantidad, multiplicadores y parámetros;
- slots, candidatos, variantes, fórmulas y merma;
- máquina/perfil/candidatas, centro, dotación y tercerización;
- cargos directos y requisitos documentales;
- componentes fabricados.

No incluye nombres decorativos irrelevantes, timestamps ni precios de stock en
vivo. Los precios siguen resolviéndose para el período al cotizar; el snapshot
de cotización conserva el resultado aplicado.

## 6. Integración con cotización y OT

Al cotizar:

1. se elige la ruta alternativa normal;
2. si el producto tiene receta publicada para esa alternativa, se verifica su
   huella contra la configuración viva;
3. se ejecuta el motor universal existente;
4. `CotizacionItem` guarda `recetaRevisionId`, número, huella y snapshot BOM;
5. materiales y costos del motor no se vuelven a sumar.

Al emitir la OT, el item conserva la misma revisión por medio del
`CotizacionItem` y además guarda una FK/proyección directa para consultas
operativas. Cambiar la receta del producto después no modifica la orden.

## 7. Merma

La merma de nesting/geometría continúa incluida en su cálculo y no se vuelve a
aplicar. Se agrega `mermaAdicionalPct` al slot únicamente para consumos donde el
taller necesita declarar una pérdida adicional explícita. El motor la aplica
una sola vez, después de resolver cantidad y multiplicadores y antes de costear.

La UI debe diferenciar claramente:

- merma calculada por acomodo/geometría;
- merma adicional declarada por receta.

## 8. Unidades y componentes

- Se reutiliza `UnidadMateriaPrima` como catálogo físico.
- Fórmula y unidad esperada deben ser compatibles (`por_m2 → M2`,
  `por_metro_lineal → METRO_LINEAL`, etc.), admitiendo conversiones explícitas
  ya soportadas por el motor.
- Un componente comprado se modela con variante y costo de materia prima.
- Un componente fabricado referencia un producto con receta publicada.
- El grafo de componentes debe ser acíclico y tener profundidad acotada.
- La Fase 3 congela y costea la composición; la ejecución paralela/convergencia
  de subproductos pertenece a la Fase 4.

## 9. Documentos requeridos

La receta declara el tipo de documento necesario, no un archivo de campaña
concreto. Al usarla dentro de una campaña se resuelve o crea el maestro
correspondiente. La liberación continúa gobernada por la Fase 2 y los cambios
se comunican por la Fase 2.5.

## 10. Contrato visual

- La ficha expone una sola pestaña principal llamada `Producción`; `Rutas`,
  `Pasos` y `Receta / BOM` dejan de competir como pestañas hermanas.
- Producción organiza el recorrido `Rutas y flujo → Pasos y recursos → BOM y
  versiones`, conservando la vía seleccionada durante toda la navegación.
- La configuración viva continúa en rutas/pasos y la versión publicada sigue
  siendo su contrato inmutable, pero la interfaz explica y conecta ambas capas.
- Las URLs históricas con `tab=rutas|pasos|receta` redirigen al nuevo recorrido.
- Resumen, estado y revisiones siguen la jerarquía ejecutiva de Tesorería.
- BOM, recursos, documentos y diagnósticos siguen la densidad técnica de OT.
- La pantalla distingue “configuración actual”, “borrador” y “publicada”.
- No se usa una composición shadcn genérica.
- Desktop, tablet y mobile forman parte del criterio de salida.

## 11. Eventos y notificaciones

Crear borrador, publicar, clonar y deprecar generan `EventoSistema`. La
publicación notifica a responsables pertinentes cuando la receta ya es usada
por campañas/OTs abiertas. Las invalidaciones usan tópicos de producto, receta,
cotización y OT sin enviar la BOM completa por SSE.

## 12. Validaciones obligatorias

- tenant y producto coherentes en todas las referencias;
- una sola receta por producto y un solo borrador;
- revisión publicada inmutable;
- ruta alternativa/version existentes y pertenecientes al producto;
- slots requeridos completos;
- unidades y fórmulas compatibles;
- materiales/variantes/candidatos activos y del tenant;
- recursos requeridos presentes;
- documentos obligatorios correctamente definidos;
- componentes publicados, sin ciclos ni autorreferencia;
- sin doble conteo de materiales heredados;
- huella publicada igual a configuración al cotizar;
- optimistic locking para refrescar/publicar el borrador.

## 13. Recorrido de aceptación

1. Tomar un producto compuesto simple existente y publicar su receta sin
   cambiar el resultado del motor al centavo.
2. Modelar un exhibidor con sustrato, consumible, packaging y componente
   comprado.
3. Declarar un documento requerido y vincularlo con el control documental de
   una campaña/OT.
4. Cotizar y emitir OT conservando revisión, huella y desglose.
5. Modificar la configuración: la revisión publicada permanece inmutable y el
   sistema exige publicar una nueva antes de cotizar bajo control de receta.
6. Clonar/publicar V2 y comprobar que una OT V1 no cambia.
7. Rechazar unidad incompatible, material faltante y ciclo de componentes.
8. Validar productos legacy sin receta y UI responsive.

## 14. Fuera de alcance con destino explícito

- DAG, paralelismo y convergencia de componentes: Fase 4.
- reservas y disponibilidad real de materiales: Fase 9.
- compras disparadas por faltantes: Fase 10.
- planificación de capacidad/fecha hacia atrás: Fase 11.
- lotes, yield, picking y packing ejecutables: Fases 6, 12 y 13.

## 15. Criterio de cierre

La fase queda completa cuando un exhibidor real puede publicarse, cotizarse y
emitirse preservando su revisión y BOM; los productos históricos permanecen
compatibles; los cambios sin publicar no se filtran; y las pruebas de costos,
unidades, ciclos, snapshots, tenant, permisos y responsive están aprobadas.

## 16. Cierre de implementación y evidencia

> Revisión del 30 de agosto de 2026: este cierre quedó revocado. La base de
> versionado está implementada, pero la fase continúa abierta hasta completar
> el workspace unificado de Producción y demostrar todos los recorridos de
> aceptación con un caso industrial real.

La implementación quedó cerrada el 30 de agosto de 2026 en los commits
`b68d0c79` y `2962bddd`.

- La receta se administra dentro del producto y permite crear, refrescar,
  publicar, clonar y deprecar revisiones con bloqueo optimista y auditoría.
- La BOM publicada conserva sustratos, consumibles, packaging, componentes
  comprados, componentes fabricados, recursos y merma adicional sin volver a
  sumar costos que ya calcula el motor universal.
- Las variantes fijas y candidatas se validan por unidad; los componentes
  fabricados exigen receta publicada y el grafo rechaza autorreferencias,
  ciclos y profundidad excesiva.
- Cotización y OT conservan FK, número, huella y snapshot de la revisión. Una
  modificación posterior del producto no reescribe trabajos históricos.
- Los requisitos documentales de la receta materializan maestros y gates de
  aprobación idempotentes en la campaña/OT, enlazados al item y al paso
  productivo protegido cuando corresponde.
- Los productos sin receta publicada continúan por el recorrido legacy.

Evidencia técnica final:

- migraciones aplicadas tanto en desarrollo como en la base dedicada de tests;
- API compilada sin errores;
- frontend compilado en producción sin errores;
- suite completa: 193 suites aprobadas, 1.922 pruebas aprobadas, 2 suites y 3
  pruebas omitidas por diseño;
- QA funcional real sobre `Imanes en MDF impreso`: publicación V1/V2,
  componente comprado, cotización/OT con revisión preservada, historial y
  edición de requisitos documentales;
- QA visual del workspace de receta en desktop, tablet y mobile, manteniendo el
  lenguaje visual propio de Grafoprint.

El recorrido de un exhibidor usa exactamente el mismo contrato ya validado: los
roles `SUSTRATO`, `CONSUMIBLE`, `PACKAGING` y `COMPONENTE` se proyectan desde
los slots existentes hacia la BOM congelada. La ejecución independiente y la
convergencia de componentes fabricados quedan, deliberadamente, para la Fase 4.
