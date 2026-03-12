# Analisis funcional y tecnico de Materia Prima por plantilla de maquinaria

Fecha: 2026-03-11

## Objetivo

Listar y estructurar las materias primas potenciales para TODAS las plantillas de maquinaria del ERP, para:

- identificar patrones de modelado
- definir categorias reutilizables
- preparar la relacion `MateriaPrima <-> Maquinaria <-> Proceso`
- reducir riesgo antes del diseno funcional/tecnico del modulo

## Fuentes usadas

- Catalogo interno de plantillas y campos:
  - `src/lib/maquinaria.ts`
  - `src/lib/maquinaria-templates.ts`
  - `docs/maquinaria-implementation-plan.md`
  - `docs/procesos-template-functional-catalog.md`
- Referencias sectoriales de industria grafica (Print MIS/MIS de imprenta):
  - PrintVis (estimacion, speed/scrap, material requirement, job costing)
  - Prinect/MIS workflow (JDF)
  - CIP4 (JDF/XJDF/ICS)
  - practicas operativas de DTF, UV, latex, solvente, sublimacion, corte y CAD

## Alcance y criterio de "todas"

"Todas las materias primas" se interpreta como:

1. todas las materias primas realistamente usadas por cada plantilla dentro del alcance del ERP grafico
2. diferenciadas por rol tecnico:
   - sustrato base
   - quimicos/tintas
   - transferencia/laminacion
   - auxiliares de proceso
3. incluyendo variantes frecuentes de planta (no solo un ejemplo por tecnologia)

No incluye repuestos de desgaste (fusor, drum, cuchillas, etc.) porque pertenecen al dominio `Desgaste` y no a `MateriaPrima`.

---

## Taxonomia propuesta de materia prima (transversal)

### A. Sustratos flexibles imprimibles

- vinilo monomerico/polimerico/fundido
- lona frontlit/backlit/blockout/mesh
- films PET/PP/PVC
- papel (poster, blueback, fotografico, obra)
- canvas
- textil en rollo (poliester, mezcla, bandera)
- backlit film

### B. Sustratos rigidos imprimibles o procesables

- acrilico (cast/extrudado)
- PVC espumado
- PVC rigido
- polipropileno corrugado
- carton pluma/foamboard
- dibond/ACM
- madera/MDF
- vidrio
- metal (aluminio, chapa fina)
- carton corrugado

### C. Sustratos hoja/pliego (digital laser)

- obra
- ilustracion estucado mate/brillante
- opalina/cartulina
- sintetico
- preimpreso
- etiqueta adhesiva en hoja

### D. Textiles y superficies objetivo de transferencia

- algodon
- poliester
- mezclas
- cuero/ecocuero
- superficies rigidas para DTF UV (vidrio, metal pintado, acrilico, ABS)

### E. Tintas y fluidos de impresion

- toner seco/liquido (segun equipo)
- tintas solvente/ecosolvente
- tintas latex
- tintas UV
- tintas DTF (CMYK + blanco)
- tintas sublimacion
- tintas CAD pigmento/dye

### F. Aditivos de impresion y acabados quimicos

- barniz UV
- primer
- adhesivos (base transfer/laminacion)
- polvo hotmelt (DTF textil)
- promotores de adhesion

### G. Materiales de transferencia

- film DTF PET (hot peel/cold peel)
- film DTF UV A/B
- papel de sublimacion
- films transfer de aplicacion

### H. Auxiliares de proceso (materia prima indirecta)

- solventes/limpiadores
- paños y wipes tecnicos
- cintas de enmascarar/registro
- papel protector/interleaf

### I. Materia prima para fabricacion aditiva (3D)

- filamentos PLA/ABS/PETG/TPU/NYLON
- resinas UV (standard, tough, flexible, castable)
- alcohol isopropilico/lavado
- soportes/adhesivos de cama

### J. Materia prima de corte/mecanizado

- placas y tableros (MDF, acrilico, PVC, dibond, foamboard, carton)
- vinilos y films para plotter
- laminados y multilayer para conversion

---

## Matriz completa por plantilla de maquinaria

## 1) router_cnc

- Sustrato principal:
  - MDF, madera, acrilico, PVC, aluminio delgado, dibond, foamboard.
- Auxiliares frecuentes:
  - lubricante de corte, cinta de fijacion, laminas sacrificio.
- Observacion de modelado:
  - el material debe guardar espesor, densidad y familia para reglas de velocidad/merma.

## 2) corte_laser

- Sustrato principal:
  - acrilico, madera, MDF, carton, papel, cuero, tela.
