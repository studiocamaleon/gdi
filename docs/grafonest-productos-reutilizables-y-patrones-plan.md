# GrafoNest: producto reutilizable y revisión por patrones antes de la OT

Plan de implementación del 7 de septiembre de 2026. Incorpora la presentación visual elegida por el usuario, archivos DXF guardados en el producto y el benchmark de 34 placas. **Estado: primera integración implementada en desarrollo local. Ver [implementación, pruebas y límites](grafonest-productos-reutilizables-implementacion.md).** Este documento conserva el alcance de diseño; la implementación detalla qué controles están disponibles y cuáles siguen como evolución.

## Primera entrega y resultado esperado

Crear “Exhibidor” una vez, cargar sus seis DXF y definir las piezas necesarias por unidad. Al cotizar 50 exhibidores, recuperar los archivos automáticamente, calcular las 450 piezas y presentar el plan por patrones antes de “Agregar a la OT”. Impresión y corte consumen el mismo layout y las placas se cobran una sola vez.

La referencia visual es [el plan de tres tarjetas](benchmarks/exhibidor-50/plan-34-placas.svg). A, B y C son patrones que forman un mismo plan de fabricación. Cada tarjeta representa una distribución y cuántas placas repiten esa distribución. Si más adelante se ofrecen soluciones alternativas, cada alternativa contendrá su propio conjunto de patrones.

| Componente | Piezas por exhibidor | Demanda para 50 |
| --- | ---: | ---: |
| Cuerpo | 1 | 50 |
| Soporte | 1 | 50 |
| Faldón | 1 | 50 |
| Estante | 4 | 200 |
| Costilla | 1 | 50 |
| Header | 1 | 50 |

Las cantidades provienen de la configuración del producto. Los sufijos `x50`/`x200` de los archivos de esta prueba describen un pedido particular; no deben convertirse automáticamente en cantidades por unidad.

## Qué ya existe y qué falta

| Área | Base comprobada en el código | Extensión necesaria |
| --- | --- | --- |
| Fuentes de geometría | `producto-geometrias.ts` y `geometrias-comerciales.ts`: fuentes con id, nombre y obligatoriedad | Fuente predeterminada con archivo, interpretación, revisión y política de reemplazo |
| Configuración del producto | `producto-workspace.tsx`: crea y nombra fuentes | Carga múltiple y tabla de piezas con miniatura, archivo y estado |
| Componentes | `componentes-configuracion.ts`: resuelve cantidades y herencia del contexto padre | Asistente que conecte cada pieza a su fuente y cantidad usando esa misma lógica |
| Archivos | `ArchivoScope.PRODUCTO` y almacenamiento de archivos | Referencias persistentes e interpretación geométrica versionada ligada a revisión productiva |
| Cotización | `GeometriasVectorialesCotizacion`: archivos cargados en el contexto de la cotización | Resolver predeterminados en servidor; sólo pedir lo que falte o se personalice |
| Consolidación | `CONSOLIDAR_COMPATIBLES` y `nesting-compuesto-shadow.ts` | Incorporar planificación por patrones antes de fijar el layout impresión–corte |
| Visor | `NestingViewer` dibuja placements y detalles | Vista de patrones, repeticiones, balance y explicación del cálculo |
| Optimización | Benchmark de cartera + selección entera | Servicio dentro del worker, presupuesto, progreso, cache e invalidación |

`ArchivoMaestro`/`ArchivoRevision` actuales dependen de una campaña. No se deben usar directamente como biblioteca de producto creando campañas artificiales. Se reutiliza el almacenamiento de `Archivo` y se incorpora una referencia de geometría versionada de producto compatible con la publicación de recetas.

## Cómo se creará el producto

En el producto compuesto, una sección **Piezas y archivos** permite arrastrar varios DXF/SVG y completar una tabla. Cada fila muestra nombre, cantidad por producto, miniatura, archivo, dimensiones y estado de interpretación. Se puede duplicar una fila y reutilizar un archivo entre componentes; no hace falta configurar una ruta nueva por cada carga.

Al analizar un archivo se muestra:

- Unidad declarada, o una confirmación de escala cuando no está declarada. Conservar el dato declarado y la decisión del usuario por separado.
- Capa y entidades utilizadas para la silueta de nesting, resaltadas en la miniatura.
- Operaciones de corte exterior, cortes interiores, hendido y geometría ignorada. El arte de impresión puede ser un archivo diferente y se vincula al mismo diseño.
- Medidas resultantes, orientación permitida y dirección de fibra/onda cuando aplique.
- Contornos abiertos, múltiples piezas o geometría ambigua que requieran revisión.

