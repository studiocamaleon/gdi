# Plan de Implementacion del Modulo Maquinaria

## Objetivo

Construir un modulo `Maquinaria` que permita registrar, parametrizar y mantener equipos productivos de multiples nichos graficos a partir de plantillas oficiales del sistema, con foco en:

- capacidades tecnicas reales
- perfiles operativos
- consumibles y componentes de desgaste
- vinculacion organizativa y economica
- baja friccion de carga para el usuario

El modulo no debe resolver en esta etapa la logica completa de `Procesos`. Debe dejar preparada la base para que futuros procesos, costeo y cotizacion puedan apoyarse en maquinaria consistente.

## Principios funcionales

- Las maquinas se crean solo desde `plantillas del sistema`.
- El usuario no define libremente estructuras de campos.
- La informacion de una maquina se separa en bloques comprensibles y progresivos.
- Los `perfiles operativos` viven en maquinaria porque describen modos reales de uso del equipo.
- `Consumibles` y `desgaste` tambien viven en maquinaria porque forman parte de su costo operativo tecnico.
- La UI debe guiar al usuario con ayuda contextual, ejemplos y advertencias.
- Toda la interfaz del modulo debe construirse con componentes `shadcn/ui`.

## Alcance V1

La V1 del modulo debe cubrir:

- alta, edicion, activacion y baja logica de maquinas
- catalogo oficial de plantillas
- capacidades fisicas y tecnicas por plantilla
- perfiles operativos por maquina
- consumibles por maquina
- componentes de desgaste por maquina
- vinculacion con planta, sector y centro de costo
- estados de configuracion y validacion

Queda fuera de V1:

- telemetria en tiempo real
- mantenimiento preventivo completo con calendario
- oee y captura automatica de produccion
- integraciones con RIP, PLC o dispositivos
- motor de cotizacion basado en procesos

## Catalogo inicial de plantillas

### Corte y mecanizado

- `router_cnc`
- `corte_laser`
- `mesa_de_corte`
- `plotter_de_corte`

### Fabricacion aditiva

- `impresora_3d`

### Impresion por transferencia

- `impresora_dtf`
- `impresora_dtf_uv`

### Impresion UV

- `impresora_uv_flatbed`
- `impresora_uv_rollo`
- `impresora_uv_cilindrica`
- `impresora_uv_mesa_extensora`

### Impresion inkjet gran formato

- `impresora_solvente`
- `impresora_inyeccion_tinta`
- `impresora_latex`
- `impresora_sublimacion_gran_formato`
- `plotter_cad`

### Impresion digital hoja a hoja

- `impresora_laser`

## Modelo funcional propuesto

### Entidades conceptuales

- `PlantillaMaquinaria`
- `Maquina`
- `MaquinaUbicacion`
- `MaquinaVinculoCosto`
- `PerfilOperativo`
- `ConsumibleMaquina`
- `ComponenteDesgasteMaquina`
- `DocumentoMaquina`

### Estructura de responsabilidad

- `PlantillaMaquinaria`: define tipo, bloques visibles, reglas y campos permitidos.
- `Maquina`: representa el equipo concreto del cliente.
- `PerfilOperativo`: guarda modos de uso del equipo segun formato, calidad, velocidad o configuracion.
- `ConsumibleMaquina`: guarda insumos variables del equipo.
- `ComponenteDesgasteMaquina`: guarda repuestos o kits con vida util prorrateable.

## Secciones de una maquina

Toda maquina deberia dividirse en estas secciones dentro de la UI:

- `Datos generales`
- `Ubicacion y organizacion`
- `Capacidades fisicas`
- `Parametros tecnicos`
- `Perfiles operativos`
- `Consumibles`
- `Desgaste y repuestos`
- `Vinculacion economica`
- `Documentacion y observaciones`

## Campos comunes a toda maquina

- codigo
- nombre
- plantilla
- fabricante
- modelo
- numero de serie
- planta
- sector o ubicacion
- centro de costo vinculado
- estado `activa | inactiva | mantenimiento | baja`
- fecha de alta
- observaciones

## Campos base por familia

### Router CNC

- eje x util
- eje y util
- eje z util
- espesor maximo
- potencia spindle
- rpm minima
- rpm maxima
- velocidad de avance
- velocidad de desplazamiento
- cantidad de herramientas
- cambiador automatico
- vacio o sujecion
- materiales compatibles

