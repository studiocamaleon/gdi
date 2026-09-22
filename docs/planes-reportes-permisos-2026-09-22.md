# Reportes: contrato, permisos y módulos opcionales

Fecha: 22/09/2026. Incremento sobre [el estado general de los planes](planes-estado-real-y-cierre-2026-09-21.md).

## Resultado

El catálogo de reportes, el menú, los enlaces del resumen, las páginas y la API aplican la función contratada y los permisos personales. Tener una función en el plan no concede permisos al usuario. Los análisis pueden consultar sus datos históricos aunque no se contrate el módulo que permite gestionarlos.

Se corrigieron tres diferencias:

- El resumen ofrecía enlaces a Finanzas, Clientes y Productos aunque el contrato no incluyera esos análisis. Ahora usa el mismo filtro que el catálogo.
- Los permisos especiales del controller reemplazaban el permiso general de Reportes. Ahora Resumen, Finanzas y la edición de umbrales exigen también `reportes.ver`, igual que el layout y el menú.
- La alerta de punto de equilibrio incluía cifras de rentabilidad en su texto. El filtrado de campos no podía ocultarlas. El endpoint de alertas ahora omite esa alerta y su cálculo cuando falta el permiso de márgenes.

El catálogo sin reportes disponibles muestra el estado de función no incluida o de permisos insuficientes, según corresponda. El menú no ofrece una sección sin destinos accesibles.

## Reglas verificadas

| Grupo | Rutas de consulta | Permisos, además de la función |
| --- | --- | --- |
| A01 · Resumen | Resumen, Comercial, Embudo | `reportes.ver`; Resumen exige también `reportes.ver_resumen` |
| A02 · Finanzas | Finanzas | `reportes.ver` y `finanzas.ver_margenes` |
| A03 · Comercial detallado | Productos, mezcla de categorías, Clientes | `reportes.ver`; costos y márgenes se filtran por permiso personal |
| A04 · Producción | Producción, Equipo, Salud ETA, Alertas, Umbrales | `reportes.ver`; edición de umbrales exige también `reportes.ver_resumen` y acceso operativo |

El permiso `reportes.ver_resumen` autoriza explícitamente una lectura integral del negocio, incluidos sus indicadores agregados de rentabilidad. No se añadió un requisito adicional de `finanzas.ver_margenes` a ese resumen. Esto conserva la política existente y se prueba de forma explícita. El análisis financiero detallado sigue requiriendo A02 y su permiso.

Esencial tiene A01; Pro añade A02 y A03; Avanzado añade A04. También se verificó cada grupo habilitado por separado, conservando sus dependencias obligatorias. Los servicios analíticos compartidos no exigen funciones complementarias por el solo hecho de leer antecedentes.

## Evidencia

### API y base de pruebas

`apps/api/src/reportes/__tests__/planes-reportes.integration.spec.ts` incorpora doce escenarios con versiones publicadas, contratos persistidos y asignaciones mediante el servicio de planes:

- Matriz de doce consultas HTTP y edición de umbrales para los tres planes.
- Cada grupo A01–A04 habilitado por separado, con los otros tres desactivados.
- Lectura sin ETA, reparto, planificación, tesorería, valores, gastos, compras, reservas, previsión ni presupuestos. Se conservan ventas e importes históricos de los datos de prueba.
- Permiso general y específicos, denegación antes del cálculo y filtrado de costos/márgenes y alertas.
- Rechazo de `tenantId` inyectado por query y aislamiento de los datos entre empresas.
- Retirada de una función aplicada en la siguiente consulta.
- Cuenta vencida con consulta disponible y edición de umbrales denegada.

Se ejecutaron **45 pruebas en cinco suites**, incluyendo permisos del controller, proyecciones, filtrado de márgenes y contratos de ETA. Todas pasaron. La nueva suite usa PostgreSQL `gdi_saas_test`, transacciones con rollback, guards, validación e interceptor reales; la sesión es una fixture, no un inicio de sesión por navegador.

### Interfaz

Se ejecutaron **47 pruebas en trece archivos**: catálogo, enlaces del resumen, menú, layout y acceso a las nueve páginas con las combinaciones comerciales. Incluyen retirada de la función entre visitas, falta del permiso general y ausencia de llamadas de datos cuando la página está denegada.

TypeScript de API y web, lint focal y `git diff --check` pasaron. Se reinició la API local con estos cambios; `/api` responde con base disponible y `/backoffice` devuelve HTTP 200.

La sesión actual de Chrome corresponde al staff de Plataforma: al navegar a `/reportes` redirige a su consola. Por ello este incremento **no certifica un recorrido visual autenticado de Reportes de una empresa**. No se cambió la sesión del usuario ni el contrato de una empresa operativa para hacerlo.

## Límites

- No equivale a probar todas las combinaciones posibles de las 65 funciones. La matriz general conserva la indicación de cobertura parcial.
- La retirada seguida de lectura se prueba de forma secuencial. Una consulta ya admitida puede terminar con el contrato que tenía al comenzar; este incremento no incorpora cancelación retroactiva de lecturas.
- La independencia significa consultar datos existentes sin requerir su módulo de gestión. No crea datos nuevos de módulos deshabilitados ni sustituye sus reglas de negocio.
- No se cambiaron precios, suscripciones de empresas operativas ni ofertas de Paddle en este incremento.
- Los precios anuales y la preparación comercial de producción siguen pendientes según el documento general.