CORTE_3 puede sugerirse como capa candidata, pero no habilita automáticamente todos sus trazos como piezas. La selección debe resolver entidades y topología: el archivo del estante demostró que una misma capa puede mezclar envolvente, contornos duplicados y líneas internas. El exterior se usa como ocupación; conservar operaciones internas no autoriza anidar dentro de sus huecos. “Permitir piezas en huecos” sería una política adicional explícita.

La interpretación se confirma una vez y queda guardada con el archivo. Cambiar la capa, la escala o el cierre genera otra interpretación y cambia la revisión productiva. No se cierra silenciosamente un segmento de 13,878 mm como el observado en el benchmark.

La cantidad por exhibidor se escribe en la BOM/configuración existente. No se mantiene otro multiplicador independiente en el archivo: evitar `50 × 4 × 4` por contabilizar dos veces los estantes.

Por defecto, la cotización usa la geometría guardada. Si el producto admite personalización, ofrece **Usar diseño del producto / Reemplazar para esta cotización**. Una excepción no altera el catálogo ni cotizaciones anteriores. El escalado de una pieza de encastre debe estar deshabilitado por defecto cuando el producto tenga medidas de fabricación fijas.

## Contratos y conservación del resultado

La fuente versionada requiere archivo original/hash, formato, unidad declarada, escala confirmada, selección de capas/entidades, operaciones, geometría normalizada, límites, incidencias y versión del importador. Las referencias se resuelven en el servidor dentro del tenant y de la revisión publicada del producto.

La precedencia es: reemplazo explícito de la cotización, fuente guardada en la revisión del producto, o archivo requerido pendiente. Guardar y volver a editar un ítem restaura la referencia y el nesting usado; no vuelve a pedir la carga ni toma automáticamente la última versión del catálogo.

El plan de nesting será un resultado versionado asociado al lote compatible de fase 4.4, sin crear un segundo centro de planificación:

```ts
type PlanPatrones = {
  versionContrato: number;
  firmaEntrada: string;
  loteId: string;
  patrones: Array<{
    id: string;
    repeticiones: number;
    formatoPlaca: unknown;
    placements: unknown[];
    cantidadesPorComponente: Record<string, number>;
  }>;
  balance: Array<{
    componenteId: string;
    solicitadas: number;
    colocadas: number;
    excedentes: number;
  }>;
  totalPlacas: number;
  busqueda: {
    estado: 'BUSCANDO' | 'FINALIZADA' | 'CANCELADA';
    tiempoMs: number;
    motivoFin?: string;
    mejorResultadoValido: boolean;
    minimoDemostrado: boolean;
  };
};
```

Es un esquema funcional, no el contrato final de tipos. Reutilizar tipos existentes de placa/placement al implementarlo.

La firma de entrada incluye demanda, revisiones y hashes de geometría/arte, selecciones de operaciones, escala, material/formato, restricciones de máquina, márgenes, separación, fibra, giros y política de búsqueda. Cambiar algo productivo invalida el resultado; cambiar una nota o el nombre comercial no debe provocar otra búsqueda.

Se conserva exactamente el plan cuyo precio se aceptó al agregar el ítem. No volver a optimizar al crear la OT. Las revisiones futuras del producto no reemplazan el archivo ni las posiciones de una OT existente.

## Presentación antes de agregar a la OT

El paso **Revisar nesting** aparece después de cantidad/material y antes de agregar el ítem. Usa fondo claro, tarjetas limpias, color estable por componente y el mismo código visual del informe:

- Resumen superior: `50 exhibidores · 450 piezas · 34 placas · 3 patrones`.
- Tarjetas `Patrón A · Repetir ×25`, `Patrón B · Repetir ×5`, `Patrón C · Repetir ×4`, con placa a escala, margen útil y cantidades por placa.
- Leyenda por componente. Seleccionar un componente resalta sus instancias sin ocultar los demás ni modificar el plan.
- Abrir tarjeta amplía la vista y permite inspeccionar pieza, dimensión, giro y archivo. El resumen principal mantiene poca información.
- Balance de solicitado/colocado/excedente por componente. Primer alcance: cantidades exactas, sobreproducción cero.
- Apartado desplegable **Cómo se calculó**: cantidades por producto y multiplicación, archivos/capas usados, material y formato útil, restricciones de giro/fibra/separación, ocupación, duración y motivo de finalización.
- **Continuar optimizando** conserva el mejor candidato validado; **Usar este resultado** selecciona el resultado completo visible. Si siguen llegando candidatos no deben cambiar silenciosamente el precio ya seleccionado.

La explicación proviene de datos del cálculo, no de un relato inventado sobre decisiones internas del solver. No mostrar “óptimo” si sólo terminó el tiempo. Durante nesting se indica **Calculando distribución**; **Cotizando** sólo durante el cálculo del precio. Una entrada pendiente o un resultado inválido muestra el motivo concreto y no se usa para agregar el ítem.

