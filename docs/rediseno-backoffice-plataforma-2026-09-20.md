# Backoffice y Plataforma — estética Grafo

## Estado

- Compras, stock y reservas integrados en `main` local: `9bdcd9f81`.
- La revisión funcional de compras y stock queda pausada, según lo solicitado.
- Rediseño en `codex/rediseno-backoffice-plataforma`, creado desde ese merge.
- Se conserva `codex/grafo3d`.

## Alcance del rediseño

- Login de backoffice y su paso de MFA: marca Grafoprint, fondo claro,
  panel grafito, acentos naranja y controles del sistema de diseño.
- Plataforma: Observabilidad, Negocio, Tenants, Planes y precios,
  Impersonación y auditoría.
- Ficha de empresa con cabecera única, cierre visible y acciones al pie.
- Diálogos de alta de empresa, suspensión y acceso de soporte migrados a
  los componentes compartidos `FormDialog` y `FormSheet`.
- Navegación móvil horizontal, tablas con desplazamiento propio y
  apertura de la ficha de empresa mediante teclado.
- Paleta de gráficos y estados adaptada al fondo claro.

Los estilos de estas vistas pasan de `globals.css` a CSS Modules, usando
los tokens de `brand-workspace-theme.module.css`. Se mantienen los estilos
globales del banner de impersonación, que también usa el dashboard.
La línea de base de `css:guard` se reduce en 95 clases globales.

## Validación

- Antes del merge: 154 pruebas dirigidas al flujo de compras, reservas,
  demanda de materiales e impresión.
- Login: 4 pruebas con los componentes reales de formulario y MFA;
  cubren acceso normal, doble envío, errores, verificación MFA y regreso
  al login sin retener la contraseña.
- TypeScript, ESLint de los componentes modificados, `git diff --check`
  y `css:guard` sin errores.
- Inspección visual local de las cinco secciones, diálogos y ficha de
  empresa; revisión móvil de Plataforma y login. Sin ejecutar altas,
  suspensiones, cambios de plan ni sesiones de soporte sobre las cuentas.

No se cambian endpoints, permisos de Plataforma ni reglas comerciales
de los planes. Las métricas que aún no están implementadas siguen
identificadas como pendientes.
