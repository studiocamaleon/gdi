# Planes: inventario de superficies del sistema

**Fecha:** 20 de septiembre de 2026.  
**Rama:** `codex/rediseno-backoffice-plataforma`; fotografía del árbol de trabajo, incluidos los cambios locales de Backoffice.  
**Uso:** anexo de evidencia para el [catálogo de capacidades](planes-catalogo-capacidades-auditoria-2026-09-20.md) y el [diseño del editor](planes-editor-visual-diseno-2026-09-20.md).

## Método y límites

Inventario mediante el AST de TypeScript: clases con `@Controller`, métodos decorados con verbos HTTP, módulos Nest y entradas de procesos de fondo (`@Cron`, otros decoradores de tareas y clases en archivos worker). Se recorrieron archivos de `apps/api/src`, excluyendo pruebas. Para Next se enumeraron `src/app/**/page.tsx` y `route.ts`. Se extrajeron además las definiciones de familias de paso.

Las rutas son las declaraciones de los controladores, sin afirmar prefijos globales, registro efectivo de módulos o accesibilidad externa. La presencia de un decorador no describe toda la autorización: también hay guards globales, comprobaciones de servicio y efectos internos. La ausencia de un decorador aquí no prueba ausencia de seguridad. Los procesos enumerados no incluyen necesariamente todos los timers o efectos indirectos.

Las páginas pueden ser aliases o redirecciones y no representan pantallas comerciales independientes. Marketing se revisó por separado como consumidor futuro de la oferta. La rama independiente Grafo3D no forma parte de este inventario. No se ejecutaron las 606 rutas como parte de la auditoría.

| Superficie | Cantidad |
|---|---:|
| Controladores | 67 |
| Declaraciones de rutas API | 606 |
| Módulos Nest | 57 |
| Páginas Next | 120 |
| Handlers Next | 3 |
| Entradas de procesos de fondo | 16 |
| Definiciones de familias de paso extraídas | 34 |

## 1. Controladores y rutas

| Controlador / fuente | Prefijo declarado | Rutas |
|---|---|---:|
| [AdministracionController](../apps/api/src/administracion/administracion.controller.ts) | `administracion` | 56 |
| [ComprobantesPublicosController](../apps/api/src/administracion/comprobantes-publicos.controller.ts) | `comprobantes` | 3 |
| [RecibosController](../apps/api/src/administracion/recibos.controller.ts) | `recibos` | 3 |
| [AppController](../apps/api/src/app.controller.ts) | `/` | 1 |
| [ArchivosLocalController](../apps/api/src/archivos/archivos-local.controller.ts) | `archivos/local` | 2 |
| [ArchivosController](../apps/api/src/archivos/archivos.controller.ts) | `archivos` | 10 |
| [AuthController](../apps/api/src/auth/auth.controller.ts) | `auth` | 12 |
| [PerfilController](../apps/api/src/auth/perfil.controller.ts) | `auth/perfil` | 12 |
| [CampanasController](../apps/api/src/campanas/campanas.controller.ts) | `campanas` | 13 |
| [CentroCopiadoController](../apps/api/src/centro-copiado/centro-copiado.controller.ts) | `centro-copiado` | 13 |
| [ClientesController](../apps/api/src/clientes/clientes.controller.ts) | `clientes` | 9 |
| [WhatsappContextoController](../apps/api/src/clientes/whatsapp-contexto.controller.ts) | `chrome-whatsapp` | 2 |
| [CobroWebhookController](../apps/api/src/cobro/cobro-webhook.controller.ts) | `webhooks` | 1 |
| [ComprasController](../apps/api/src/compras/compras.controller.ts) | `compras` | 8 |
| [CostosController](../apps/api/src/costos/costos.controller.ts) | `costos` | 18 |
| [CotizacionesController](../apps/api/src/cotizaciones/cotizaciones.controller.ts) | `cotizaciones` | 5 |
| [CuponesController](../apps/api/src/cupones/cupones.controller.ts) | `cupones` | 6 |
| [DesarrolloDocumentalController](../apps/api/src/desarrollo-documental/desarrollo-documental.controller.ts) | `desarrollo-documental` | 14 |
| [EgresosController](../apps/api/src/egresos/egresos.controller.ts) | `egresos` | 24 |
| [EmpleadosController](../apps/api/src/empleados/empleados.controller.ts) | `empleados` | 9 |
| [EtaController](../apps/api/src/eta/eta.controller.ts) | `eta` | 5 |
| [EventosSistemaController](../apps/api/src/eventos-sistema/eventos-sistema.controller.ts) | `eventos-sistema` | 6 |
| [FidelizacionController](../apps/api/src/fidelizacion/fidelizacion.controller.ts) | `fidelizacion` | 6 |
| [GastosFijosController](../apps/api/src/gastos-fijos/gastos-fijos.controller.ts) | `gastos-fijos` | 5 |
| [ImpresionController](../apps/api/src/impresion/impresion.controller.ts) | `impresion` | 25 |
| [PerfilesCadController](../apps/api/src/impresion/perfiles-cad.controller.ts) | `impresion/cad` | 5 |
| [IntegracionesController](../apps/api/src/integraciones/integraciones.controller.ts) | `integraciones` | 8 |
| [NotificacionesController](../apps/api/src/integraciones/notificaciones/notificaciones.controller.ts) | `integraciones/notificaciones` | 4 |
| [AutomaticosWebController](../apps/api/src/integraciones/whatsapp-web/automaticos.controller.ts) | `chrome-whatsapp/automaticos` | 6 |
| [InventarioStockController](../apps/api/src/inventario/inventario-stock.controller.ts) | `inventario` | 14 |
| [InventarioController](../apps/api/src/inventario/inventario.controller.ts) | `inventario/materias-primas` | 10 |
| [PrevisionMaterialesController](../apps/api/src/inventario/prevision-materiales.controller.ts) | `inventario/prevision-materiales` | 1 |
| [ReservasMaterialController](../apps/api/src/inventario/reservas-material.controller.ts) | `/` | 4 |
| [MaquinariaController](../apps/api/src/maquinaria/maquinaria.controller.ts) | `maquinaria` | 7 |
| [CredencialesMcpController](../apps/api/src/mcp/credenciales-mcp.controller.ts) | `mcp/credenciales` | 3 |
| [McpController](../apps/api/src/mcp/mcp.controller.ts) | `mcp` | 3 |
| [MotorUniversalController](../apps/api/src/motor-universal/motor.controller.ts) | `motor-universal` | 12 |
| [AccionesColaController](../apps/api/src/ordenes-trabajo/acciones-cola.controller.ts) | `produccion/colas` | 2 |
| [AsignacionPersonalController](../apps/api/src/ordenes-trabajo/asignacion-personal.controller.ts) | `ordenes-trabajo/tablero/pasos/:pasoId/asignacion-personal` | 3 |
| [OrdenesTrabajoController](../apps/api/src/ordenes-trabajo/ordenes-trabajo.controller.ts) | `ordenes-trabajo` | 29 |
| [PanelGeneralController](../apps/api/src/panel-general/panel-general.controller.ts) | `panel-general` | 2 |
| [PlanificacionCotizacionController](../apps/api/src/planificacion-entregas/planificacion-cotizacion.controller.ts) | `cotizaciones/items/:itemId/planificacion-entregas` | 4 |
| [PlanificacionEntregasController](../apps/api/src/planificacion-entregas/planificacion.controller.ts) | `ordenes-trabajo/items/:itemId/planificacion-entregas` | 6 |
| [EquipoPlataformaController](../apps/api/src/plataforma/equipo.controller.ts) | `plataforma/equipo` | 7 |
| [PlataformaController](../apps/api/src/plataforma/plataforma.controller.ts) | `plataforma` | 17 |
| [SuscripcionesPlataformaController](../apps/api/src/plataforma/suscripciones-plataforma.controller.ts) | `plataforma/suscripciones` | 5 |
| [PresupuestosController](../apps/api/src/presupuestos/presupuestos.controller.ts) | `presupuestos` | 16 |
| [ColasProduccionController](../apps/api/src/produccion/colas/colas.controller.ts) | `produccion/colas` | 3 |
| [EquiposProduccionController](../apps/api/src/produccion/equipos-produccion.controller.ts) | `produccion/equipos` | 3 |
| [ProduccionController](../apps/api/src/produccion/produccion.controller.ts) | `produccion` | 14 |
| [ExportarFabricacionController](../apps/api/src/productos-servicios/geometrias/exportar-fabricacion.controller.ts) | `productos-servicios/geometrias` | 2 |
| [GeometriasProductoController](../apps/api/src/productos-servicios/geometrias/geometrias-producto.controller.ts) | `productos-servicios/productos/:productoId/geometrias` | 3 |
| [PrecioAplicacionesController](../apps/api/src/productos-servicios/precio/aplicaciones/precio-aplicaciones.controller.ts) | `productos-servicios/productos/:productoId/precio` | 8 |
| [ComisionesCatalogoController](../apps/api/src/productos-servicios/precio/catalogos/comisiones-catalogo.controller.ts) | `productos-servicios/comisiones-catalogo` | 5 |
| [ImpuestosCatalogoController](../apps/api/src/productos-servicios/precio/catalogos/impuestos-catalogo.controller.ts) | `productos-servicios/impuestos-catalogo` | 5 |
| [PreciosEspecialesClientesController](../apps/api/src/productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.controller.ts) | `/` | 4 |
| [ProductosServiciosController](../apps/api/src/productos-servicios/productos-servicios.controller.ts) | `productos-servicios` | 53 |
| [ProveedoresController](../apps/api/src/proveedores/proveedores.controller.ts) | `proveedores` | 8 |
| [PreparacionesRecorridoController](../apps/api/src/recorridos-vectoriales/preparaciones-recorrido.controller.ts) | `recorridos-vectoriales` | 7 |
| [RegistroController](../apps/api/src/registro/registro.controller.ts) | `registro` | 6 |
| [ReportesController](../apps/api/src/reportes/reportes.controller.ts) | `reportes/panel` | 13 |
| [SuscripcionController](../apps/api/src/suscripciones/suscripcion.controller.ts) | `suscripcion` | 8 |
| [TenantsController](../apps/api/src/tenants/tenants.controller.ts) | `tenants` | 7 |
| [UsuariosController](../apps/api/src/usuarios/usuarios.controller.ts) | `usuarios` | 14 |
| [WebhooksWhatsappController](../apps/api/src/webhooks-whatsapp/webhooks-whatsapp.controller.ts) | `webhooks` | 2 |
| [PreparacionesNestingController](../apps/api/src/workers/cotizacion/preparaciones-nesting.controller.ts) | `productos-servicios/productos/:productoId/nestings` | 2 |
| [GeometriaJobsController](../apps/api/src/workers/geometria/geometria-jobs.controller.ts) | `trabajos-geometria` | 3 |

### Detalle por controlador

Se conserva el número de línea observado para facilitar la búsqueda; puede desplazarse con cambios posteriores.

<details>
<summary>AdministracionController · 56 rutas</summary>

Fuente: [apps/api/src/administracion/administracion.controller.ts](../apps/api/src/administracion/administracion.controller.ts); declaración en línea 63.

Decoradores de clase: `@Permiso('administracion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/administracion/comprobantes/:id/pdf` | `facturaPdf` | 91 |
| GET | `/administracion/comprobantes/:id/factura` | `factura` | 102 |
| GET | `/administracion/deudores` | `deudores` | 109 |
| GET | `/administracion/clientes/:clienteId/cuenta-corriente` | `cuentaCorriente` | 114 |
| GET | `/administracion/clientes/:clienteId/cuenta-corriente/pdf` | `cuentaCorrientePdf` | 126 |
| GET | `/administracion/comprobantes` | `listarComprobantes` | 170 |
| GET | `/administracion/afip` | `afip` | 193 |
| POST | `/administracion/afip/verificar` | `verificarAfip` | 199 |
| POST | `/administracion/afip/activar` | `activarAfip` | 207 |
| POST | `/administracion/afip/desactivar` | `desactivarAfip` | 214 |
| GET | `/administracion/facturacion/estado` | `estadoFacturacion` | 222 |
| GET | `/administracion/facturacion/pendientes` | `pendientesFacturacion` | 228 |
| POST | `/administracion/ordenes/:ordenId/nota-credito` | `notaCreditoOrden` | 238 |
| POST | `/administracion/ordenes/:ordenId/facturar` | `facturarOrden` | 249 |
| POST | `/administracion/facturacion/lote` | `facturarLote` | 260 |
| GET | `/administracion/comprobantes/:id` | `obtenerComprobante` | 269 |
| POST | `/administracion/comprobantes` | `crearComprobante` | 277 |
| POST | `/administracion/comprobantes/:id/emitir` | `emitirComprobante` | 286 |
| POST | `/administracion/comprobantes/:id/cae` | `cargarCae` | 295 |
| DELETE | `/administracion/comprobantes/:id` | `descartarComprobante` | 307 |
| GET | `/administracion/clientes/:clienteId/comprobantes-pendientes` | `comprobantesPendientes` | 318 |
| POST | `/administracion/cobros/:id/imputaciones` | `imputarCobro` | 326 |
| DELETE | `/administracion/imputaciones/:id` | `quitarImputacion` | 336 |
| GET | `/administracion/configuracion-fiscal` | `obtenerConfiguracionFiscal` | 347 |
| PUT | `/administracion/configuracion-fiscal` | `guardarConfiguracionFiscal` | 352 |
| GET | `/administracion/configuracion-fiscal/letra` | `letraSugerida` | 361 |
| POST | `/administracion/puntos-venta` | `crearPuntoVenta` | 369 |
| PATCH | `/administracion/puntos-venta/:id` | `actualizarPuntoVenta` | 378 |
| DELETE | `/administracion/puntos-venta/:id` | `eliminarPuntoVenta` | 388 |
| GET | `/administracion/tesoreria` | `resumenTesoreria` | 399 |
| POST | `/administracion/cuentas` | `crearCuenta` | 404 |
| GET | `/administracion/cuentas/:id/movimientos` | `movimientosCuenta` | 413 |
| PATCH | `/administracion/cuentas/:id` | `editarCuenta` | 422 |
| POST | `/administracion/cuentas/transferencias` | `transferir` | 432 |
| POST | `/administracion/cuentas/:id/arqueo` | `arqueo` | 441 |
| POST | `/administracion/cuentas/:id/ajustes` | `ajustarFondos` | 451 |
| PATCH | `/administracion/cuentas/:cuentaId/movimientos/:movimientoId/conciliacion` | `conciliarMovimiento` | 461 |
| GET | `/administracion/valores` | `valores` | 477 |
| POST | `/administracion/valores/:id/depositar` | `depositarValor` | 482 |
| POST | `/administracion/valores/:id/acreditar` | `acreditarValor` | 492 |
| POST | `/administracion/valores/:id/revertir-deposito` | `revertirDepositoValor` | 502 |
| POST | `/administracion/valores/:id/revertir-acreditacion` | `revertirAcreditacionValor` | 512 |
| POST | `/administracion/valores/:id/rechazar` | `rechazarValor` | 522 |
| GET | `/administracion/cobros` | `cobros` | 534 |
| GET | `/administracion/cobros/pendientes-acreditacion` | `cobrosPendientesAcreditacion` | 542 |
| POST | `/administracion/cobros` | `crearCobro` | 548 |
| GET | `/administracion/cobros/:id/recibo/pdf` | `pdfRecibo` | 562 |
| GET | `/administracion/cobros/:id/recibo/enlace` | `enlaceRecibo` | 573 |
| POST | `/administracion/cobros/:id/acreditar` | `acreditarCobro` | 582 |
| DELETE | `/administracion/cobros/:id` | `anularCobro` | 588 |
| GET | `/administracion/metodos-pago` | `findAllMetodos` | 600 |
| POST | `/administracion/metodos-pago` | `createMetodo` | 606 |
| POST | `/administracion/metodos-pago/instalar-catalogo` | `instalarCatalogo` | 615 |
| PATCH | `/administracion/metodos-pago/:id` | `updateMetodo` | 621 |
| PATCH | `/administracion/metodos-pago/:id/toggle` | `toggleMetodo` | 631 |
| GET | `/administracion/cuentas` | `listarCuentas` | 638 |