### Corte laser

- eje x util
- eje y util
- eje z util o despeje
- potencia laser
- tipo de laser
- espesor maximo por material
- velocidad de corte
- velocidad de grabado
- extraccion
- materiales compatibles

### Impresora 3D

- volumen x
- volumen y
- volumen z
- tecnologia
- altura minima de capa
- altura maxima de capa
- cantidad de extrusores o cabezales
- diametro de boquilla
- materiales compatibles

### Impresora DTF

- ancho util
- tipo de film
- configuracion de canales
- blanco
- resolucion nominal
- tipo de tinta
- secado o curado asociado

### Impresora DTF UV

- ancho util
- materiales compatibles
- configuracion color
- blanco
- barniz
- sistema de laminacion o transferencia

### Impresora UV flatbed / mesa extensora

- ancho cama
- largo cama
- altura maxima objeto
- peso maximo
- zonas de vacio
- blanco
- barniz
- primer
- materiales compatibles

### Impresora UV rollo

- ancho util
- diametro o peso maximo de bobina
- espesor maximo material
- margenes no imprimibles por avance de material (inicio/fin)
- blanco
- barniz
- primer
- sistema de curado
- materiales compatibles

### Impresora UV cilindrica

- diametro minimo
- diametro maximo
- largo util
- peso maximo
- conicidad maxima soportada (si aplica)
- blanco
- barniz
- objetos compatibles

### Impresion solvente / latex / inyeccion / sublimacion / plotter CAD

- ancho util
- diametro o peso de bobina
- espesor maximo
- configuracion de tintas
- resolucion nominal
- sistema de secado o curado
- materiales compatibles

### Impresora laser

- ancho minimo hoja
- ancho maximo hoja
- alto minimo hoja
- alto maximo hoja
- area imprimible
- margenes no imprimibles
- gramaje minimo
- gramaje maximo
- duplex
- banner
- largo maximo banner
- configuracion de color
- resolucion nominal
- unidad productiva principal

### Mesa de corte / plotter de corte

- ancho util
- largo util
- espesor maximo
- herramientas compatibles
- velocidad de corte
- vacio o sujecion
- materiales compatibles

## Perfiles operativos

Los perfiles operativos deben existir como subentidad en la mayoria de las plantillas. Su objetivo es capturar modos reales de uso del equipo.

Campos sugeridos para un perfil:

- nombre
- estado activo
- ancho aplicable
- alto aplicable
- modo de trabajo
- calidad
- productividad
- unidad de productividad
- tiempo de preparacion
- tiempo de carga
- tiempo de descarga
- tiempo RIP si aplica
- cantidad de pasadas si aplica
- duplex si aplica
- configuracion color/canales
- observaciones

Ejemplos:

- `A4 color normal` en impresora laser
- `rigido con blanco y barniz` en UV flatbed
- `corte acrilico 3 mm` en laser
- `grabado MDF fino` en router CNC

## Consumibles

Los consumibles deben modelarse por maquina porque afectan directamente el costo operativo real.

Campos sugeridos:

- nombre
- tipo
- unidad
- costo referencia
- rendimiento estimado
- forma de consumo
- depende de perfil operativo `si/no`
- activo
- observaciones

Tipos esperables:

- toner
- tinta
- barniz
- primer
- film
- polvo
- adhesivo
- resina
- lubricante
- otro

## Componentes de desgaste

Deben existir como entidad separada de consumibles.

Campos sugeridos:

- nombre
- tipo
- vida util estimada
- unidad de desgaste
- costo de reposicion
- modo de prorrateo
- activo
- observaciones

Unidades de desgaste posibles:

- `copias_a4_equiv`
- `m2`
- `metros_lineales`
- `horas`
- `ciclos`
- `piezas`

## Integracion con Centro de Costos

El modulo `Maquinaria` no reemplaza `Centro de Costos`, pero debe vincularse con el.

La V1 debe permitir:

- vincular una maquina a un centro de costo
- marcar si es el centro principal del equipo
- dejar la base preparada para futuras tarifas por periodo

No debe intentar en V1 calcular cotizacion desde esta pantalla.

## UX y arquitectura de UI con shadcn

### Pantalla principal

Componentes sugeridos:

- `Card` para resumen y KPIs
- `Tabs` para cambiar entre vistas
- `Table` para listado principal
- `Badge` para estado, plantilla y completitud
- `Button` para crear maquina
- `DropdownMenu` para acciones por fila
- `Empty` para estados vacios
- `Skeleton` para carga

