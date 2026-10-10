# Mantenimiento de dependencias — 10/10/2026

## Alcance autorizado

Primer lote posterior a la regularización de PR: #60, #61 y #67, más la política semanal de Dependabot. El titular autorizó implementar la recomendación y completar pruebas, staging, producción e integración. Las propuestas independientes que aparezcan después pasan al siguiente lote.

| PR | Decisión y comprobación necesaria |
| --- | --- |
| #60, #61 | Integrar herramientas de GitHub Actions por SHA, con permisos mínimos y caché automática desactivada. Comprobar CI combinado. |
| #67 | Integrar parches de web, API, Grafo3D, extensión y respaldos. Comprobar teléfonos, facturación, colas, PDF, geometría 3D y recuperación. |
| #62 | Cerrar sin incorporar Python 3.14: SciPy 1.13.1 no tiene una distribución binaria compatible para ese runtime. Retomar con una migración coordinada de Python y bibliotecas científicas. |
| #65 | Cerrar sin incorporar Node 26: conservar Node 24 LTS; revisar la migración cuando la nueva rama sea LTS y pase compilación y pruebas. |
| #66 | Cerrar sin incorporar Node 25 en el respaldo: esa rama ya terminó su soporte. Mantener Node 22 LTS y planificar su próxima migración soportada con prueba de restauración. |
| #63, #64 | Pendientes independientes: repetir fixtures de geometría/nesting, importación y exportación DXF y comparar rendimiento antes de integrar. |
| #68 | Pendiente independiente: alinear React, React DOM y tipos; comprobar compatibilidad de componentes y formularios en staging. |
| #69 | Pendiente independiente: migración de Recharts 2 a 3; revisar API, leyendas, ejes y gráficos del Centro de análisis. |

La restricción de versiones se aplica al mantenimiento ordinario. Las alertas de seguridad conservan su circuito propio. Referencias: [Dependabot](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) y [soporte de Node](https://nodejs.org/en/about/previous-releases).

## Evidencia

Validación en curso. Las revisiones, imágenes, resultados y límites se completarán en este documento y en los registros de staging y producción antes de cerrar el lote. No interpretar esta preparación como una publicación terminada.