</details>

<details>
<summary>ComprobantesPublicosController · 3 rutas</summary>

Fuente: [apps/api/src/administracion/comprobantes-publicos.controller.ts](../apps/api/src/administracion/comprobantes-publicos.controller.ts); declaración en línea 18.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/comprobantes/publico/:token` | `publico` | 26 |
| GET | `/comprobantes/publico/:token/pdf` | `pdfPublico` | 42 |
| GET | `/comprobantes/publico/:token/logo` | `logoPublico` | 64 |

</details>

<details>
<summary>RecibosController · 3 rutas</summary>

Fuente: [apps/api/src/administracion/recibos.controller.ts](../apps/api/src/administracion/recibos.controller.ts); declaración en línea 19.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/recibos/publico/:token` | `publico` | 27 |
| GET | `/recibos/publico/:token/pdf` | `pdfPublico` | 38 |
| GET | `/recibos/publico/:token/logo` | `logoPublico` | 54 |

</details>

<details>
<summary>AppController · 1 rutas</summary>

Fuente: [apps/api/src/app.controller.ts](../apps/api/src/app.controller.ts); declaración en línea 5.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/` | `getHealth` | 9 |

</details>

<details>
<summary>ArchivosLocalController · 2 rutas</summary>

Fuente: [apps/api/src/archivos/archivos-local.controller.ts](../apps/api/src/archivos/archivos-local.controller.ts); declaración en línea 43.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| PUT | `/archivos/local/*key` | `subir` | 52 |
| GET | `/archivos/local/*key` | `bajar` | 74 |

</details>

<details>
<summary>ArchivosController · 10 rutas</summary>

Fuente: [apps/api/src/archivos/archivos.controller.ts](../apps/api/src/archivos/archivos.controller.ts); declaración en línea 35.

Decoradores de clase: `@SoloAutenticado()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/archivos` | `listar` | 40 |
| GET | `/archivos/de-orden/:ordenId` | `deOrden` | 50 |
| GET | `/archivos/uso` | `uso` | 56 |
| GET | `/archivos/papelera` | `papelera` | 62 |
| POST | `/archivos/:id/restaurar` | `restaurar` | 67 |
| POST | `/archivos/iniciar` | `iniciar` | 76 |
| POST | `/archivos/:id/confirmar` | `confirmar` | 86 |
| GET | `/archivos/:id/contenido` | `contenido` | 104 |
| PATCH | `/archivos/:id` | `actualizar` | 113 |
| DELETE | `/archivos/:id` | `eliminar` | 121 |

</details>

<details>
<summary>AuthController · 12 rutas</summary>

Fuente: [apps/api/src/auth/auth.controller.ts](../apps/api/src/auth/auth.controller.ts); declaración en línea 37.

Decoradores de clase: `@SoloAutenticado()`, `@PermitirSuscripcionInactiva()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/auth/login` | `login` | 43 |
| POST | `/auth/login-plataforma` | `loginPlataforma` | 54 |
| POST | `/auth/mfa/verificar` | `verificarMfa` | 61 |
| POST | `/auth/logout` | `logout` | 72 |
| POST | `/auth/invitacion-plataforma/consultar` | `consultarEquipo` | 79 |
| POST | `/auth/invitacion-plataforma/aceptar` | `aceptarEquipo` | 87 |
| GET | `/auth/invitations/:token` | `getInvitation` | 95 |
| POST | `/auth/invitations/:token/accept` | `acceptInvitation` | 101 |
| POST | `/auth/password` | `cambiarPassword` | 111 |
| GET | `/auth/me` | `getCurrentContext` | 119 |
| POST | `/auth/switch-tenant` | `switchTenant` | 124 |
| POST | `/auth/salir-impersonacion` | `salirDeImpersonacion` | 133 |

</details>

<details>
<summary>PerfilController · 12 rutas</summary>

Fuente: [apps/api/src/auth/perfil.controller.ts](../apps/api/src/auth/perfil.controller.ts); declaración en línea 32.

Decoradores de clase: `@SoloAutenticado()`, `@SinTenant()`, `@ProhibidoImpersonando()`, `@PermitirSuscripcionInactiva()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| PATCH | `/auth/perfil` | `editar` | 43 |
| PUT | `/auth/perfil/foto` | `foto` | 48 |
| DELETE | `/auth/perfil/foto` | `quitar` | 54 |
| GET | `/auth/perfil/foto` | `descargar` | 59 |
| GET | `/auth/perfil/mfa` | `estado` | 65 |
| POST | `/auth/perfil/mfa/iniciar` | `iniciar` | 72 |
| POST | `/auth/perfil/mfa/confirmar` | `confirmar` | 80 |
| DELETE | `/auth/perfil/mfa/pendiente` | `cancelar` | 88 |
| POST | `/auth/perfil/mfa/desactivar` | `desactivar` | 94 |
| POST | `/auth/perfil/mfa/recuperacion` | `recuperar` | 101 |
| POST | `/auth/perfil/mfa/recuperacion/confirmar` | `confirmarRecuperacion` | 109 |
| POST | `/auth/perfil/mfa/reemplazar` | `reemplazar` | 119 |

</details>

<details>
<summary>CampanasController · 13 rutas</summary>

Fuente: [apps/api/src/campanas/campanas.controller.ts](../apps/api/src/campanas/campanas.controller.ts); declaración en línea 29.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('comercial.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/campanas` | `listar` | 35 |
| GET | `/campanas/opciones` | `opciones` | 43 |
| GET | `/campanas/:id` | `detalle` | 51 |
| POST | `/campanas` | `crear` | 59 |
| PATCH | `/campanas/:id` | `editar` | 65 |
| PATCH | `/campanas/:id/estado` | `cambiarEstado` | 75 |
| PUT | `/campanas/:id/equipo` | `reemplazarEquipo` | 85 |
| POST | `/campanas/:id/hitos` | `crearHito` | 95 |
| PATCH | `/campanas/:id/hitos/:hitoId` | `editarHito` | 105 |
| POST | `/campanas/:id/cotizaciones/:cotizacionId` | `vincularCotizacion` | 116 |
| DELETE | `/campanas/:id/cotizaciones/:cotizacionId` | `desvincularCotizacion` | 126 |
| POST | `/campanas/:id/ordenes/:ordenId` | `vincularOrden` | 136 |
| DELETE | `/campanas/:id/ordenes/:ordenId` | `desvincularOrden` | 146 |

</details>

<details>
<summary>CentroCopiadoController · 13 rutas</summary>

Fuente: [apps/api/src/centro-copiado/centro-copiado.controller.ts](../apps/api/src/centro-copiado/centro-copiado.controller.ts); declaración en línea 28.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('comercial.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/centro-copiado/estado` | `estado` | 55 |
| GET | `/centro-copiado/opciones-cad` | `opcionesCad` | 62 |
| GET | `/centro-copiado/opciones` | `opciones` | 67 |
| POST | `/centro-copiado/cotizar` | `cotizar` | 79 |
| POST | `/centro-copiado/construir-items` | `construirItems` | 95 |
| POST | `/centro-copiado/guardar-tomo` | `guardarTomo` | 111 |
| POST | `/centro-copiado/agregar-a-orden` | `agregarAOrden` | 127 |
| GET | `/centro-copiado/config` | `getConfig` | 140 |
| GET | `/centro-copiado/salud` | `salud` | 148 |
| PUT | `/centro-copiado/config` | `actualizarConfig` | 156 |
| POST | `/centro-copiado/inicializar` | `inicializar` | 167 |
| POST | `/centro-copiado/reparar` | `reparar` | 175 |
| GET | `/centro-copiado/historial` | `historial` | 183 |

</details>

<details>
<summary>ClientesController · 9 rutas</summary>

Fuente: [apps/api/src/clientes/clientes.controller.ts](../apps/api/src/clientes/clientes.controller.ts); declaración en línea 26.

Decoradores de clase: `@Permiso('crm.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/clientes` | `findAll` | 31 |
| GET | `/clientes/por-documento/:documento` | `porDocumento` | 43 |
| GET | `/clientes/:id` | `findOne` | 51 |
| POST | `/clientes` | `create` | 56 |
| POST | `/clientes/importar` | `importar` | 65 |
| POST | `/clientes/alta-por-documento` | `altaPorDocumento` | 79 |
| PUT | `/clientes/:id` | `update` | 88 |
| PATCH | `/clientes/:id/estado` | `estado` | 99 |
| DELETE | `/clientes/:id` | `remove` | 109 |

</details>

<details>
<summary>WhatsappContextoController · 2 rutas</summary>

Fuente: [apps/api/src/clientes/whatsapp-contexto.controller.ts](../apps/api/src/clientes/whatsapp-contexto.controller.ts); declaración en línea 8.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/chrome-whatsapp/sesion` | `sesion` | 12 |
| GET | `/chrome-whatsapp/contexto` | `contexto` | 19 |

</details>

<details>
<summary>CobroWebhookController · 1 rutas</summary>

Fuente: [apps/api/src/cobro/cobro-webhook.controller.ts](../apps/api/src/cobro/cobro-webhook.controller.ts); declaración en línea 33.

Decoradores de clase: `@Public()`, `@SinTenant()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/webhooks/paddle` | `paddleWebhook` | 45 |

</details>

<details>
<summary>ComprasController · 8 rutas</summary>

Fuente: [apps/api/src/compras/compras.controller.ts](../apps/api/src/compras/compras.controller.ts); declaración en línea 24.

Decoradores de clase: `@Permiso('inventario.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/compras/catalogo` | `catalogo` | 33 |
| GET | `/compras/necesidades` | `necesidades` | 36 |
| GET | `/compras` | `listar` | 42 |
| GET | `/compras/:id` | `detalle` | 61 |
| PUT | `/compras/ofertas` | `oferta` | 67 |
| POST | `/compras` | `crear` | 73 |
| POST | `/compras/:id/acciones` | `actuar` | 79 |
| POST | `/compras/:id/recepciones` | `recibir` | 86 |

</details>

<details>
<summary>CostosController · 18 rutas</summary>

Fuente: [apps/api/src/costos/costos.controller.ts](../apps/api/src/costos/costos.controller.ts); declaración en línea 23.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/costos/plantas` | `findPlantas` | 28 |
| POST | `/costos/plantas` | `createPlanta` | 33 |
| PUT | `/costos/plantas/:id` | `updatePlanta` | 42 |
| PATCH | `/costos/plantas/:id/toggle` | `togglePlanta` | 52 |
| GET | `/costos/centros-costo` | `findCentros` | 58 |
| POST | `/costos/centros-costo/planilla` | `guardarCentroPlanilla` | 63 |
| POST | `/costos/centros-costo` | `createCentro` | 72 |
| PUT | `/costos/centros-costo/:id` | `updateCentro` | 81 |
| PATCH | `/costos/centros-costo/:id/toggle` | `toggleCentro` | 91 |
| DELETE | `/costos/centros-costo/:id` | `eliminarCentro` | 101 |
| GET | `/costos/centros-costo/:id/configuracion` | `getCentroConfiguracion` | 107 |
| PUT | `/costos/centros-costo/:id/configuracion-base` | `updateCentroConfiguracionBase` | 116 |
| GET | `/costos/centros-costo/resumen` | `getResumenCentros` | 126 |
| PUT | `/costos/centros-costo/:id/lineas` | `replaceCentroLineas` | 134 |
| PUT | `/costos/centros-costo/:id/capacidad` | `upsertCentroCapacidad` | 145 |
| POST | `/costos/centros-costo/:id/calcular-tarifa` | `calcularTarifaCentro` | 156 |
| POST | `/costos/centros-costo/:id/publicar-tarifa` | `publicarTarifaCentro` | 166 |
| GET | `/costos/centros-costo/:id/tarifas` | `getCentroTarifas` | 176 |

</details>

<details>
<summary>CotizacionesController · 5 rutas</summary>

Fuente: [apps/api/src/cotizaciones/cotizaciones.controller.ts](../apps/api/src/cotizaciones/cotizaciones.controller.ts); declaración en línea 17.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/cotizaciones/tipo-cambio/configuracion` | `configuracion` | 24 |
| PATCH | `/cotizaciones/tipo-cambio/configuracion` | `configurar` | 30 |
| POST | `/cotizaciones/tipo-cambio` | `crearCambio` | 39 |
| GET | `/cotizaciones/tipo-cambio/:id` | `obtenerCambio` | 48 |
| GET | `/cotizaciones/dolar` | `dolar` | 54 |

</details>

<details>
<summary>CuponesController · 6 rutas</summary>

Fuente: [apps/api/src/cupones/cupones.controller.ts](../apps/api/src/cupones/cupones.controller.ts); declaración en línea 25.

Decoradores de clase: `@Permiso('crm.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/cupones` | `listar` | 30 |
| POST | `/cupones` | `crear` | 40 |
| PATCH | `/cupones/:id` | `actualizar` | 47 |
| DELETE | `/cupones/:id` | `eliminar` | 58 |
| POST | `/cupones/validar` | `validar` | 69 |
| GET | `/cupones/:id/historial` | `historial` | 75 |

</details>

<details>
<summary>DesarrolloDocumentalController · 14 rutas</summary>

Fuente: [apps/api/src/desarrollo-documental/desarrollo-documental.controller.ts](../apps/api/src/desarrollo-documental/desarrollo-documental.controller.ts); declaración en línea 27.

Decoradores de clase: `@Permiso('comercial.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/desarrollo-documental/publico/:token` | `publico` | 32 |
| GET | `/desarrollo-documental/publico/:token/archivo` | `archivoPublico` | 38 |
| POST | `/desarrollo-documental/publico/:token/decision` | `decidirPublico` | 48 |
| GET | `/desarrollo-documental/campanas/:campanaId` | `listarCampana` | 57 |
| GET | `/desarrollo-documental/ordenes/:ordenId` | `estadoOrden` | 65 |
| POST | `/desarrollo-documental/maestros` | `crearMaestro` | 74 |
| POST | `/desarrollo-documental/maestros/:maestroId/revisiones` | `crearRevision` | 83 |
| POST | `/desarrollo-documental/revisiones/:revisionId/solicitudes` | `solicitar` | 93 |
| POST | `/desarrollo-documental/solicitudes/:solicitudId/link` | `emitirLink` | 103 |
| DELETE | `/desarrollo-documental/solicitudes/:solicitudId/link` | `revocarLink` | 113 |
| POST | `/desarrollo-documental/solicitudes/:solicitudId/decision` | `decidir` | 122 |
| POST | `/desarrollo-documental/revisiones/:revisionId/liberar` | `liberar` | 132 |
| POST | `/desarrollo-documental/gates` | `crearGate` | 141 |
| DELETE | `/desarrollo-documental/gates/:gateId` | `eliminarGate` | 150 |

</details>

<details>
<summary>EgresosController · 24 rutas</summary>

Fuente: [apps/api/src/egresos/egresos.controller.ts](../apps/api/src/egresos/egresos.controller.ts); declaración en línea 44.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('administracion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/egresos/recurrentes` | `listarRecurrentes` | 55 |
| POST | `/egresos/recurrentes` | `crearRecurrente` | 60 |
| POST | `/egresos/recurrentes/generar` | `generarRecurrentes` | 70 |
| GET | `/egresos/presupuestado` | `presupuestadoVsReal` | 77 |
| PATCH | `/egresos/recurrentes/:id` | `editarRecurrente` | 85 |
| DELETE | `/egresos/recurrentes/:id` | `borrarRecurrente` | 95 |
| GET | `/egresos/categorias` | `categorias` | 106 |
| POST | `/egresos/categorias` | `crearCategoria` | 111 |
| PATCH | `/egresos/categorias/:id` | `editarCategoria` | 120 |
| DELETE | `/egresos/categorias/:id` | `borrarCategoria` | 130 |
| GET | `/egresos/resumen` | `resumen` | 142 |
| GET | `/egresos/proveedores` | `saldosPorProveedor` | 148 |
| GET | `/egresos/valores-en-cartera` | `valoresEnCartera` | 154 |
| POST | `/egresos/valores/:id/debitar` | `debitarValor` | 159 |
| POST | `/egresos/valores/:id/rechazar` | `rechazarValorPropio` | 169 |
| GET | `/egresos/reporte` | `reporte` | 180 |
| POST | `/egresos/pagos` | `registrarPago` | 191 |
| GET | `/egresos/pagos/:id/orden-pago.pdf` | `ordenDePagoPdf` | 204 |
| PATCH | `/egresos/pagos/:id/anular` | `anularPago` | 219 |
| GET | `/egresos` | `listar` | 231 |
| POST | `/egresos` | `crear` | 255 |
| GET | `/egresos/:id/pagos` | `pagosDeEgreso` | 261 |
| PATCH | `/egresos/:id` | `editar` | 266 |
| PATCH | `/egresos/:id/anular` | `anular` | 276 |

</details>

<details>
<summary>EmpleadosController · 9 rutas</summary>

Fuente: [apps/api/src/empleados/empleados.controller.ts](../apps/api/src/empleados/empleados.controller.ts); declaración en línea 26.

Decoradores de clase: `@Permiso('registros.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/empleados` | `findAll` | 31 |
| GET | `/empleados/opciones` | `opciones` | 39 |
| GET | `/empleados/:id` | `findOne` | 44 |
| POST | `/empleados` | `create` | 49 |
| POST | `/empleados/importar` | `importar` | 58 |
| PUT | `/empleados/:id` | `update` | 67 |
| PATCH | `/empleados/estado` | `estadoMuchos` | 77 |
| PATCH | `/empleados/:id/estado` | `estado` | 91 |
| DELETE | `/empleados/:id` | `remove` | 106 |

</details>

<details>
<summary>EtaController · 5 rutas</summary>

Fuente: [apps/api/src/eta/eta.controller.ts](../apps/api/src/eta/eta.controller.ts); declaración en línea 7.

Decoradores de clase: `@Permiso('produccion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/eta/contexto-prevision` | `contextoPrevision` | 13 |
| GET | `/eta/precision` | `precision` | 25 |
| GET | `/eta/colas` | `colas` | 35 |
| GET | `/eta/salud` | `salud` | 46 |
| POST | `/eta/snapshot` | `snapshot` | 52 |

</details>

<details>
<summary>EventosSistemaController · 6 rutas</summary>

Fuente: [apps/api/src/eventos-sistema/eventos-sistema.controller.ts](../apps/api/src/eventos-sistema/eventos-sistema.controller.ts); declaración en línea 16.

Decoradores de clase: `@Permiso('panel.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/eventos-sistema/notificaciones` | `listar` | 21 |
| GET | `/eventos-sistema/notificaciones/no-leidas` | `noLeidas` | 29 |
| GET | `/eventos-sistema/cambios` | `cambios` | 34 |
| PATCH | `/eventos-sistema/notificaciones/leer-todas` | `leerTodas` | 39 |
| PATCH | `/eventos-sistema/notificaciones/:id/leer` | `leer` | 44 |
| SSE | `/eventos-sistema/stream` | `stream` | 52 |

</details>

<details>
<summary>FidelizacionController · 6 rutas</summary>

Fuente: [apps/api/src/fidelizacion/fidelizacion.controller.ts](../apps/api/src/fidelizacion/fidelizacion.controller.ts); declaración en línea 12.

Decoradores de clase: `@Permiso('crm.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/fidelizacion/configuracion` | `configuracion` | 16 |
| PATCH | `/fidelizacion/configuracion` | `actualizar` | 19 |
| GET | `/fidelizacion/resumen` | `resumen` | 25 |
| GET | `/fidelizacion/clientes/:clienteId` | `cuenta` | 28 |
| POST | `/fidelizacion/clientes/:clienteId/ajustes` | `ajustar` | 34 |
| POST | `/fidelizacion/clientes/:clienteId/simular` | `simular` | 43 |

</details>

<details>
<summary>GastosFijosController · 5 rutas</summary>

Fuente: [apps/api/src/gastos-fijos/gastos-fijos.controller.ts](../apps/api/src/gastos-fijos/gastos-fijos.controller.ts); declaración en línea 34.

Decoradores de clase: `@Permiso('administracion.configurar')`, `@Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/gastos-fijos` | `listar` | 40 |
| POST | `/gastos-fijos` | `crear` | 45 |
| PUT | `/gastos-fijos/:id` | `actualizar` | 57 |
| PATCH | `/gastos-fijos/:id/toggle` | `alternar` | 67 |
| DELETE | `/gastos-fijos/:id` | `eliminar` | 73 |

</details>

<details>
<summary>ImpresionController · 25 rutas</summary>

Fuente: [apps/api/src/impresion/impresion.controller.ts](../apps/api/src/impresion/impresion.controller.ts); declaración en línea 187.

Decoradores de clase: `@Permiso(   'produccion.ver',   'produccion.ejecutar',   'configuracion.ver',   'comercial.gestionar', )`, `@UseGuards(ImpresionDirectaGuard)`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/impresion/perfiles` | `configuracionPerfiles` | 201 |
| POST | `/impresion/destinos` | `crearDestino` | 211 |
| PUT | `/impresion/destinos/:id` | `editarDestino` | 219 |
| POST | `/impresion/destinos/:id/bandejas` | `crearBandeja` | 228 |
| PUT | `/impresion/destinos/:id/cad` | `guardarCad` | 237 |
| POST | `/impresion/destinos/:id/prueba-cad` | `pruebaCad` | 246 |
| POST | `/impresion/perfiles` | `crearPerfil` | 256 |
| PUT | `/impresion/perfiles/:id` | `editarPerfil` | 264 |
| POST | `/impresion/bandejas/:id/preparacion` | `prepararBandeja` | 273 |
| POST | `/impresion/perfiles/:id/prueba` | `pruebaPerfil` | 282 |
| GET | `/impresion/configuracion` | `configuracion` | 290 |
| POST | `/impresion/impresoras` | `impresoras` | 295 |
| POST | `/impresion/detalles-impresoras` | `detallesImpresoras` | 300 |
| POST | `/impresion/escuchar` | `escuchar` | 306 |
| POST | `/impresion/prueba-documento` | `pruebaDocumento` | 315 |
| GET | `/impresion/cola` | `cola` | 326 |
| POST | `/impresion/cola/liberar` | `liberarLote` | 335 |
| POST | `/impresion/ordenes/:id/cola` | `solicitar` | 348 |
| POST | `/impresion/ordenes/:id/liberar-impresion` | `liberar` | 356 |
| GET | `/impresion/ordenes/:id/documentos` | `vistaDocumentos` | 372 |
| POST | `/impresion/ordenes/:id/documentos/:itemId` | `prepararDocumento` | 381 |
| POST | `/impresion/ordenes/:id/envios/:intentoId` | `estadoDocumento` | 403 |
| POST | `/impresion/ordenes/:id/confirmacion-documentos` | `confirmarDocumentos` | 420 |
| GET | `/impresion/ordenes/:id/etiqueta` | `etiqueta` | 430 |
| POST | `/impresion/ordenes/:id/etiqueta` | `preparar` | 440 |

</details>

<details>
<summary>PerfilesCadController · 5 rutas</summary>

Fuente: [apps/api/src/impresion/perfiles-cad.controller.ts](../apps/api/src/impresion/perfiles-cad.controller.ts); declaración en línea 19.

Decoradores de clase: `@UseGuards(ImpresionDirectaGuard)`, `@Permiso('configuracion.gestionar')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/impresion/cad/destinos/:id/opciones` | `opciones` | 24 |
| POST | `/impresion/cad/perfiles` | `crear` | 31 |
| PUT | `/impresion/cad/perfiles/:id` | `editar` | 35 |
| POST | `/impresion/cad/perfiles/:id/prueba` | `prueba` | 43 |
| POST | `/impresion/cad/perfiles/:id/cotizar-muestra` | `cotizar` | 52 |

</details>

<details>
<summary>IntegracionesController · 8 rutas</summary>

Fuente: [apps/api/src/integraciones/integraciones.controller.ts](../apps/api/src/integraciones/integraciones.controller.ts); declaración en línea 29.

Decoradores de clase: `@Permiso('configuracion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/integraciones` | `listar` | 34 |
| GET | `/integraciones/wati/plantillas` | `plantillasWati` | 48 |
| POST | `/integraciones/wati/plantillas/:codigo/someter` | `someterPlantillaWati` | 54 |
| POST | `/integraciones/wati/probar-envio` | `probarEnvioWati` | 62 |
| GET | `/integraciones/:proveedor` | `obtener` | 69 |
| PUT | `/integraciones/wati` | `conectarWati` | 77 |
| POST | `/integraciones/:proveedor/probar` | `probar` | 88 |
| DELETE | `/integraciones/:proveedor` | `desconectar` | 100 |

</details>

<details>
<summary>NotificacionesController · 4 rutas</summary>

Fuente: [apps/api/src/integraciones/notificaciones/notificaciones.controller.ts](../apps/api/src/integraciones/notificaciones/notificaciones.controller.ts); declaración en línea 18.

Decoradores de clase: `@Permiso('configuracion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/integraciones/notificaciones` | `estado` | 23 |
| GET | `/integraciones/notificaciones/log` | `log` | 33 |
| PUT | `/integraciones/notificaciones/configuracion` | `cambiarConfiguracion` | 39 |
| PUT | `/integraciones/notificaciones/eventos/:evento` | `cambiarEvento` | 46 |

</details>

<details>
<summary>AutomaticosWebController · 6 rutas</summary>

Fuente: [apps/api/src/integraciones/whatsapp-web/automaticos.controller.ts](../apps/api/src/integraciones/whatsapp-web/automaticos.controller.ts); declaración en línea 24.

Decoradores de clase: `@Permiso('configuracion.gestionar')`, `@Roles(RolSistema.ADMINISTRADOR)`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/chrome-whatsapp/automaticos/estado` | `estado` | 29 |
| PUT | `/chrome-whatsapp/automaticos/configuracion` | `configurar` | 34 |
| POST | `/chrome-whatsapp/automaticos/prueba` | `prueba` | 41 |
| POST | `/chrome-whatsapp/automaticos/reservar` | `reservar` | 45 |
| POST | `/chrome-whatsapp/automaticos/:id/iniciar` | `iniciar` | 52 |
| POST | `/chrome-whatsapp/automaticos/:id/resultado` | `resultado` | 60 |

</details>

<details>
<summary>InventarioStockController · 14 rutas</summary>

Fuente: [apps/api/src/inventario/inventario-stock.controller.ts](../apps/api/src/inventario/inventario-stock.controller.ts); declaración en línea 24.

Decoradores de clase: `@Permiso('inventario.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/inventario/almacenes` | `getAlmacenes` | 29 |
| POST | `/inventario/almacenes` | `createAlmacen` | 34 |
| PUT | `/inventario/almacenes/:id` | `updateAlmacen` | 43 |
| PATCH | `/inventario/almacenes/:id/toggle` | `toggleAlmacen` | 53 |
| GET | `/inventario/almacenes/:almacenId/ubicaciones` | `getUbicaciones` | 59 |
| POST | `/inventario/almacenes/:almacenId/ubicaciones` | `createUbicacion` | 67 |
| PUT | `/inventario/ubicaciones/:id` | `updateUbicacion` | 77 |
| PATCH | `/inventario/ubicaciones/:id/toggle` | `toggleUbicacion` | 87 |
| POST | `/inventario/movimientos` | `registrarMovimiento` | 96 |
| POST | `/inventario/movimientos/transferencia` | `registrarTransferencia` | 105 |
| GET | `/inventario/stock` | `getStock` | 114 |
| GET | `/inventario/stock/pagina` | `getStockPage` | 122 |
| GET | `/inventario/stock/resumen-material/:id` | `getResumenMaterial` | 130 |
| GET | `/inventario/kardex` | `getKardex` | 138 |

</details>

<details>
<summary>InventarioController · 10 rutas</summary>

Fuente: [apps/api/src/inventario/inventario.controller.ts](../apps/api/src/inventario/inventario.controller.ts); declaración en línea 22.

Decoradores de clase: `@Permiso('inventario.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/inventario/materias-primas` | `findAll` | 30 |
| GET | `/inventario/materias-primas/biblioteca` | `listarBiblioteca` | 41 |
| GET | `/inventario/materias-primas/biblioteca/:key` | `obtenerBiblioteca` | 46 |
| POST | `/inventario/materias-primas/biblioteca/:key/instalar` | `instalarBiblioteca` | 54 |
| PATCH | `/inventario/materias-primas/costos` | `bulkUpdateCostos` | 65 |
| GET | `/inventario/materias-primas/:id` | `findOne` | 74 |
| POST | `/inventario/materias-primas` | `create` | 79 |
| PUT | `/inventario/materias-primas/:id` | `update` | 88 |
| PATCH | `/inventario/materias-primas/:id/toggle` | `toggle` | 98 |
| PATCH | `/inventario/materias-primas/variantes/:varianteId/precio-referencia` | `updateVariantePrecioReferencia` | 104 |

</details>

<details>
<summary>PrevisionMaterialesController · 1 rutas</summary>

Fuente: [apps/api/src/inventario/prevision-materiales.controller.ts](../apps/api/src/inventario/prevision-materiales.controller.ts); declaración en línea 7.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/inventario/prevision-materiales` | `consultar` | 10 |

</details>

<details>
<summary>ReservasMaterialController · 4 rutas</summary>

Fuente: [apps/api/src/inventario/reservas-material.controller.ts](../apps/api/src/inventario/reservas-material.controller.ts); declaración en línea 19.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/inventario/reservas/configuracion` | `politica` | 22 |
| PUT | `/inventario/reservas/configuracion` | `configurar` | 27 |
| GET | `/inventario/reservas/:varianteId` | `listar` | 35 |
| POST | `/ordenes-trabajo/:id/materiales/operaciones` | `ejecutar` | 45 |

</details>

<details>
<summary>MaquinariaController · 7 rutas</summary>

Fuente: [apps/api/src/maquinaria/maquinaria.controller.ts](../apps/api/src/maquinaria/maquinaria.controller.ts); declaración en línea 21.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/maquinaria` | `findAll` | 26 |
| GET | `/maquinaria/:id` | `findOne` | 34 |
| GET | `/maquinaria/:id/historial` | `historial` | 39 |
| POST | `/maquinaria` | `create` | 44 |
| PUT | `/maquinaria/:id` | `update` | 53 |
| PATCH | `/maquinaria/:id/activo` | `setActivo` | 63 |
| PATCH | `/maquinaria/:id/toggle` | `toggle` | 74 |

</details>

<details>
<summary>CredencialesMcpController · 3 rutas</summary>

Fuente: [apps/api/src/mcp/credenciales-mcp.controller.ts](../apps/api/src/mcp/credenciales-mcp.controller.ts); declaración en línea 21.

Decoradores de clase: `@Permiso('configuracion.gestionar')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/mcp/credenciales` | `listar` | 26 |
| POST | `/mcp/credenciales` | `crear` | 31 |
| DELETE | `/mcp/credenciales/:id` | `revocar` | 39 |

</details>

<details>
<summary>McpController · 3 rutas</summary>

Fuente: [apps/api/src/mcp/mcp.controller.ts](../apps/api/src/mcp/mcp.controller.ts); declaración en línea 32.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/mcp` | `handle` | 40 |
| GET | `/mcp` | `metodoNoPermitido` | 78 |
| DELETE | `/mcp` | `metodoNoPermitidoDelete` | 84 |

</details>

<details>
<summary>MotorUniversalController · 12 rutas</summary>

Fuente: [apps/api/src/motor-universal/motor.controller.ts](../apps/api/src/motor-universal/motor.controller.ts); declaración en línea 48.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('comercial.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/motor-universal/geometria-vectorial/normalizar` | `normalizarFuente` | 61 |
| POST | `/motor-universal/geometria-vectorial/medir` | `medirSvg` | 98 |
| POST | `/motor-universal/geometria-vectorial/preparar` | `prepararSvg` | 127 |
| POST | `/motor-universal/geometria-vectorial/analizar-asincrono` | `analizarSvgAsincrono` | 162 |
| GET | `/motor-universal/geometria-vectorial/trabajos/:id` | `consultarAnalisisSvg` | 199 |
| DELETE | `/motor-universal/geometria-vectorial/trabajos/:id` | `cancelarAnalisisSvg` | 210 |
| POST | `/motor-universal/geometria-vectorial/analizar` | `analizarSvg` | 227 |
| POST | `/motor-universal/cotizar` | `cotizar` | 302 |
| POST | `/motor-universal/cotizar-asincrono` | `cotizarAsincrono` | 331 |
| GET | `/motor-universal/cotizaciones-asincronas/:id` | `consultarCotizacionAsincrona` | 359 |
| POST | `/motor-universal/cotizar-y-guardar` | `cotizarYGuardar` | 379 |
| PATCH | `/motor-universal/cotizacion-items/:id/recotizar` | `recotizarItem` | 403 |

</details>

<details>
<summary>AccionesColaController · 2 rutas</summary>

Fuente: [apps/api/src/ordenes-trabajo/acciones-cola.controller.ts](../apps/api/src/ordenes-trabajo/acciones-cola.controller.ts); declaración en línea 17.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/produccion/colas/:maquinaId/pasos/:pasoId/accion` | `accion` | 21 |
| POST | `/produccion/colas/:maquinaId/completar` | `completar` | 33 |

</details>

<details>
<summary>AsignacionPersonalController · 3 rutas</summary>

Fuente: [apps/api/src/ordenes-trabajo/asignacion-personal.controller.ts](../apps/api/src/ordenes-trabajo/asignacion-personal.controller.ts); declaración en línea 18.

Decoradores de clase: `@Permiso('produccion.supervisar')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/ordenes-trabajo/tablero/pasos/:pasoId/asignacion-personal` | `contexto` | 23 |
| POST | `/ordenes-trabajo/tablero/pasos/:pasoId/asignacion-personal/simular` | `simular` | 31 |
| POST | `/ordenes-trabajo/tablero/pasos/:pasoId/asignacion-personal/confirmar` | `confirmar` | 40 |

</details>

<details>
<summary>OrdenesTrabajoController · 29 rutas</summary>

Fuente: [apps/api/src/ordenes-trabajo/ordenes-trabajo.controller.ts](../apps/api/src/ordenes-trabajo/ordenes-trabajo.controller.ts); declaración en línea 54.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('produccion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/ordenes-trabajo/track/:token` | `trackingPublico` | 69 |
| GET | `/ordenes-trabajo/track/:token/logo` | `logoPublico` | 80 |
| GET | `/ordenes-trabajo/track/:token/qr-retiro.png` | `qrRetiroPublico` | 100 |
| GET | `/ordenes-trabajo/track/:token/archivos/:archivoId` | `archivoPublico` | 123 |
| GET | `/ordenes-trabajo` | `findAll` | 141 |
| GET | `/ordenes-trabajo/tablero` | `tablero` | 156 |
| GET | `/ordenes-trabajo/tablero/terminados` | `tableroTerminados` | 161 |
| GET | `/ordenes-trabajo/tablero/items/:itemId` | `tableroItem` | 166 |
| GET | `/ordenes-trabajo/tablero/mis-tramos` | `misTramos` | 172 |
| PATCH | `/ordenes-trabajo/tablero/pasos/:pasoId/auto-pausa` | `autoPausa` | 178 |
| PATCH | `/ordenes-trabajo/tablero/pasos/:pasoId/mesa` | `mesaPaso` | 188 |
| PATCH | `/ordenes-trabajo/tablero/pasos/:pasoId/compra` | `avanzarCompra` | 199 |
| PATCH | `/ordenes-trabajo/tablero/pasos/:pasoId/gate` | `resolverGatePaso` | 214 |
| GET | `/ordenes-trabajo/:id` | `findOne` | 224 |
| GET | `/ordenes-trabajo/:id/materiales` | `materialesOrden` | 235 |
| GET | `/ordenes-trabajo/:id/pasos` | `pasosDeOrden` | 245 |
| POST | `/ordenes-trabajo` | `create` | 251 |
| PATCH | `/ordenes-trabajo/:id/lote` | `editarLote` | 260 |
| PATCH | `/ordenes-trabajo/:id` | `editar` | 270 |
| PATCH | `/ordenes-trabajo/:id/tratamiento-fiscal` | `setTratamientoFiscal` | 285 |
| POST | `/ordenes-trabajo/:id/items` | `agregarItem` | 299 |
| PATCH | `/ordenes-trabajo/:id/items/:itemId` | `editarItem` | 309 |
| DELETE | `/ordenes-trabajo/:id/items/:itemId` | `quitarItem` | 320 |
| PATCH | `/ordenes-trabajo/:id/items/:itemId/pasos/:pasoId` | `accionPaso` | 330 |
| POST | `/ordenes-trabajo/:id/cancelar` | `cancelar` | 353 |
| POST | `/ordenes-trabajo/escaneo` | `escanear` | 367 |
| POST | `/ordenes-trabajo/:id/entregar` | `entregar` | 375 |
| POST | `/ordenes-trabajo/:id/entregar/revertir` | `revertirEntrega` | 386 |
| PATCH | `/ordenes-trabajo/:id/estado` | `cambiarEstado` | 396 |

</details>

<details>
<summary>PanelGeneralController · 2 rutas</summary>

Fuente: [apps/api/src/panel-general/panel-general.controller.ts](../apps/api/src/panel-general/panel-general.controller.ts); declaración en línea 9.

Decoradores de clase: `@Permiso('panel.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/panel-general/actividad` | `listarActividad` | 17 |
| GET | `/panel-general` | `obtener` | 25 |

</details>

<details>
<summary>PlanificacionCotizacionController · 4 rutas</summary>

Fuente: [apps/api/src/planificacion-entregas/planificacion-cotizacion.controller.ts](../apps/api/src/planificacion-entregas/planificacion-cotizacion.controller.ts); declaración en línea 20.

Decoradores de clase: `@Permiso('comercial.gestionar')`, `@OcultaMargenes()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/cotizaciones/items/:itemId/planificacion-entregas` | `consultar` | 25 |
| POST | `/cotizaciones/items/:itemId/planificacion-entregas` | `solicitar` | 32 |
| POST | `/cotizaciones/items/:itemId/planificacion-entregas/reprogramar` | `reprogramar` | 40 |
| POST | `/cotizaciones/items/:itemId/planificacion-entregas/elegir` | `elegir` | 46 |

</details>

<details>
<summary>PlanificacionEntregasController · 6 rutas</summary>

Fuente: [apps/api/src/planificacion-entregas/planificacion.controller.ts](../apps/api/src/planificacion-entregas/planificacion.controller.ts); declaración en línea 22.

Decoradores de clase: `@Permiso('comercial.ver', 'produccion.ver')`, `@OcultaMargenes()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/ordenes-trabajo/items/:itemId/planificacion-entregas/lotes/:loteId` | `lote` | 27 |
| DELETE | `/ordenes-trabajo/items/:itemId/planificacion-entregas` | `eliminar` | 35 |
| GET | `/ordenes-trabajo/items/:itemId/planificacion-entregas` | `consultar` | 44 |
| POST | `/ordenes-trabajo/items/:itemId/planificacion-entregas` | `solicitar` | 51 |
| POST | `/ordenes-trabajo/items/:itemId/planificacion-entregas/reprogramar` | `reprogramar` | 60 |
| POST | `/ordenes-trabajo/items/:itemId/planificacion-entregas/elegir` | `elegir` | 66 |

</details>

<details>
<summary>EquipoPlataformaController · 7 rutas</summary>

Fuente: [apps/api/src/plataforma/equipo.controller.ts](../apps/api/src/plataforma/equipo.controller.ts); declaración en línea 57.

Decoradores de clase: `@SinTenant()`, `@UseGuards(PlataformaGuard)`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/plataforma/equipo/invitaciones` | `invitaciones` | 62 |
| POST | `/plataforma/equipo/invitaciones` | `invitar` | 67 |
| POST | `/plataforma/equipo/invitaciones/:id` | `gestionarInvitacion` | 74 |
| GET | `/plataforma/equipo` | `listar` | 85 |
| GET | `/plataforma/equipo/historial` | `historial` | 90 |
| POST | `/plataforma/equipo` | `agregar` | 95 |
| PUT | `/plataforma/equipo/:id` | `actualizar` | 101 |

</details>

<details>
<summary>PlataformaController · 17 rutas</summary>

Fuente: [apps/api/src/plataforma/plataforma.controller.ts](../apps/api/src/plataforma/plataforma.controller.ts); declaración en línea 153.

Decoradores de clase: `@UseGuards(PlataformaGuard)`, `@SinTenant()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/plataforma/contexto` | `contexto` | 164 |
| GET | `/plataforma/empresas` | `listarEmpresas` | 177 |
| GET | `/plataforma/empresas/:id` | `detalleEmpresa` | 182 |
| GET | `/plataforma/empresas/:id/historial` | `historialEmpresa` | 187 |
| GET | `/plataforma/empresas/:id/usuarios` | `usuariosEmpresa` | 195 |
| GET | `/plataforma/consola` | `consola` | 204 |
| GET | `/plataforma/negocio` | `negocioEcosistema` | 214 |
| GET | `/plataforma/planes` | `planes` | 219 |
| PUT | `/plataforma/planes/:id/descripcion` | `describirPlan` | 225 |
| PUT | `/plataforma/planes/:id/paddle` | `vincularPlanPaddle` | 236 |
| GET | `/plataforma/impersonacion` | `sesionesActivas` | 254 |
| POST | `/plataforma/impersonacion` | `iniciarImpersonacion` | 260 |
| POST | `/plataforma/impersonacion/:id/cerrar` | `cerrarImpersonacion` | 269 |
| PUT | `/plataforma/tenants/:id/plan` | `cambiarPlan` | 278 |
| POST | `/plataforma/tenants/:id/suspender` | `suspender` | 289 |
| POST | `/plataforma/tenants/:id/reactivar` | `reactivar` | 300 |
| POST | `/plataforma/tenants` | `crearTenant` | 312 |

</details>

<details>
<summary>SuscripcionesPlataformaController · 5 rutas</summary>

Fuente: [apps/api/src/plataforma/suscripciones-plataforma.controller.ts](../apps/api/src/plataforma/suscripciones-plataforma.controller.ts); declaración en línea 53.

Decoradores de clase: `@SinTenant()`, `@UseGuards(PlataformaGuard)`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/plataforma/suscripciones` | `listar` | 58 |
| GET | `/plataforma/suscripciones/:id` | `detalle` | 63 |
| GET | `/plataforma/suscripciones/:id/eventos` | `eventos` | 68 |
| GET | `/plataforma/suscripciones/:id/historial` | `historial` | 74 |
| POST | `/plataforma/suscripciones/:id/sincronizar` | `sincronizar` | 80 |

</details>

<details>
<summary>PresupuestosController · 16 rutas</summary>

Fuente: [apps/api/src/presupuestos/presupuestos.controller.ts](../apps/api/src/presupuestos/presupuestos.controller.ts); declaración en línea 38.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('comercial.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/presupuestos/track/:token` | `publico` | 51 |
| GET | `/presupuestos/track/:token/logo` | `logoPublico` | 57 |
| POST | `/presupuestos/track/:token/decision` | `decisionPublica` | 71 |
| GET | `/presupuestos/config` | `config` | 81 |
| PUT | `/presupuestos/config` | `actualizarConfig` | 87 |
| GET | `/presupuestos` | `listado` | 98 |
| POST | `/presupuestos/emitir` | `emitir` | 106 |
| GET | `/presupuestos/:id` | `detalle` | 115 |
| PATCH | `/presupuestos/:id/enviar` | `enviar` | 123 |
| PATCH | `/presupuestos/:id/resolver` | `resolver` | 132 |
| PATCH | `/presupuestos/:id/aprobacion` | `resolverAprobacion` | 144 |
| POST | `/presupuestos/:id/convertir` | `convertir` | 155 |
| GET | `/presupuestos/:id/pdf-piloto` | `pdfPiloto` | 166 |
| GET | `/presupuestos/:id/pdf` | `pdfPresupuesto` | 189 |
| GET | `/presupuestos/:id/pdf/estado` | `estadoPdf` | 201 |
| POST | `/presupuestos/:id/pdf/reintentar` | `reintentarPdf` | 212 |

</details>

<details>
<summary>ColasProduccionController · 3 rutas</summary>

Fuente: [apps/api/src/produccion/colas/colas.controller.ts](../apps/api/src/produccion/colas/colas.controller.ts); declaración en línea 19.

Decoradores de clase: `@Permiso('produccion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/produccion/colas/:maquinaId/simular-nesting` | `simular` | 27 |
| GET | `/produccion/colas` | `maquinas` | 37 |
| GET | `/produccion/colas/:maquinaId` | `listar` | 42 |

</details>

<details>
<summary>EquiposProduccionController · 3 rutas</summary>

Fuente: [apps/api/src/produccion/equipos-produccion.controller.ts](../apps/api/src/produccion/equipos-produccion.controller.ts); declaración en línea 16.

Decoradores de clase: `@Permiso('produccion.configurar')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/produccion/equipos` | `listar` | 21 |
| POST | `/produccion/equipos` | `crear` | 26 |
| PUT | `/produccion/equipos/:id` | `actualizar` | 31 |

</details>

<details>
<summary>ProduccionController · 14 rutas</summary>

Fuente: [apps/api/src/produccion/produccion.controller.ts](../apps/api/src/produccion/produccion.controller.ts); declaración en línea 20.

Decoradores de clase: `@Permiso('produccion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/produccion/estaciones` | `findEstaciones` | 25 |
| GET | `/produccion/estaciones-recursos` | `recursosEstaciones` | 31 |
| GET | `/produccion/familias-pasos` | `findFamiliasPasos` | 38 |
| GET | `/produccion/duraciones-familias` | `findDuracionesFamilias` | 47 |
| GET | `/produccion/estructura-bastidor/:itemId` | `estructuraBastidor` | 56 |
| GET | `/produccion/configuracion` | `getConfiguracion` | 66 |
| PUT | `/produccion/configuracion` | `actualizarConfiguracion` | 71 |
| GET | `/produccion/dias-no-laborables` | `findDiasNoLaborables` | 82 |
| POST | `/produccion/dias-no-laborables` | `crearDiaNoLaborable` | 87 |
| DELETE | `/produccion/dias-no-laborables/:id` | `eliminarDiaNoLaborable` | 96 |
| POST | `/produccion/estaciones` | `createEstacion` | 105 |
| PUT | `/produccion/estaciones/:id` | `updateEstacion` | 114 |
| PATCH | `/produccion/estaciones/:id/toggle` | `toggleEstacion` | 124 |
| DELETE | `/produccion/estaciones/:id` | `deleteEstacion` | 130 |

</details>

<details>
<summary>ExportarFabricacionController · 2 rutas</summary>

Fuente: [apps/api/src/productos-servicios/geometrias/exportar-fabricacion.controller.ts](../apps/api/src/productos-servicios/geometrias/exportar-fabricacion.controller.ts); declaración en línea 66.

Decoradores de clase: `@Permiso('comercial.ver', 'produccion.ver', 'costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/productos-servicios/geometrias/capas-fabricacion` | `capas` | 93 |
| POST | `/productos-servicios/geometrias/exportar-dxf` | `exportar` | 135 |

</details>

<details>
<summary>GeometriasProductoController · 3 rutas</summary>

Fuente: [apps/api/src/productos-servicios/geometrias/geometrias-producto.controller.ts](../apps/api/src/productos-servicios/geometrias/geometrias-producto.controller.ts); declaración en línea 77.

Decoradores de clase: `@Permiso('costos.gestionar', 'comercial.gestionar')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/productos-servicios/productos/:productoId/geometrias/interpretaciones-lote` | `guardarLote` | 117 |
| POST | `/productos-servicios/productos/:productoId/geometrias/inspeccionar` | `inspeccionar` | 176 |
| POST | `/productos-servicios/productos/:productoId/geometrias/interpretaciones` | `guardar` | 192 |

</details>

<details>
<summary>PrecioAplicacionesController · 8 rutas</summary>

Fuente: [apps/api/src/productos-servicios/precio/aplicaciones/precio-aplicaciones.controller.ts](../apps/api/src/productos-servicios/precio/aplicaciones/precio-aplicaciones.controller.ts); declaración en línea 41.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/productos-servicios/productos/:productoId/precio/impuestos` | `listarImpuestos` | 48 |
| PUT | `/productos-servicios/productos/:productoId/precio/impuestos` | `setImpuestos` | 56 |
| DELETE | `/productos-servicios/productos/:productoId/precio/impuestos/:impuestoCatalogoId` | `quitarImpuesto` | 66 |
| GET | `/productos-servicios/productos/:productoId/precio/categoria-fiscal` | `getCategoriaFiscal` | 83 |
| PUT | `/productos-servicios/productos/:productoId/precio/categoria-fiscal` | `setCategoriaFiscal` | 91 |
| GET | `/productos-servicios/productos/:productoId/precio/comisiones` | `listarComisiones` | 103 |
| PUT | `/productos-servicios/productos/:productoId/precio/comisiones` | `setComisiones` | 111 |
| DELETE | `/productos-servicios/productos/:productoId/precio/comisiones/:comisionCatalogoId` | `quitarComision` | 121 |

</details>

<details>
<summary>ComisionesCatalogoController · 5 rutas</summary>

Fuente: [apps/api/src/productos-servicios/precio/catalogos/comisiones-catalogo.controller.ts](../apps/api/src/productos-servicios/precio/catalogos/comisiones-catalogo.controller.ts); declaración en línea 32.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/productos-servicios/comisiones-catalogo` | `listar` | 37 |
| GET | `/productos-servicios/comisiones-catalogo/:id` | `obtener` | 46 |
| POST | `/productos-servicios/comisiones-catalogo` | `crear` | 51 |
| PATCH | `/productos-servicios/comisiones-catalogo/:id` | `actualizar` | 60 |
| DELETE | `/productos-servicios/comisiones-catalogo/:id` | `eliminar` | 70 |

</details>

<details>
<summary>ImpuestosCatalogoController · 5 rutas</summary>

Fuente: [apps/api/src/productos-servicios/precio/catalogos/impuestos-catalogo.controller.ts](../apps/api/src/productos-servicios/precio/catalogos/impuestos-catalogo.controller.ts); declaración en línea 36.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/productos-servicios/impuestos-catalogo` | `listar` | 41 |
| GET | `/productos-servicios/impuestos-catalogo/:id` | `obtener` | 50 |
| POST | `/productos-servicios/impuestos-catalogo` | `crear` | 55 |
| PATCH | `/productos-servicios/impuestos-catalogo/:id` | `actualizar` | 64 |
| DELETE | `/productos-servicios/impuestos-catalogo/:id` | `eliminar` | 74 |

</details>

<details>
<summary>PreciosEspecialesClientesController · 4 rutas</summary>

Fuente: [apps/api/src/productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.controller.ts](../apps/api/src/productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.controller.ts); declaración en línea 42.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/productos-servicios/productos/:productoId/precios-especiales` | `listar` | 47 |
| POST | `/productos-servicios/productos/:productoId/precios-especiales` | `crear` | 55 |
| PATCH | `/productos-servicios/precios-especiales/:id` | `actualizar` | 65 |
| DELETE | `/productos-servicios/precios-especiales/:id` | `eliminar` | 75 |

</details>

<details>
<summary>ProductosServiciosController · 53 rutas</summary>

Fuente: [apps/api/src/productos-servicios/productos-servicios.controller.ts](../apps/api/src/productos-servicios/productos-servicios.controller.ts); declaración en línea 75.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/productos-servicios/productos/:id/receta` | `obtenerReceta` | 85 |
| GET | `/productos-servicios/productos/:id/receta/estado-publicacion` | `obtenerEstadoPublicacionReceta` | 93 |
| GET | `/productos-servicios/recetas/revisiones/:revisionId/bom-multinivel` | `obtenerBomMultinivel` | 101 |
| POST | `/productos-servicios/productos/:id/receta/borrador` | `guardarBorradorReceta` | 109 |
| POST | `/productos-servicios/recetas/revisiones/:revisionId/publicar` | `publicarReceta` | 119 |
| DELETE | `/productos-servicios/recetas/revisiones/:revisionId/borrador` | `descartarBorradorReceta` | 129 |
| POST | `/productos-servicios/recetas/revisiones/:revisionId/deprecar` | `deprecarReceta` | 139 |
| GET | `/productos-servicios/catalogo-comercial` | `listarCatalogoComercial` | 149 |
| GET | `/productos-servicios/productos` | `listarProductos` | 154 |
| GET | `/productos-servicios/productos/:id` | `obtenerProducto` | 173 |
| GET | `/productos-servicios/productos/:id/validar` | `validarProducto` | 180 |
| GET | `/productos-servicios/productos/:id/formulario-cotizacion` | `formularioCotizacion` | 194 |
| POST | `/productos-servicios/productos` | `crearProducto` | 210 |
| PATCH | `/productos-servicios/productos/:id` | `actualizarProducto` | 222 |
| POST | `/productos-servicios/productos/:id/duplicar` | `duplicarProducto` | 235 |
| DELETE | `/productos-servicios/productos/:id` | `eliminarProducto` | 248 |
| GET | `/productos-servicios/rutas` | `listarRutas` | 257 |
| GET | `/productos-servicios/rutas/:id` | `obtenerRuta` | 267 |
| POST | `/productos-servicios/rutas` | `crearRuta` | 274 |
| PATCH | `/productos-servicios/rutas/:id` | `actualizarRuta` | 282 |
| POST | `/productos-servicios/rutas/:id/duplicar` | `duplicarRuta` | 295 |
| POST | `/productos-servicios/rutas/:id/migrar-productos` | `migrarProductosRuta` | 307 |
| DELETE | `/productos-servicios/rutas/:id` | `eliminarRuta` | 324 |
| POST | `/productos-servicios/productos/:productoId/rutas-alternativas` | `crearProductoRutaAlternativa` | 335 |
| PATCH | `/productos-servicios/productos/rutas-alternativas/:rutaAltId` | `actualizarProductoRutaAlternativa` | 348 |
| PATCH | `/productos-servicios/productos/rutas-alternativas/:rutaAltId/orden-pasos` | `reordenarPasosRutaAlternativa` | 365 |
| POST | `/productos-servicios/productos/rutas-alternativas/:rutaAltId/duplicar` | `duplicarProductoRutaAlternativa` | 378 |
| DELETE | `/productos-servicios/productos/rutas-alternativas/:rutaAltId` | `eliminarProductoRutaAlternativa` | 395 |
| POST | `/productos-servicios/productos/rutas-alternativas/:rutaAltId/config-pasos` | `upsertConfigPaso` | 408 |
| GET | `/productos-servicios/familias` | `listarFamilias` | 421 |
| GET | `/productos-servicios/pasos-tenant` | `listarPasosTenant` | 433 |
| GET | `/productos-servicios/pasos-tenant/plantillas` | `listarPlantillasPaso` | 442 |
| POST | `/productos-servicios/pasos-tenant` | `crearPasoTenant` | 448 |
| PATCH | `/productos-servicios/pasos-tenant/:id` | `actualizarPasoTenant` | 459 |
| PUT | `/productos-servicios/pasos-tenant/:id/configuracion-base` | `actualizarConfiguracionBasePasoTenant` | 471 |
| PUT | `/productos-servicios/familias/:codigo/configuracion-base` | `actualizarConfiguracionBaseFamiliaSistema` | 483 |
| DELETE | `/productos-servicios/pasos-tenant/:id` | `eliminarPasoTenant` | 499 |
| GET | `/productos-servicios/lookups-config-paso` | `listarLookupsConfigPaso` | 507 |
| GET | `/productos-servicios/materias-primas/buscar` | `buscarMateriasPrimas` | 514 |
| GET | `/productos-servicios/cargos-directos` | `listarCargosDirectos` | 545 |
| POST | `/productos-servicios/cargos-directos` | `crearCargoDirecto` | 555 |
| PATCH | `/productos-servicios/cargos-directos/:id` | `actualizarCargoDirecto` | 566 |
| DELETE | `/productos-servicios/cargos-directos/:id` | `eliminarCargoDirecto` | 578 |
| POST | `/productos-servicios/productos/:productoId/cargos-cotizacion` | `asociarCargoCotizacion` | 592 |
| PATCH | `/productos-servicios/productos/cargos-cotizacion/:asociacionId` | `actualizarCargoCotizacion` | 605 |
| DELETE | `/productos-servicios/productos/cargos-cotizacion/:asociacionId` | `desasociarCargoCotizacion` | 618 |
| POST | `/productos-servicios/productos/config-pasos/:configPasoId/cargos` | `asociarCargoPaso` | 631 |
| PATCH | `/productos-servicios/productos/config-pasos/cargos/:asociacionId` | `actualizarCargoPaso` | 644 |
| DELETE | `/productos-servicios/productos/config-pasos/cargos/:asociacionId` | `desasociarCargoPaso` | 657 |
| POST | `/productos-servicios/productos/config-pasos/cargos/:asociacionId/distribuir-niveles` | `distribuirCargoPasoPorNiveles` | 670 |
| POST | `/productos-servicios/productos/:productoId/pasos-extras` | `agregarPasoExtra` | 684 |
| PATCH | `/productos-servicios/productos/pasos-extras/:pasoExtraId` | `actualizarPasoExtra` | 697 |
| DELETE | `/productos-servicios/productos/pasos-extras/:pasoExtraId` | `eliminarPasoExtra` | 710 |

</details>

<details>
<summary>ProveedoresController · 8 rutas</summary>

Fuente: [apps/api/src/proveedores/proveedores.controller.ts](../apps/api/src/proveedores/proveedores.controller.ts); declaración en línea 25.

Decoradores de clase: `@Permiso('registros.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/proveedores` | `findAll` | 30 |
| GET | `/proveedores/opciones` | `opciones` | 38 |
| GET | `/proveedores/:id` | `findOne` | 43 |
| POST | `/proveedores` | `create` | 48 |
| POST | `/proveedores/importar` | `importar` | 57 |
| PUT | `/proveedores/:id` | `update` | 66 |
| PATCH | `/proveedores/:id/estado` | `estado` | 76 |
| DELETE | `/proveedores/:id` | `remove` | 86 |

</details>

<details>
<summary>PreparacionesRecorridoController · 7 rutas</summary>

Fuente: [apps/api/src/recorridos-vectoriales/preparaciones-recorrido.controller.ts](../apps/api/src/recorridos-vectoriales/preparaciones-recorrido.controller.ts); declaración en línea 21.

Decoradores de clase: `@Permiso('produccion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/recorridos-vectoriales/items/:itemId/corte/preparar` | `list` | 26 |
| GET | `/recorridos-vectoriales/items/:itemId/plantilla-instalacion` | `installationTemplate` | 40 |
| GET | `/recorridos-vectoriales/items/:itemId/plantilla-instalacion/descargar` | `downloadInstallationTemplate` | 54 |
| GET | `/recorridos-vectoriales/items/:itemId/plantilla-instalacion/archivos/:formato` | `downloadInstallationFile` | 81 |
| POST | `/recorridos-vectoriales/items/:itemId/corte/regenerar` | `regenerate` | 118 |
| PATCH | `/recorridos-vectoriales/revisiones/:revisionId/estado` | `state` | 133 |
| GET | `/recorridos-vectoriales/revisiones/:revisionId/:format` | `download` | 144 |

</details>

<details>
<summary>RegistroController · 6 rutas</summary>

Fuente: [apps/api/src/registro/registro.controller.ts](../apps/api/src/registro/registro.controller.ts); declaración en línea 13.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/registro/planes` | `planes` | 17 |
| POST | `/registro` | `iniciar` | 23 |
| GET | `/registro/verificar/:token` | `estado` | 30 |
| POST | `/registro/completar` | `completar` | 37 |
| POST | `/registro/completar-existente` | `completarExistente` | 44 |
| POST | `/registro/onboarding/completar` | `completarOnboarding` | 55 |

</details>

<details>
<summary>ReportesController · 13 rutas</summary>

Fuente: [apps/api/src/reportes/reportes.controller.ts](../apps/api/src/reportes/reportes.controller.ts); declaración en línea 32.

Decoradores de clase: `@OcultaMargenes()`, `@Permiso('reportes.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/reportes/panel/resumen` | `resumen` | 56 |
| GET | `/reportes/panel/comercial` | `comercial` | 103 |
| GET | `/reportes/panel/embudo` | `embudo` | 118 |
| GET | `/reportes/panel/finanzas` | `finanzas` | 142 |
| GET | `/reportes/panel/produccion` | `produccion` | 173 |
| GET | `/reportes/panel/alertas` | `alertasActivas` | 185 |
| GET | `/reportes/panel/producto` | `producto` | 195 |
| GET | `/reportes/panel/producto/mix-categoria` | `mixCategoria` | 208 |
| GET | `/reportes/panel/clientes` | `clientes` | 218 |
| GET | `/reportes/panel/equipo` | `equipo` | 232 |
| GET | `/reportes/panel/salud-eta` | `saludEta` | 250 |
| GET | `/reportes/panel/umbrales` | `getUmbrales` | 268 |
| PUT | `/reportes/panel/umbrales` | `actualizarUmbrales` | 273 |

</details>

<details>
<summary>SuscripcionController · 8 rutas</summary>

Fuente: [apps/api/src/suscripciones/suscripcion.controller.ts](../apps/api/src/suscripciones/suscripcion.controller.ts); declaración en línea 47.

Decoradores de clase: `@Permiso('configuracion.ver')`, `@PermitirSuscripcionInactiva()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/suscripcion` | `estado` | 53 |
| POST | `/suscripcion/actualizar-estado` | `actualizarEstado` | 64 |
| POST | `/suscripcion/cambiar-plan` | `cambiarPlan` | 79 |
| POST | `/suscripcion/cambiar-plan/previsualizar` | `previsualizar` | 96 |
| POST | `/suscripcion/sincronizar` | `sincronizar` | 115 |
| GET | `/suscripcion/facturas/:id/pdf` | `facturaPdf` | 134 |
| POST | `/suscripcion/reactivar` | `reactivar` | 147 |
| POST | `/suscripcion/portal` | `portal` | 160 |

</details>

<details>
<summary>TenantsController · 7 rutas</summary>

Fuente: [apps/api/src/tenants/tenants.controller.ts](../apps/api/src/tenants/tenants.controller.ts); declaración en línea 20.

Decoradores de clase: `@SoloAutenticado()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/tenants/logo` | `logo` | 31 |
| PUT | `/tenants/logo` | `definirLogo` | 37 |
| DELETE | `/tenants/logo` | `quitarLogo` | 47 |
| GET | `/tenants/empresa` | `datosEmpresa` | 62 |
| PUT | `/tenants/empresa` | `guardarDatosEmpresa` | 68 |
| GET | `/tenants/current` | `getCurrent` | 78 |
| POST | `/tenants/switch` | `switchTenant` | 83 |

</details>

<details>
<summary>UsuariosController · 14 rutas</summary>

Fuente: [apps/api/src/usuarios/usuarios.controller.ts](../apps/api/src/usuarios/usuarios.controller.ts); declaración en línea 39.

Decoradores de clase: `@Permiso('configuracion.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/usuarios` | `listar` | 44 |
| GET | `/usuarios/mi-ip` | `miIp` | 53 |
| GET | `/usuarios/sesiones` | `sesiones` | 68 |
| GET | `/usuarios/historial` | `historial` | 74 |
| GET | `/usuarios/roles` | `roles` | 81 |
| GET | `/usuarios/catalogo` | `catalogo` | 90 |
| POST | `/usuarios/roles` | `crearRol` | 95 |
| PATCH | `/usuarios/roles/:rolId` | `editarRol` | 101 |
| DELETE | `/usuarios/roles/:rolId` | `eliminarRol` | 111 |
| POST | `/usuarios` | `crear` | 123 |
| PATCH | `/usuarios/:userId` | `editar` | 129 |
| POST | `/usuarios/:userId/password` | `restablecerPassword` | 144 |
| PUT | `/usuarios/:userId/ips` | `cambiarIps` | 157 |
| POST | `/usuarios/:userId/cerrar-sesiones` | `cerrarSesiones` | 169 |

</details>

<details>
<summary>WebhooksWhatsappController · 2 rutas</summary>

Fuente: [apps/api/src/webhooks-whatsapp/webhooks-whatsapp.controller.ts](../apps/api/src/webhooks-whatsapp/webhooks-whatsapp.controller.ts); declaración en línea 30.

Decoradores de clase: `@Public()`, `@SinTenant()`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/webhooks/whatsapp` | `verificar` | 43 |
| POST | `/webhooks/whatsapp` | `recibir` | 69 |

</details>

<details>
<summary>PreparacionesNestingController · 2 rutas</summary>

Fuente: [apps/api/src/workers/cotizacion/preparaciones-nesting.controller.ts](../apps/api/src/workers/cotizacion/preparaciones-nesting.controller.ts); declaración en línea 38.

Decoradores de clase: `@Permiso('costos.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| GET | `/productos-servicios/productos/:productoId/nestings` | `listar` | 43 |
| POST | `/productos-servicios/productos/:productoId/nestings` | `preparar` | 51 |

</details>

<details>
<summary>GeometriaJobsController · 3 rutas</summary>

Fuente: [apps/api/src/workers/geometria/geometria-jobs.controller.ts](../apps/api/src/workers/geometria/geometria-jobs.controller.ts); declaración en línea 22.

Decoradores de clase: `@Permiso('comercial.ver')`.

| Verbo | Ruta declarada | Método | Línea |
|---|---|---|---:|
| POST | `/trabajos-geometria/nesting-irregular` | `crear` | 27 |
| GET | `/trabajos-geometria/:id` | `consultar` | 36 |
| DELETE | `/trabajos-geometria/:id` | `cancelar` | 41 |

</details>

## 2. Procesos de fondo

| Fuente | Entrada | Mecanismo declarado | Línea |
|---|---|---|---:|
| [apps/api/src/administracion/acreditaciones.scheduler.ts](../apps/api/src/administracion/acreditaciones.scheduler.ts) | `acreditarVencidos` | @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'acreditar-cobros-vencidos' }) | 29 |
| [apps/api/src/archivos/archivos.scheduler.ts](../apps/api/src/archivos/archivos.scheduler.ts) | `higiene` | @Cron('0 4 * * *', { name: 'higiene-archivos' }) | 30 |
| [apps/api/src/auth/sesiones.scheduler.ts](../apps/api/src/auth/sesiones.scheduler.ts) | `higiene` | @Cron('30 4 * * *', { name: 'higiene-sesiones' }) | 34 |
| [apps/api/src/documentos-pdf/documentos-pdf.worker.ts](../apps/api/src/documentos-pdf/documentos-pdf.worker.ts) | `DocumentosPdfWorker` | @Injectable() | 35 |
| [apps/api/src/egresos/recurrentes.scheduler.ts](../apps/api/src/egresos/recurrentes.scheduler.ts) | `emitir` | @Cron('15 5 * * *', { name: 'emitir-gastos-recurrentes' }) | 30 |
| [apps/api/src/eta/eta-snapshot.scheduler.ts](../apps/api/src/eta/eta-snapshot.scheduler.ts) | `asignarPersonal` | @Cron('*/30 * * * * *', { name: 'produccion-asignacion-personal' }) | 30 |
| [apps/api/src/eta/eta-snapshot.scheduler.ts](../apps/api/src/eta/eta-snapshot.scheduler.ts) | `snapshotDiario` | @Cron('0 9 * * *', { name: 'eta-snapshot-diario' }) | 50 |
| [apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts](../apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts) | `drenar` | @Cron('*/5 * * * *', { name: 'notificaciones-whatsapp' }) | 50 |
| [apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts](../apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts) | `pedirResenas` | @Cron('0 10 * * *', { name: 'notificaciones-resenas' }) | 93 |
| [apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts](../apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts) | `recordarPresupuestos` | @Cron('15 10 * * *', { name: 'notificaciones-presupuestos-por-vencer' }) | 118 |
| [apps/api/src/integraciones/wati/wati.scheduler.ts](../apps/api/src/integraciones/wati/wati.scheduler.ts) | `sincronizarPlantillas` | @Cron('*/15 * * * *', { name: 'wati-plantillas' }) | 41 |
| [apps/api/src/planificacion-entregas/planificacion.worker.ts](../apps/api/src/planificacion-entregas/planificacion.worker.ts) | `PlanificacionEntregasWorker` | @Injectable() | 21 |
| [apps/api/src/suscripciones/suscripcion-reconciliacion.scheduler.ts](../apps/api/src/suscripciones/suscripcion-reconciliacion.scheduler.ts) | `ejecutar` | @Cron(CronExpression.EVERY_10_MINUTES, {     name: 'reconciliar-suscripciones-paddle',   }) | 27 |
| [apps/api/src/suscripciones/trial.scheduler.ts](../apps/api/src/suscripciones/trial.scheduler.ts) | `cerrarVencidas` | @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'cerrar-pruebas-vencidas' }) | 26 |
| [apps/api/src/workers/cotizacion/cotizacion.worker.ts](../apps/api/src/workers/cotizacion/cotizacion.worker.ts) | `CotizacionWorker` | @Injectable() | 25 |
| [apps/api/src/workers/geometria/geometria.worker.ts](../apps/api/src/workers/geometria/geometria.worker.ts) | `GeometriaWorker` | @Injectable() | 37 |

