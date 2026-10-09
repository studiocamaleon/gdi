# Niveles y perfiles de máquina

## Cómo se usa

En la configuración de un paso, abrir **Niveles**. Se puede crear un nivel por cada perfil de la máquina o definir los niveles manualmente. Por ejemplo, en el paso opcional Troquelado de un vinilo impreso:

| Nivel | Perfil del plotter |
| --- | --- |
| Simple | Corte simple |
| Complejo | Corte complejo |

Editar cada nivel, elegir su perfil y marcar cuál viene seleccionado por defecto. Guardar el paso mediante la botonera habitual. El nivel del troquelado no modifica la impresión anterior.

Al cotizar, activar Troquelado y elegir el nivel. La velocidad y la preparación provienen del perfil elegido. Los minutos adicionales, la dotación y los bloques de tiempo extra se siguen configurando en el nivel. Los pasos manuales mantienen además su ritmo y tiempo de trabajo.

Si el paso admite varias máquinas, cada nivel tiene un perfil por máquina. Al cambiar de máquina se utiliza el perfil de esa máquina. «Usar el perfil del paso» conserva su selección normal, incluidas las reglas automáticas que ya tenía.

## Alcance y compatibilidad

- Aplica a pasos de ruta, pasos extra opcionales y nodos propios de la empresa.
- La selección de complejidad anterior usa el mismo control comercial de niveles. Su configuración se adapta al editar, sin reescribir registros al leerlos.
- Al recotizar una configuración convertida, se conserva la elección anterior de perfil si todavía existe su nivel equivalente. Una selección explícita nueva tiene prioridad.
- Los niveles se guardan en `paramsPasoJson.niveles`, con `overrides.perfilesPorMaquina`. No requiere migración de tablas ni actualización masiva de productos.
- Tanto el guardado como el motor rechazan perfiles ajenos a la máquina, inactivos o incompatibles. Un opcional desactivado no bloquea por un perfil que no se utiliza.
- El procesamiento vectorial que elige perfiles distintos para corte, medio corte o hendido conserva esa configuración por operación. Allí los niveles ajustan tiempos y dotación, pero no reemplazan todos los perfiles por uno solo.

## Verificación local — 06/10/2026

- Pruebas del motor: perfil, preparación, duración, costo, máquina alternativa, opcionales apagados, selección anterior y pasos manuales.
- Pruebas del cotizador: Troquelado opcional en ruta, extra y nodo propio; una sola selección y envío correcto al motor; recotización con perfil anterior.
- Pruebas de validación y regresión de configuración y extras, con empresas y datos ficticios.
- Comprobación visual en Chrome del componente real, en apariencia clara y oscura, sin errores de consola. La muestra no usa API ni guarda datos.
- TypeScript de la web y de la API verificados por separado. No se compiló una imagen de producción en esta Mac.

Vista de muestra: `/dev/diseno/niveles` (sólo en desarrollo). En esta sesión se levantó en `http://127.0.0.1:3015/dev/diseno/niveles` para no cambiar la carpeta que sirve el puerto 3000.

## Estado de entrega

Rama `codex/niveles-perfiles-maquina`, basada en `codex/avisos-orden-finalizada` (PR #24, base `632deea0a`) para conservar la versión de la aplicación ya publicada. Esta dependencia debe mantenerse explícita al abrir el PR y ajustarse después de integrar la base.

Publicado el 06/10/2026 en staging y producción mediante el PR #25, revisión ejecutada `b89000446`. En staging se guardaron niveles de un producto ficticio y se comprobó que cada perfil cambia el costo y que los perfiles inválidos son rechazados. Los datos propios del ensayo se retiraron. No se modificaron configuraciones comerciales de producción para probarlo. Ver [validación de staging](../deploy/staging/VALIDACION.md) y [producción](../deploy/produccion/VALIDACION.md).

### Corrección posterior del resumen comercial — pendiente de publicar

El selector mostraba solamente `productividadHora` guardada en el nivel, sin unidad, y dejaba vacío el nivel que heredaba el perfil. Ahora ambos muestran la velocidad y unidad del perfil efectivo de la máquina elegida. En tiempo por máquina se ignora el ritmo manual residual, igual que al calcular; el trabajo manual muestra el ritmo del paso o su override con unidad. Sin datos suficientes se identifica el perfil y no se inventa una velocidad. El catálogo entrega también las unidades de perfiles de máquinas principales, candidatas y extras, manteniendo ocultos los costos.

Validación dirigida: 37 pruebas de helper/interfaz y 6 de proyección comercial; tipos de los archivos modificados comprobados. Incluye perfiles heredados/seleccionados, unidades distintas de m²/h, corte con perfiles por operación, datos incompletos y conservación del formato al cambiar la selección. El chequeo global de tipos de API alcanzó el límite de memoria local y debe completarse en CI. Esta corrección posterior no modifica el cálculo ni ha sido desplegada todavía.
