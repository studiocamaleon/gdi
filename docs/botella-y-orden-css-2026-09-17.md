# Botella y estilos de las fichas — 17/09/2026

## Unidad Botella

- Disponible en compra, stock, consumo y unidad del precio, incluyendo los selectores compartidos del inventario.
- Enum `BOTELLA` agregado con migración aditiva; aplicada a desarrollo y a la base dedicada de pruebas. Cliente Prisma regenerado.
- No existe una equivalencia universal botella/litro. En las plantillas de tinta y químico se utiliza el volumen declarado de la presentación, en ml. Si falta, se requiere el coeficiente propio de la variante.
- Prueba de integración: botella de 750 ml a $15.000 → $20/ml; ingreso de dos botellas; consumo de 375 ml → saldo de 1,5 botellas. Incluye persistencia, lectura por el motor y movimientos de stock.

## Ficha de producto sin espacios

La tarjeta de `producto-alta.module.css` tenía `padding: 0` y `gap: 0`. La sección de `producto-workspace.module.css` pedía 20 px para ambos. Los dos selectores tenían igual especificidad y se aplicaban al mismo elemento. Si el módulo base se cargaba al final, anulaba el layout de la ficha, reproduciendo la captura de Postales / Tarjetones.

Se cambió el selector base a `:where(.card)` para que los estilos específicos de la ficha siempre tengan prioridad. No se agregaron `!important` ni se cambió Turbopack.

No era seguro atribuirlo sólo a desarrollo: el resultado dependía del orden del CSS. [Next.js documenta que el orden puede diferir entre desarrollo y producción](https://nextjs.org/docs/app/getting-started/css).

### Verificación

Se procesaron los dos módulos reales con Lightning CSS (módulos y minificación) y se comprobaron en Chrome en ambos órdenes:

| Caso | Padding | Gap |
| --- | --- | --- |
| Antes, base primero | 20 px | 20 px |
| Antes, base último | 0 px | 0 px |
| Corregido, base primero | 20 px | 20 px |
| Corregido, base último | 20 px | 20 px |

Verificación adicional de la ficha real al navegar desde el catálogo y al recargar: 20 px en ambos casos. Se comprobó visualmente el selector Botella sin guardar cambios sobre materiales existentes.

- API: 41 pruebas de conversiones y persistencia aprobadas.
- Interfaz: 42 pruebas de unidades, coeficientes y borradores aprobadas.
- TypeScript de API y web y lint de los archivos web revisados: sin errores.
- En la revisión para integrar la rama se trasladó el centrado de los badges de costos a `costos-orden-tab.module.css`, conservando su apariencia. `css:guard` pasa sin aumentar estilos globales.
- No se ejecutó un build completo de producción; se verificó específicamente la independencia del orden con los módulos reales minificados.