## 3. Páginas y handlers Next

| Archivo | Tipo |
|---|---|
| [src/app/(dashboard)/administracion/cobros/nuevo/page.tsx](../src/app/%28dashboard%29/administracion/cobros/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/administracion/comprobantes/[comprobanteId]/factura/page.tsx](../src/app/%28dashboard%29/administracion/comprobantes/%5BcomprobanteId%5D/factura/page.tsx) | Página |
| [src/app/(dashboard)/administracion/comprobantes/[comprobanteId]/page.tsx](../src/app/%28dashboard%29/administracion/comprobantes/%5BcomprobanteId%5D/page.tsx) | Página |
| [src/app/(dashboard)/administracion/comprobantes/nuevo/page.tsx](../src/app/%28dashboard%29/administracion/comprobantes/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/administracion/comprobantes/page.tsx](../src/app/%28dashboard%29/administracion/comprobantes/page.tsx) | Página |
| [src/app/(dashboard)/administracion/cuentas-por-pagar/page.tsx](../src/app/%28dashboard%29/administracion/cuentas-por-pagar/page.tsx) | Página |
| [src/app/(dashboard)/administracion/datos-fiscales/page.tsx](../src/app/%28dashboard%29/administracion/datos-fiscales/page.tsx) | Página |
| [src/app/(dashboard)/administracion/deudores/page.tsx](../src/app/%28dashboard%29/administracion/deudores/page.tsx) | Página |
| [src/app/(dashboard)/administracion/egresos/page.tsx](../src/app/%28dashboard%29/administracion/egresos/page.tsx) | Página |
| [src/app/(dashboard)/administracion/facturacion/page.tsx](../src/app/%28dashboard%29/administracion/facturacion/page.tsx) | Página |
| [src/app/(dashboard)/administracion/gastos-fijos/page.tsx](../src/app/%28dashboard%29/administracion/gastos-fijos/page.tsx) | Página |
| [src/app/(dashboard)/administracion/metodos-pago/page.tsx](../src/app/%28dashboard%29/administracion/metodos-pago/page.tsx) | Página |
| [src/app/(dashboard)/administracion/tesoreria/acreditaciones/page.tsx](../src/app/%28dashboard%29/administracion/tesoreria/acreditaciones/page.tsx) | Página |
| [src/app/(dashboard)/administracion/tesoreria/page.tsx](../src/app/%28dashboard%29/administracion/tesoreria/page.tsx) | Página |
| [src/app/(dashboard)/clientes/[clienteId]/cuenta-corriente/page.tsx](../src/app/%28dashboard%29/clientes/%5BclienteId%5D/cuenta-corriente/page.tsx) | Página |
| [src/app/(dashboard)/clientes/[clienteId]/page.tsx](../src/app/%28dashboard%29/clientes/%5BclienteId%5D/page.tsx) | Página |
| [src/app/(dashboard)/clientes/nuevo/page.tsx](../src/app/%28dashboard%29/clientes/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/clientes/page.tsx](../src/app/%28dashboard%29/clientes/page.tsx) | Página |
| [src/app/(dashboard)/comercial/campanas/[campanaId]/page.tsx](../src/app/%28dashboard%29/comercial/campanas/%5BcampanaId%5D/page.tsx) | Página |
| [src/app/(dashboard)/comercial/campanas/page.tsx](../src/app/%28dashboard%29/comercial/campanas/page.tsx) | Página |
| [src/app/(dashboard)/comercial/crear-propuesta/page.tsx](../src/app/%28dashboard%29/comercial/crear-propuesta/page.tsx) | Página |
| [src/app/(dashboard)/comercial/cupones/page.tsx](../src/app/%28dashboard%29/comercial/cupones/page.tsx) | Página |
| [src/app/(dashboard)/comercial/presupuestos/[presupuestoId]/page.tsx](../src/app/%28dashboard%29/comercial/presupuestos/%5BpresupuestoId%5D/page.tsx) | Página |
| [src/app/(dashboard)/comercial/presupuestos/[presupuestoId]/pdf/page.tsx](../src/app/%28dashboard%29/comercial/presupuestos/%5BpresupuestoId%5D/pdf/page.tsx) | Página |
| [src/app/(dashboard)/comercial/presupuestos/page.tsx](../src/app/%28dashboard%29/comercial/presupuestos/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/almacenamiento/page.tsx](../src/app/%28dashboard%29/configuracion/almacenamiento/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/centro-copiado/page.tsx](../src/app/%28dashboard%29/configuracion/centro-copiado/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/comisiones/page.tsx](../src/app/%28dashboard%29/configuracion/comisiones/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/datos-fiscales/page.tsx](../src/app/%28dashboard%29/configuracion/datos-fiscales/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/empresa/page.tsx](../src/app/%28dashboard%29/configuracion/empresa/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/impresoras/page.tsx](../src/app/%28dashboard%29/configuracion/impresoras/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/impuestos/page.tsx](../src/app/%28dashboard%29/configuracion/impuestos/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/integraciones/page.tsx](../src/app/%28dashboard%29/configuracion/integraciones/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/metodos-pago/page.tsx](../src/app/%28dashboard%29/configuracion/metodos-pago/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/page.tsx](../src/app/%28dashboard%29/configuracion/page.tsx) | Página |
| [src/app/(dashboard)/configuracion/usuarios/page.tsx](../src/app/%28dashboard%29/configuracion/usuarios/page.tsx) | Página |
| [src/app/(dashboard)/costos/centros-de-costo/page.tsx](../src/app/%28dashboard%29/costos/centros-de-costo/page.tsx) | Página |
| [src/app/(dashboard)/costos/gastos-fijos/page.tsx](../src/app/%28dashboard%29/costos/gastos-fijos/page.tsx) | Página |
| [src/app/(dashboard)/costos/maquinaria/[maquinaId]/page.tsx](../src/app/%28dashboard%29/costos/maquinaria/%5BmaquinaId%5D/page.tsx) | Página |
| [src/app/(dashboard)/costos/maquinaria/nueva/page.tsx](../src/app/%28dashboard%29/costos/maquinaria/nueva/page.tsx) | Página |
| [src/app/(dashboard)/costos/maquinaria/page.tsx](../src/app/%28dashboard%29/costos/maquinaria/page.tsx) | Página |
| [src/app/(dashboard)/crm/clientes/[clienteId]/cuenta-corriente/page.tsx](../src/app/%28dashboard%29/crm/clientes/%5BclienteId%5D/cuenta-corriente/page.tsx) | Página |
| [src/app/(dashboard)/crm/clientes/[clienteId]/page.tsx](../src/app/%28dashboard%29/crm/clientes/%5BclienteId%5D/page.tsx) | Página |
| [src/app/(dashboard)/crm/clientes/nuevo/page.tsx](../src/app/%28dashboard%29/crm/clientes/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/crm/clientes/page.tsx](../src/app/%28dashboard%29/crm/clientes/page.tsx) | Página |
| [src/app/(dashboard)/crm/cupones/page.tsx](../src/app/%28dashboard%29/crm/cupones/page.tsx) | Página |
| [src/app/(dashboard)/crm/fidelizacion/page.tsx](../src/app/%28dashboard%29/crm/fidelizacion/page.tsx) | Página |
| [src/app/(dashboard)/empleados/[empleadoId]/page.tsx](../src/app/%28dashboard%29/empleados/%5BempleadoId%5D/page.tsx) | Página |
| [src/app/(dashboard)/empleados/nuevo/page.tsx](../src/app/%28dashboard%29/empleados/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/empleados/page.tsx](../src/app/%28dashboard%29/empleados/page.tsx) | Página |
| [src/app/(dashboard)/inventario/centro-stock/page.tsx](../src/app/%28dashboard%29/inventario/centro-stock/page.tsx) | Página |
| [src/app/(dashboard)/inventario/compras/page.tsx](../src/app/%28dashboard%29/inventario/compras/page.tsx) | Página |
| [src/app/(dashboard)/inventario/materias-primas/[materiaPrimaId]/page.tsx](../src/app/%28dashboard%29/inventario/materias-primas/%5BmateriaPrimaId%5D/page.tsx) | Página |
| [src/app/(dashboard)/inventario/materias-primas/biblioteca/page.tsx](../src/app/%28dashboard%29/inventario/materias-primas/biblioteca/page.tsx) | Página |
| [src/app/(dashboard)/inventario/materias-primas/costos/page.tsx](../src/app/%28dashboard%29/inventario/materias-primas/costos/page.tsx) | Página |
| [src/app/(dashboard)/inventario/materias-primas/page.tsx](../src/app/%28dashboard%29/inventario/materias-primas/page.tsx) | Página |
| [src/app/(dashboard)/inventario/movimientos/page.tsx](../src/app/%28dashboard%29/inventario/movimientos/page.tsx) | Página |
| [src/app/(dashboard)/inventario/page.tsx](../src/app/%28dashboard%29/inventario/page.tsx) | Página |
| [src/app/(dashboard)/page.tsx](../src/app/%28dashboard%29/page.tsx) | Página |
| [src/app/(dashboard)/produccion/colas/page.tsx](../src/app/%28dashboard%29/produccion/colas/page.tsx) | Página |
| [src/app/(dashboard)/produccion/estaciones/page.tsx](../src/app/%28dashboard%29/produccion/estaciones/page.tsx) | Página |
| [src/app/(dashboard)/produccion/eta/page.tsx](../src/app/%28dashboard%29/produccion/eta/page.tsx) | Página |
| [src/app/(dashboard)/produccion/ordenes/[ordenId]/page.tsx](../src/app/%28dashboard%29/produccion/ordenes/%5BordenId%5D/page.tsx) | Página |
| [src/app/(dashboard)/produccion/ordenes/page.tsx](../src/app/%28dashboard%29/produccion/ordenes/page.tsx) | Página |
| [src/app/(dashboard)/produccion/planificacion/page.tsx](../src/app/%28dashboard%29/produccion/planificacion/page.tsx) | Página |
| [src/app/(dashboard)/produccion/tablero/page.tsx](../src/app/%28dashboard%29/produccion/tablero/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/[productoId]/cargos/page.tsx](../src/app/%28dashboard%29/productos-servicios/%5BproductoId%5D/cargos/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/[productoId]/editar/page.tsx](../src/app/%28dashboard%29/productos-servicios/%5BproductoId%5D/editar/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/[productoId]/page.tsx](../src/app/%28dashboard%29/productos-servicios/%5BproductoId%5D/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/[productoId]/rutas/[rutaAltId]/page.tsx](../src/app/%28dashboard%29/productos-servicios/%5BproductoId%5D/rutas/%5BrutaAltId%5D/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/[productoId]/rutas/page.tsx](../src/app/%28dashboard%29/productos-servicios/%5BproductoId%5D/rutas/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/[productoId]/wizard/page.tsx](../src/app/%28dashboard%29/productos-servicios/%5BproductoId%5D/wizard/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/cargos-directos/page.tsx](../src/app/%28dashboard%29/productos-servicios/cargos-directos/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/comisiones-catalogo/page.tsx](../src/app/%28dashboard%29/productos-servicios/comisiones-catalogo/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/impuestos-catalogo/page.tsx](../src/app/%28dashboard%29/productos-servicios/impuestos-catalogo/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/nuevo/page.tsx](../src/app/%28dashboard%29/productos-servicios/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/page.tsx](../src/app/%28dashboard%29/productos-servicios/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/pasos/[pasoId]/page.tsx](../src/app/%28dashboard%29/productos-servicios/pasos/%5BpasoId%5D/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/pasos/page.tsx](../src/app/%28dashboard%29/productos-servicios/pasos/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/rutas/[rutaId]/page.tsx](../src/app/%28dashboard%29/productos-servicios/rutas/%5BrutaId%5D/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/rutas/nueva/page.tsx](../src/app/%28dashboard%29/productos-servicios/rutas/nueva/page.tsx) | Página |
| [src/app/(dashboard)/productos-servicios/rutas/page.tsx](../src/app/%28dashboard%29/productos-servicios/rutas/page.tsx) | Página |
| [src/app/(dashboard)/proveedores/[proveedorId]/page.tsx](../src/app/%28dashboard%29/proveedores/%5BproveedorId%5D/page.tsx) | Página |
| [src/app/(dashboard)/proveedores/nuevo/page.tsx](../src/app/%28dashboard%29/proveedores/nuevo/page.tsx) | Página |
| [src/app/(dashboard)/proveedores/page.tsx](../src/app/%28dashboard%29/proveedores/page.tsx) | Página |
| [src/app/(dashboard)/reportes/clientes/page.tsx](../src/app/%28dashboard%29/reportes/clientes/page.tsx) | Página |
| [src/app/(dashboard)/reportes/comercial/page.tsx](../src/app/%28dashboard%29/reportes/comercial/page.tsx) | Página |
| [src/app/(dashboard)/reportes/embudo/page.tsx](../src/app/%28dashboard%29/reportes/embudo/page.tsx) | Página |
| [src/app/(dashboard)/reportes/equipo/page.tsx](../src/app/%28dashboard%29/reportes/equipo/page.tsx) | Página |
| [src/app/(dashboard)/reportes/finanzas/page.tsx](../src/app/%28dashboard%29/reportes/finanzas/page.tsx) | Página |
| [src/app/(dashboard)/reportes/page.tsx](../src/app/%28dashboard%29/reportes/page.tsx) | Página |
| [src/app/(dashboard)/reportes/produccion/page.tsx](../src/app/%28dashboard%29/reportes/produccion/page.tsx) | Página |
| [src/app/(dashboard)/reportes/producto/page.tsx](../src/app/%28dashboard%29/reportes/producto/page.tsx) | Página |
| [src/app/(dashboard)/reportes/resumen/page.tsx](../src/app/%28dashboard%29/reportes/resumen/page.tsx) | Página |
| [src/app/(dashboard)/reportes/salud-eta/page.tsx](../src/app/%28dashboard%29/reportes/salud-eta/page.tsx) | Página |
| [src/app/(dashboard)/suscripcion/page.tsx](../src/app/%28dashboard%29/suscripcion/page.tsx) | Página |
| [src/app/a/[token]/page.tsx](../src/app/a/%5Btoken%5D/page.tsx) | Página |
| [src/app/aceptar-invitacion/page.tsx](../src/app/aceptar-invitacion/page.tsx) | Página |
| [src/app/api/backend/[...path]/route.ts](../src/app/api/backend/%5B...path%5D/route.ts) | Handler |
| [src/app/api/session/route.ts](../src/app/api/session/route.ts) | Handler |
| [src/app/backoffice/invitacion/page.tsx](../src/app/backoffice/invitacion/page.tsx) | Página |
| [src/app/backoffice/page.tsx](../src/app/backoffice/page.tsx) | Página |
| [src/app/backoffice/seguridad/page.tsx](../src/app/backoffice/seguridad/page.tsx) | Página |
| [src/app/bienvenida/page.tsx](../src/app/bienvenida/page.tsx) | Página |
| [src/app/c/[token]/page.tsx](../src/app/c/%5Btoken%5D/page.tsx) | Página |
| [src/app/cambiar-clave/page.tsx](../src/app/cambiar-clave/page.tsx) | Página |
| [src/app/dev/diseno/botones/page.tsx](../src/app/dev/diseno/botones/page.tsx) | Página |
| [src/app/dev/diseno/carga/page.tsx](../src/app/dev/diseno/carga/page.tsx) | Página |
| [src/app/dev/diseno/componentes/page.tsx](../src/app/dev/diseno/componentes/page.tsx) | Página |
| [src/app/dev/diseno/orden/page.tsx](../src/app/dev/diseno/orden/page.tsx) | Página |
| [src/app/dev/diseno/sheets/page.tsx](../src/app/dev/diseno/sheets/page.tsx) | Página |
| [src/app/f/[token]/page.tsx](../src/app/f/%5Btoken%5D/page.tsx) | Página |
| [src/app/login/page.tsx](../src/app/login/page.tsx) | Página |
| [src/app/p/[token]/page.tsx](../src/app/p/%5Btoken%5D/page.tsx) | Página |
| [src/app/plataforma/page.tsx](../src/app/plataforma/page.tsx) | Página |
| [src/app/presupuesto/[token]/page.tsx](../src/app/presupuesto/%5Btoken%5D/page.tsx) | Página |
| [src/app/privacidad/page.tsx](../src/app/privacidad/page.tsx) | Página |
| [src/app/registro/page.tsx](../src/app/registro/page.tsx) | Página |
| [src/app/registro/verificar/page.tsx](../src/app/registro/verificar/page.tsx) | Página |
| [src/app/salir/route.ts](../src/app/salir/route.ts) | Handler |
| [src/app/t/[token]/page.tsx](../src/app/t/%5Btoken%5D/page.tsx) | Página |
| [src/app/terminos/page.tsx](../src/app/terminos/page.tsx) | Página |
| [src/app/track/[token]/page.tsx](../src/app/track/%5Btoken%5D/page.tsx) | Página |