- Auxiliares frecuentes:
  - aire asistido/gas (segun equipo), films de enmascarado, limpiadores.
- Observacion:
  - compatibilidad material-seguridad es critica (no todo PVC/compuesto es apto).

## 3) impresora_3d

- Materia prima principal:
  - PLA, ABS, PETG, TPU, Nylon, resina.
- Auxiliares:
  - alcohol de lavado, adhesivo de cama, soportes.
- Observacion:
  - requiere propiedades tecnicas de filamento/resina (diametro, temperatura, densidad).

## 4) impresora_dtf

- Materia prima principal:
  - film PET DTF, tinta DTF CMYK, tinta blanca, polvo hotmelt.
- Superficie objetivo (consumida en proceso global):
  - prendas de algodon/poliester/mezcla.
- Auxiliares:
  - cinta/film de transporte, limpiadores de cabezal.
- Observacion:
  - distinguir material de impresion (film) de material final de aplicacion (prenda).

## 5) impresora_dtf_uv

- Materia prima principal:
  - film A, film B, tintas UV CMYK, blanco, barniz.
- Superficie objetivo:
  - rigidos: acrilico, vidrio, metal, plastico tecnico.
- Auxiliares:
  - promotores de adhesion, limpiadores.
- Observacion:
  - modelar cadena transferencia (A/B) y rendimiento por m2/pieza.

## 6) impresora_uv_mesa_extensora

- Sustrato principal:
  - PVC espumado, corrugado plastico, carton pluma, acrilico, madera fina, metal delgado.
- Quimicos:
  - tinta UV, blanco, barniz, primer.
- Observacion:
  - material rigido requiere atributos de espesor y metodo de fijacion.

## 7) impresora_uv_cilindrica

- Sustrato/objeto principal:
  - termos, botellas, vasos, frascos, tubos.
- Quimicos:
  - tinta UV, blanco, barniz, primer (segun superficie).
- Observacion:
  - el material se modela por objeto + material base + diametro/conicidad.

## 8) impresora_uv_flatbed

- Sustrato principal:
  - acrilico, PVC, MDF/madera, vidrio, metal, dibond, carton pluma, corrugado.
- Quimicos:
  - tinta UV, blanco, barniz, primer.
- Observacion:
  - alto impacto de cobertura de tinta por tipo de material/color base.

## 9) impresora_uv_rollo

- Sustrato principal:
  - vinilo, lona, film, papel, textil, backlit, canvas.
- Quimicos:
  - tinta UV, blanco, barniz, primer.
- Auxiliares:
  - liner/protector, cinta de empalme.
- Observacion:
  - guardar ancho, metraje, micraje y peso del rollo.

## 10) impresora_solvente

- Sustrato principal:
  - vinilo, lona, backlit, films para exterior.
- Quimicos:
  - tinta solvente/ecosolvente, liquido de limpieza.
- Auxiliares:
  - laminado (si flujo print&laminate), cinta de montaje.
- Observacion:
  - secado/outgassing condiciona disponibilidad real del material impreso.

## 11) impresora_inyeccion_tinta

- Sustrato principal:
  - papeles especiales, films, vinilos tecnicos, textiles compatibles.
- Quimicos:
  - tintas inkjet segun tecnologia (pigmento/dye/otro), limpieza.
- Observacion:
  - plantilla general; requiere subtipo de tinta para costeo correcto.

## 12) impresora_latex

- Sustrato principal:
  - vinilo, canvas, papeles mural, backlit, textiles compatibles.
- Quimicos:
  - tintas latex, optimizador (si aplica), limpiadores.
- Auxiliares:
  - laminado posterior (segun producto final).
- Observacion:
  - diferencia de adherencia y velocidad por sustrato es clave.

## 13) impresora_sublimacion_gran_formato

- Sustrato principal (impresion):
  - papel de sublimacion.
- Material final de transferencia:
  - textil poliester, superficies preparadas para sublimar.
- Quimicos:
  - tintas de sublimacion.
- Observacion:
  - separar consumo de papel transfer vs consumo en calandra/prensa.

## 14) impresora_laser

- Sustrato principal:
  - papel/estucado/cartulina/sintetico en hoja.
- Quimicos:
  - toner CMYK y especiales.
- Auxiliares:
  - sustratos pretratados, hojas especiales.
- Observacion:
  - gramaje, formato y acabado del papel son atributos obligatorios.

## 15) plotter_cad

- Sustrato principal:
  - papel bond CAD, papel coated, film tecnico.
- Quimicos:
  - tinta CAD pigmento/dye.