La vista agrupa patrones por geometría, poses y operaciones/arte equivalentes. Igual cantidad de cada componente no basta para declarar dos placas iguales. El frontend representa el resultado del motor, no recalcula ubicaciones para que se vean mejores. Impresión, corte y costo derivan de la misma versión del plan.

La interfaz se adapta a cualquier número de patrones y lotes. No se fijan tres tarjetas ni una solución de 34 placas: son el caso de aceptación inicial. El visor anterior sigue atendiendo rollos, formatos y snapshots que todavía no tengan patrones.

## Orden de implementación

| Entrega | Trabajo | Condición para darla por terminada |
| --- | --- | --- |
| 1. Producto reutilizable | Referencia de archivo/interpretación, carga múltiple, selección de exterior/operaciones, cantidades por producto, herencia en cotización | Crear el exhibidor, cerrar la sesión de edición, volver a cotizar sin recargar archivos; 50 exhibidores resuelven 450 piezas |
| 2. Motor por patrones | Llevar el generador y la selección entera al worker; combinar candidatos de búsqueda general; balance exacto y validación; progreso y mejor resultado conservado | Reproducir 34 placas con tres patrones bajo las condiciones explícitas del benchmark, sin nombres ni posiciones del exhibidor codificados |
| 3. Revisión visual y OT | Tarjetas, detalle de cálculo, conservación del plan elegido, layout único impresión–corte y reconciliación de costos | Ver y elegir el plan antes de agregar; editar/reabrir restaura lo elegido; impresión y corte coinciden y no duplican material |

Estas tres entregas forman la primera funcionalidad completa. Los contratos de archivo y plan se definen al comienzo para construir UI y motor sin estructuras incompatibles. La secuencia propone un cambio de extremo a extremo dentro del producto compuesto; consolidar órdenes diferentes sigue siendo fase 5.

Pruebas necesarias: cargas ambiguas, capas mixtas, unidad ausente, límites de archivo; herencia y reemplazo; publicaciones y conservación histórica; cantidades 1/10/50/51 para detectar constantes del benchmark; fibra y giros restringidos; repetición sin duplicados; límites/solapamientos/separación; cancelación y resultados tardíos; igualdad de transforms impresión–corte; conservación al guardar/editar ítem y reconciliación monetaria. No exigir siempre 34 placas si cambian escala, márgenes o giros permitidos.

## Mejoras futuras respaldadas por documentación de Phoenix

Las siguientes son capacidades descritas públicamente, no inferencias sobre el código propietario. La prioridad para Grafo es una propuesta nuestra.

| Capacidad declarada | Aplicación propuesta en Grafo | Prioridad |
| --- | --- | --- |
| Giro personalizado, fibra, separación por herramienta o sangrado | Restricciones por pieza y proceso para que la mejor distribución sea fabricable | Incluir restricciones básicas en la primera entrega; ampliar perfiles después |
| Biblioteca de diseños, importación de varios productos y asociación automática del arte al troquel | Reutilizar geometría; cargar conjuntos; reemplazar impresión conservando la forma | Biblioteca/carga múltiple ahora; registro automático del arte después |
| Nesting libre, rejilla y franjas; planificación entre formatos y equipos | Comparar una cartera más amplia y seleccionar material/formato/máquina por costo | Siguiente evolución del motor |
| Repetición con filas/columnas alternadas y desplazadas | Generalizar patrones entrelazados más allá de filas alineadas | Próxima mejora geométrica |
| Reglas de grupo, reparto entre layouts y control de excedentes | Completar lotes compatibles, balance exacto y futuros excedentes opcionales | Balance exacto ahora; mezcla entre órdenes en fase 5 |
| Revisión de sangrados y solapamientos, salida de impresión y de corte, informes | Inspección y exportaciones registradas del mismo plan | Después de la revisión previa a OT |

Phoenix detalla fibra, giros, separación, biblioteca, importación y registro de arte en [Products](https://docs.tilialabs.com/phoenix/userguide/products/). Documenta estrategias, reglas, reparto de productos, formatos/equipos y límites de búsqueda en [Imposition AI](https://docs.tilialabs.com/phoenix/userguide/impositionai/). Las herramientas de repetición alternada/desplazada y revisión de solapamientos están en [Tools](https://docs.tilialabs.com/phoenix/userguide/tools/). Las salidas para impresión y corte, y los informes, están en [Exporting Phoenix Project](https://docs.tilialabs.com/phoenix/userguide/phoenixoutput/projects/).

La recomendación inmediata es empezar por la entrega 1 y los contratos compartidos con 2/3. El objetivo de aceptación del conjunto queda definido: **elegir un producto guardado, indicar 50 exhibidores, revisar los patrones y agregar el ítem con ese mismo resultado de impresión/corte y costo**.