## 4. Módulos Nest

| Módulo | Fuente |
|---|---|
| AdministracionModule | [apps/api/src/administracion/administracion.module.ts](../apps/api/src/administracion/administracion.module.ts) |
| AppModule | [apps/api/src/app.module.ts](../apps/api/src/app.module.ts) |
| ArchivosModule | [apps/api/src/archivos/archivos.module.ts](../apps/api/src/archivos/archivos.module.ts) |
| StorageModule | [apps/api/src/archivos/storage/storage.module.ts](../apps/api/src/archivos/storage/storage.module.ts) |
| AuthModule | [apps/api/src/auth/auth.module.ts](../apps/api/src/auth/auth.module.ts) |
| CampanasModule | [apps/api/src/campanas/campanas.module.ts](../apps/api/src/campanas/campanas.module.ts) |
| CatalogoCadModule | [apps/api/src/centro-copiado/catalogo-cad.module.ts](../apps/api/src/centro-copiado/catalogo-cad.module.ts) |
| CentroCopiadoModule | [apps/api/src/centro-copiado/centro-copiado.module.ts](../apps/api/src/centro-copiado/centro-copiado.module.ts) |
| ClientesModule | [apps/api/src/clientes/clientes.module.ts](../apps/api/src/clientes/clientes.module.ts) |
| CobroModule | [apps/api/src/cobro/cobro.module.ts](../apps/api/src/cobro/cobro.module.ts) |
| ComprasModule | [apps/api/src/compras/compras.module.ts](../apps/api/src/compras/compras.module.ts) |
| CostosModule | [apps/api/src/costos/costos.module.ts](../apps/api/src/costos/costos.module.ts) |
| CotizacionesModule | [apps/api/src/cotizaciones/cotizaciones.module.ts](../apps/api/src/cotizaciones/cotizaciones.module.ts) |
| CuponesModule | [apps/api/src/cupones/cupones.module.ts](../apps/api/src/cupones/cupones.module.ts) |
| DesarrolloDocumentalModule | [apps/api/src/desarrollo-documental/desarrollo-documental.module.ts](../apps/api/src/desarrollo-documental/desarrollo-documental.module.ts) |
| DocumentosPdfModule | [apps/api/src/documentos-pdf/documentos-pdf.module.ts](../apps/api/src/documentos-pdf/documentos-pdf.module.ts) |
| DocumentosWorkerModule | [apps/api/src/documentos-pdf/documentos-worker.module.ts](../apps/api/src/documentos-pdf/documentos-worker.module.ts) |
| EgresosModule | [apps/api/src/egresos/egresos.module.ts](../apps/api/src/egresos/egresos.module.ts) |
| EmpleadosModule | [apps/api/src/empleados/empleados.module.ts](../apps/api/src/empleados/empleados.module.ts) |
| EnlacesPublicosModule | [apps/api/src/enlaces-publicos/enlaces-publicos.module.ts](../apps/api/src/enlaces-publicos/enlaces-publicos.module.ts) |
| EtaCalculoModule | [apps/api/src/eta/eta-calculo.module.ts](../apps/api/src/eta/eta-calculo.module.ts) |
| EtaModule | [apps/api/src/eta/eta.module.ts](../apps/api/src/eta/eta.module.ts) |
| EventosSistemaModule | [apps/api/src/eventos-sistema/eventos-sistema.module.ts](../apps/api/src/eventos-sistema/eventos-sistema.module.ts) |
| FidelizacionModule | [apps/api/src/fidelizacion/fidelizacion.module.ts](../apps/api/src/fidelizacion/fidelizacion.module.ts) |
| GastosFijosModule | [apps/api/src/gastos-fijos/gastos-fijos.module.ts](../apps/api/src/gastos-fijos/gastos-fijos.module.ts) |
| ImpresionModule | [apps/api/src/impresion/impresion.module.ts](../apps/api/src/impresion/impresion.module.ts) |
| IntegracionesModule | [apps/api/src/integraciones/integraciones.module.ts](../apps/api/src/integraciones/integraciones.module.ts) |
| InventarioModule | [apps/api/src/inventario/inventario.module.ts](../apps/api/src/inventario/inventario.module.ts) |
| ReservasMaterialModule | [apps/api/src/inventario/reservas-material.module.ts](../apps/api/src/inventario/reservas-material.module.ts) |
| MaquinariaModule | [apps/api/src/maquinaria/maquinaria.module.ts](../apps/api/src/maquinaria/maquinaria.module.ts) |
| McpModule | [apps/api/src/mcp/mcp.module.ts](../apps/api/src/mcp/mcp.module.ts) |
| MotorUniversalModule | [apps/api/src/motor-universal/motor.module.ts](../apps/api/src/motor-universal/motor.module.ts) |
| OrdenesTrabajoModule | [apps/api/src/ordenes-trabajo/ordenes-trabajo.module.ts](../apps/api/src/ordenes-trabajo/ordenes-trabajo.module.ts) |
| PanelGeneralModule | [apps/api/src/panel-general/panel-general.module.ts](../apps/api/src/panel-general/panel-general.module.ts) |
| PlanificacionEntregasCoreModule | [apps/api/src/planificacion-entregas/planificacion-core.module.ts](../apps/api/src/planificacion-entregas/planificacion-core.module.ts) |
| PlanificacionEntregasModule | [apps/api/src/planificacion-entregas/planificacion.module.ts](../apps/api/src/planificacion-entregas/planificacion.module.ts) |
| PlataformaModule | [apps/api/src/plataforma/plataforma.module.ts](../apps/api/src/plataforma/plataforma.module.ts) |
| PresupuestosModule | [apps/api/src/presupuestos/presupuestos.module.ts](../apps/api/src/presupuestos/presupuestos.module.ts) |
| PrismaModule | [apps/api/src/prisma/prisma.module.ts](../apps/api/src/prisma/prisma.module.ts) |
| ProduccionModule | [apps/api/src/produccion/produccion.module.ts](../apps/api/src/produccion/produccion.module.ts) |
| PrecioModule | [apps/api/src/productos-servicios/precio/precio.module.ts](../apps/api/src/productos-servicios/precio/precio.module.ts) |
| ProductosServiciosModule | [apps/api/src/productos-servicios/productos-servicios.module.ts](../apps/api/src/productos-servicios/productos-servicios.module.ts) |
| ProveedoresModule | [apps/api/src/proveedores/proveedores.module.ts](../apps/api/src/proveedores/proveedores.module.ts) |
| ProvisionamientoModule | [apps/api/src/provisionamiento/provisionamiento.module.ts](../apps/api/src/provisionamiento/provisionamiento.module.ts) |
| RecorridosVectorialesModule | [apps/api/src/recorridos-vectoriales/recorridos-vectoriales.module.ts](../apps/api/src/recorridos-vectoriales/recorridos-vectoriales.module.ts) |
| RegistroModule | [apps/api/src/registro/registro.module.ts](../apps/api/src/registro/registro.module.ts) |
| ReportesModule | [apps/api/src/reportes/reportes.module.ts](../apps/api/src/reportes/reportes.module.ts) |
| SuscripcionesModule | [apps/api/src/suscripciones/suscripciones.module.ts](../apps/api/src/suscripciones/suscripciones.module.ts) |
| DatosEmpresaModule | [apps/api/src/tenants/datos-empresa.module.ts](../apps/api/src/tenants/datos-empresa.module.ts) |
| TenantsModule | [apps/api/src/tenants/tenants.module.ts](../apps/api/src/tenants/tenants.module.ts) |
| UsuariosModule | [apps/api/src/usuarios/usuarios.module.ts](../apps/api/src/usuarios/usuarios.module.ts) |
| WebhooksWhatsappModule | [apps/api/src/webhooks-whatsapp/webhooks-whatsapp.module.ts](../apps/api/src/webhooks-whatsapp/webhooks-whatsapp.module.ts) |
| CotizacionJobsModule | [apps/api/src/workers/cotizacion/cotizacion-jobs.module.ts](../apps/api/src/workers/cotizacion/cotizacion-jobs.module.ts) |
| CapacidadGeometriaModule | [apps/api/src/workers/geometria/capacidad-geometria.service.ts](../apps/api/src/workers/geometria/capacidad-geometria.service.ts) |
| GeometriaJobsModule | [apps/api/src/workers/geometria/geometria-jobs.module.ts](../apps/api/src/workers/geometria/geometria-jobs.module.ts) |
| NestingsGuardadosModule | [apps/api/src/workers/geometria/nestings-guardados.service.ts](../apps/api/src/workers/geometria/nestings-guardados.service.ts) |
| WorkerModule | [apps/api/src/workers/worker.module.ts](../apps/api/src/workers/worker.module.ts) |