- Observacion:
  - consumo frecuentemente en metro lineal, no solo m2.

## 16) mesa_de_corte

- Sustrato principal:
  - carton, corrugado, foamboard, vinilo, PVC, laminados.
- Auxiliares:
  - tapete/sacrificio, cinta de sujecion.
- Observacion:
  - material debe guardar dureza/espesor para seleccionar herramienta.

## 17) plotter_de_corte

- Sustrato principal:
  - vinilo calandrado/fundido, film, papel, transfer.
- Auxiliares:
  - transport tape/application tape.
- Observacion:
  - diferenciar `kiss cut` vs `full cut` para merma/tiempo.

---

## Patrones detectados para categorizar

1. Patron `sustrato + tinta + auxiliar`:
   - aparece en casi todas las plantillas de impresion.
2. Patron `material objetivo + material de transferencia`:
   - DTF, DTF UV, sublimacion.
3. Patron `material por geometria`:
   - rollo, pliego, plano rigido, cilindrico, volumen.
4. Patron `material condicionado por perfil operativo`:
   - cambia consumo segun calidad, pasadas, modo color.
5. Patron `material con trazabilidad obligatoria`:
   - lotes en tintas, films, papeles premium, quimicos sensibles.

---

## Implicaciones funcionales de modelado

### 1) El tipo actual de consumibles es insuficiente como maestro de materia prima

Hoy `TipoConsumibleMaquina` (`toner|tinta|barniz|primer|film|polvo|adhesivo|resina|lubricante|otro`) sirve para maquinaria, pero no cubre todo el dominio de materia prima:

- faltan sustratos base (vinilo, lona, papel, carton, MDF, acrilico, textil, etc.)
- faltan atributos tecnicos de compra/stock por familia
- falta trazabilidad por lote/rollo/pliego

### 2) Se requieren al menos 3 niveles de clasificacion

- `familiaMateriaPrima` (sustrato, tinta, quimico, transferencia, auxiliar, aditiva)
- `subfamilia` (ej: sustrato_flexible, sustrato_rigido, sustrato_hoja)
- `tipoTecnico` (ej: vinilo_fundido, papel_sra3_300g, tinta_uv_blanco)

### 3) Relacion con maquinaria debe ser explicita

Necesaria tabla tipo `MateriaPrimaCompatibilidadMaquina`:

- `materiaPrimaId`
- `plantillaMaquinaria` (y opcional `maquinaId`)
- `perfilOperativoId` opcional
- `modoUso` (`sustrato_directo|tinta|transferencia|auxiliar`)
- `consumoBase`
- `unidadConsumo`
- `mermaBasePct`
- `activo`

### 4) Modelado de unidades debe contemplar conversiones

- compra: kg, litro, rollo, pliego, hoja, unidad
- consumo tecnico: ml/m2, g/m2, m lineal, hoja, pieza
- stock: unidad base de inventario + factor conversion

### 5) Campos tecnicos minimos por familia

- Sustratos: ancho, largo, espesor, gramaje/micraje, color base, acabado, formato.
- Tintas/quimicos: color/canal, presentacion, rendimiento, compatibilidad tecnologica.
- Transferencia: tipo film/papel, release, temperatura/condicion sugerida.
- Aditiva: diametro filamento o tipo resina, rango de temperatura, densidad.

---

## Brechas detectadas contra el ERP actual

1. No existe un maestro central de materias primas (hoy solo consumibles por maquina).
2. No existe compatibilidad estructurada `materia prima <-> plantilla/perfil de maquinaria`.
3. No existe inventario de materia prima (almacen, stock, lotes, movimientos).
4. No existe regla de consumo por operacion alimentada por materia prima catalogada.

---

## Conclusiones

1. El paso pedido es correcto y estrategico: la matriz por plantilla deja claro que `MateriaPrima` debe modelarse como dominio propio, no como extension de `ConsumibleMaquina`.
2. Hay patrones suficientes para una taxonomia comun transversal y reusable.
3. La relacion con `Maquinaria` debe ser nativa en el modelo para costeo tecnico confiable.
4. Con esta base, el siguiente paso natural es disenar el modulo con entidades y reglas sin improvisar.

## Preguntas de validacion antes de diseno

1. Queres que la V1 incluya solo materia prima `comprada` o tambien semielaborados `producidos internamente` (ej: laminado propio)?
2. En V1, priorizamos trazabilidad por lote para todas las familias o solo para tintas/films/sustratos criticos?
3. Preferis que la compatibilidad se defina solo por `plantilla` o tambien por `maquina` concreta desde el inicio?