### Alta y edicion

Patron recomendado:

- `Sheet` ancho para alta/edicion rapida
- `Tabs` internas para dividir la maquina en secciones
- `FieldGroup` y `Field` para formularios
- `Select`, `Input`, `Textarea`, `Switch` y `Combobox` segun el dato
- `Table` o bloque repetible para perfiles, consumibles y desgaste
- `Alert` para advertencias importantes

### Ayuda al usuario y reduccion de friccion

La UI debe incorporar ayuda contextual desde el inicio.

Componentes sugeridos:

- `Tooltip` para explicar campos cortos
- `HoverCard` para ayuda ampliada o ejemplos
- `Popover` para guias rapidas en tablas o subformularios
- `Alert` para advertencias de consistencia
- `Accordion` para mostrar ayuda extendida sin ensuciar la pantalla

Buenas practicas de ayuda:

- explicar con lenguaje simple para que sirve cada bloque
- dar ejemplos reales en placeholders y descripciones
- mostrar unidades explicitamente
- advertir cuando un dato impacta costos futuros
- resaltar campos recomendados vs opcionales

## Roadmap de implementacion

### Fase 0 - Preparacion funcional

- validar catalogo inicial de plantillas
- aprobar estructura base del modulo
- aprobar secciones internas de cada maquina
- aprobar alcance de V1

### Fase 1 - Modelo de datos

- crear entidades base del modulo
- definir enums de plantillas, estados, tipos de consumible y desgaste
- crear relaciones con planta, sector y centro de costo
- resolver estrategia para campos especificos por plantilla

Entregable:

- esquema de datos listo para migracion

### Fase 2 - Catalogo de plantillas del sistema

- implementar fuente central de plantillas
- definir metadatos por plantilla
- definir campos visibles, ayudas y validaciones por plantilla

Entregable:

- catalogo versionado de plantillas

### Fase 3 - Listado y navegacion del modulo

- crear vista principal del modulo
- filtros por plantilla, estado, planta y sector
- acciones de alta, edicion y baja logica
- badges de completitud

Entregable:

- modulo navegable desde sidebar con listado funcional

### Fase 4 - Formulario base de maquina

- alta desde plantilla
- datos generales
- ubicacion y organizacion
- capacidades fisicas
- parametros tecnicos

Entregable:

- formulario base con validaciones y ayuda contextual

### Fase 5 - Submodulos internos

- perfiles operativos
- consumibles
- componentes de desgaste
- documentacion y observaciones

Entregable:

- maquina completa configurable en V1

### Fase 6 - Integracion con Costos

- vinculo con centro de costo
- estados de configuracion
- alertas si falta relacion economica

Entregable:

- maquinaria lista para convivir con costos

### Fase 7 - Pulido UX

- tooltips y hover cards en campos criticos
- empty states con ejemplos
- mensajes de ayuda por plantilla
- mejoras de accesibilidad
- loading states, skeletons y feedback

Entregable:

- modulo usable con baja friccion

## Orden recomendado de ejecucion

Para reducir riesgo, implementar en este orden:

1. infraestructura de datos
2. catalogo de plantillas
3. listado principal
4. formulario base
5. impresora_laser
6. impresora_uv_flatbed
7. router_cnc
8. resto de plantillas por familia
9. pulido de ayuda y consistencia

## Criterios de aceptacion de V1

- una maquina no puede crearse sin plantilla
- cada plantilla muestra solo los campos que le corresponden
- perfiles operativos pueden cargarse sin ambiguedad
- consumibles y desgaste pueden prorratearse a futuro
- el usuario entiende cada bloque sin depender de soporte externo
- la UI mantiene coherencia con `shadcn/ui`

## Riesgos a controlar

- intentar modelar demasiada logica de procesos dentro de maquinaria
- crear plantillas demasiado rigidas
- crear formularios excesivamente largos sin ayuda contextual
- mezclar costo tecnico con contabilidad del centro de costo
- permitir parametros libres que rompan consistencia

## Siguiente paso recomendado

Convertir este plan en una especificacion tecnica ejecutable del modelo de datos y de la UI inicial, empezando por:

- entidades y tablas del modulo
- catalogo de plantillas del sistema
- pantalla principal
- flujo de alta/edicion con `shadcn/ui`