## 5. Familias técnicas de procesos

Fuente: [apps/api/src/productos-servicios/pasos/familias.ts](../apps/api/src/productos-servicios/pasos/familias.ts). El propio archivo distingue definiciones detalladas y mínimas. Esta lista **no acredita madurez comercial ni pruebas completas de todas las tecnologías**. Antes de convertir una familia en una opción de plan se debe validar su recorrido de cotización y producción, sus dependencias y la conservación de recetas existentes.

| Código | Nombre declarado | Categoría | Línea |
|---|---|---|---:|
| `pre_prensa` | Pre-prensa / revisión y armado | pre_prensa | 224 |
| `impresion_por_hoja` | Impresión por hoja | produccion_impresion | 272 |
| `impresion_por_area` | Impresión por área | produccion_impresion | 397 |
| `impresion_por_pieza` | Impresión por pieza | produccion_impresion | 467 |
| `impresion_3d` | Impresión 3D | produccion_impresion | 516 |
| `aplicacion_transfer` | Aplicación de transfer manual | produccion_impresion | 581 |
| `aplicacion_transfer_textil` | Aplicación de transfer textil | produccion_impresion | 641 |
| `grabado_laser` | Grabado láser | produccion_impresion | 693 |
| `corte_guillotina` | Corte con guillotina | corte_y_formado | 730 |
| `plotter_corte` | Plotter de corte | corte_y_formado | 785 |
| `corte_laser` | Corte láser | corte_y_formado | 858 |
| `troquelado_digital` | Mesa de corte digital |  | 936 |
| `cnc` | CNC | corte_y_formado | 950 |
| `plegado` | Plegado manual | corte_y_formado | 1027 |
| `corte_manual` | Corte manual | corte_y_formado | 1061 |
| `corte_hilo_caliente` | Corte con hilo caliente | corte_y_formado | 1111 |
| `laminado` | Laminado Polipropileno | terminaciones | 1170 |
| `plastificado_pouch` | Plastificado pouch | terminaciones | 1240 |
| `pintura_superficial` | Pintura superficial | terminaciones | 1299 |
| `lijado_canteado` | Lijado y canteado | terminaciones | 1341 |
| `abrochado_caballete` | Abrochado a caballete | encuadernacion_armado | 1369 |
| `encuadernado_anillado` | Encuadernación con anillo (espiral / wire-o) | encuadernacion_armado | 1412 |
| `engomado_emblocado` | Engomado / emblocado | encuadernacion_armado | 1473 |
| `ensamble_estructural` | Ensamble estructural | estructural_montaje | 1530 |
| `estructura_bastidor` | Estructura de bastidor | estructural_montaje | 1550 |
| `iluminacion_led` | Iluminación LED | estructural_montaje | 1750 |
| `montaje_sobre_sustrato` | Montado sobre material | estructural_montaje | 1885 |
| `embalaje` | Embalaje | operaciones_manuales | 1976 |
| `trabajo_manual` | Trabajo manual | operaciones_manuales | 2024 |
| `modificacion_post` | Modificación post-producción | operaciones_manuales | 2077 |
| `colocacion_ojales` | Colocación de ojales | operaciones_manuales | 2118 |
| `colocacion_raspadita` | Colocación de raspadita | operaciones_manuales | 2217 |
| `instalacion_in_situ` | Instalación en sitio | logistica_instalacion | 2267 |
| `diseno_grafico` | Diseño gráfico | servicios_profesionales | 2295 |

## 6. Superficies transversales revisadas

- [Navegación por módulos](../src/components/navigation/nav-items.ts).
- [Configuración](../src/components/configuracion/configuracion-secciones.ts).
- [Contrato de permisos del cliente](../src/lib/permisos.ts).
- [Funciones comerciales actuales](../apps/api/src/suscripciones/capacidades-plan.ts).
- [Evaluación de funciones y límites](../apps/api/src/suscripciones/suscripciones.service.ts).
- [Modelo de planes, precios y suscripciones](../apps/api/prisma/schema.prisma).
- [Edición actual de planes en Plataforma](../src/components/plataforma/consola-view.tsx).
- [Oferta comercial en marketing](../apps/marketing/src/app/page.tsx).
- [Presentación del registro público](../src/components/registro/registro-form.tsx).
- [Autogestión de la suscripción](../src/components/suscripcion/suscripcion-view.tsx).
