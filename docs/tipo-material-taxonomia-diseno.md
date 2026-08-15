# tipoMaterial — el eje de composición de las materias primas

**Estado**: diseño en revisión — sin implementar
**Fecha**: 2026-08-15
**Rama de análisis**: `analisis/corte-sustrato-propio-o-heredado`
**Disparador**: los perfiles del plotter de corte necesitan declarar con qué
materiales son compatibles (modelo Holdprint), y descubrimos que el sistema no
tiene un vocabulario para decir "acrílico" o "vinilo": sólo tiene
`SUSTRATO_RIGIDO` / `VINILO_CORTE` (formato), no composición.

Relacionado: `corte-sustrato-propio-o-heredado-diseno.md`,
`holdprint-plantillas-maquinaria-relevamiento.md` §4.2,
`holdprint-procesos-relevamiento.md` §3.3,
`maquinas-mecanizadas-corte-laser-cnc-diseno.md`.

---

## 1. El problema: tres ejes mezclados en "familia/subfamilia"

Hoy la clasificación de materias primas (16 familias, ~50 subfamilias en
`SubfamiliaMateriaPrima`) mezcla tres ejes que son ortogonales:

| Eje | Qué responde | Ejemplo | ¿Lo tenemos? |
|---|---|---|---|
| **Categoría** (familia) | qué ES | Sustrato, Tinta, Herraje | ✅ 16 familias |
| **Formato** (subfamilia) | cómo lo trata el motor | rollo flexible / hoja / rígido | ✅ mezclado en subfamilia |
| **Composición** (tipoMaterial) | de qué está HECHO | acrílico, MDF, vinilo cast | ❌ **no existe** |

El código sólo se ramifica por los dos primeros: `esSustratoRollo` (nesting),
`FLEXIBLE_ROLL_SUBFAMILIES` (unidades), compat de slots, tags de biblioteca.
**Ninguna decisión del sistema hoy puede leer la composición** — y es
exactamente lo que un perfil de máquina necesita (el láser corta acrílico 5 mm
a 33 mm/s y MDF 5 mm a otra velocidad; el `SUSTRATO_RIGIDO` no los distingue).

Nota de vocabulario: el "FAMILY" de Holdprint (ACRÍLICO, MDF, ADESIVES) es
**este eje**, no nuestra "familia". Homónimos, cosas distintas.

### 1.1 El eje ya existe de contrabando (evidencia interna)

Tres apariciones informales del mismo eje ausente:

1. **`materialLaserOptions`** hardcodeado en `src/lib/maquinaria-templates.ts`
   (ACRILICO, MDF, MADERA, CARTON_PAPEL, CUERO, GOMA, METAL, OTRO) — inventado
   para láser/CNC porque la subfamilia quedaba corta.
2. **Atributo `material` texto libre** en los presets: 25 valores distintos sin
   gobernanza (`'Papel obra'`, `'Acero'`, `'metal'` vs `'Metal'`, `'Plástico'`
   conviviendo con `'PVC'` y `'polipropileno'`, y hasta un `'Otro'`).
3. **`tipo` de las chapas de cartelería** (`'Galvanizada'`, `'Aluminio'`).

Formalizar el eje no agrega algo nuevo: **gobierna algo que ya está pasando.**

## 2. Usos del sistema que consumen el eje

1. **Compatibilidad de perfiles de máquina** (el disparador): el perfil declara
   `tiposMaterial[]` multi-valor → láser/CNC (velocidad por material×espesor),
   plotter de corte, mesa de corte. Es el filtro de la selección de perfil que
   el comercial verá en el sheet (Fase 2 del plotter).
2. **Seguridad**: matriz proceso×material con veto y motivo. PVC en láser CO2
   libera cloro (corroe la máquina, lesiona al operario); ABS libera HCN;
   policarbonato humo denso + BPA; cuero al cromo, cromo hexavalente;
   galvanizado en fibra, humos de zinc. Los fablabs publican listas formales de
   prohibidos **por composición** — sin este eje no podemos ni avisar.
3. **Compatibilidad de slots** (complementa la subfamilia): "este paso acepta
   acrílico o MDF" en vez de "acepta SUSTRATO_RIGIDO" (que incluye PVC, que el
   láser no puede tocar).
4. **Biblioteca / carga de datos**: dejar de inventar atributos `material` texto
   libre; los presets nacen clasificados.
5. **Futuro**: reglas de correspondencia (laminado cast sobre vinilo cast),
   primers UV (poliolefinas requieren primer), sugerencia de proceso por
   material.

**Dónde NO aplica** (hallazgo de la investigación, explícito):
- **Consumibles líquidos dosificados** (tintas, tóner, barnices, primers, polvo
  DTF): la química es la identidad de la MP y el vínculo con la máquina ya es
  1:1 por familia/subfamilia. No hay decisión transversal que el eje resuelva.
- **Electrónica de cartelería** (LED, fuentes, neón): se elige por specs
  eléctricas (V, W, IP), nadie la "procesa" con parámetros por composición.
- **Herrajes/perfiles/estructuras**: la forma (perfil, tubo, ángulo) es
  formato, no composición — **reusan** `acero`/`aluminio`, no valores nuevos.

## 3. Investigación (2026-08-15, 4 rastrillajes en paralelo)

Dominio flexible/rollo, rígidos/mecanizados, textil/merch/3D/sellos/papeles, y
taxonomías de la industria (MIS, software de láser, proveedores). Síntesis de
lo que converge:

### 3.1 La industria usa lista plana + espesor aparte + multi-valor

| Sistema | Estructura | Valores |
|---|---|---|
| Holdprint | perfil = operación × FAMILY (multi-valor) × espesor | ~10 planos (ACM, acrílico, MDF, PS, PVC, papel, inox, acero) |
| Epilog | lista plana → operación → espesor en la fila de corte | ~16 CO2 + 8 fibra |
| xTool | ~100 entradas material+espesor, agrupación cosmética | basswood 3mm, acrílico negro 3mm… |
| LightBurn | Material → Espesor → Entrada (grabado = "sin espesor") | el usuario la crea |
| Glowforge | 7 categorías hermanas (MDF ≠ plywood ≠ hardwood) | por comportamiento bajo el láser |
| SigmaNEST | clave (material grade × espesor × tratamiento) | metal |
| PrintVis | ¡todo sustrato es "Paper"! + 100 atributos + filtros | anti-ejemplo: incómodo para gran formato |
| Proveedores AR | familia → sub-tipo por uso/construcción → tier | Lona→Frontlit/Mesh; Vinilo corte económico/premium |

Conclusiones unánimes:
- **Lista plana curada (20–30 núcleo), jamás árbol profundo.** Los árboles sólo
  aparecen en catálogos de VENTA y su nivel 1 es formato/uso — que ya tenemos.
- **Espesor SIEMPRE fuera del tipo** (es la otra mitad de la clave del perfil;
  para procesos de superficie ni aplica).
- **Multi-valor en el perfil** (el FAMILY de Holdprint): "MDF y PS 3 mm →
  33 mm/s" es UNA fila. Ya lo habíamos anotado como fricción de nuestro modelo.
- **No existe estándar de industria** (FESPA/ISA no publican taxonomía; cada
  familia física trae su mini-vocabulario: cast/calendered, onzaje, paper
  grades, flauta). Curamos la nuestra sin miedo.
- **La variante fina va en la MP, no en el eje** (tier económico/premium, color,
  mate/brillo, gramaje) — **excepto** cuando cambia la aptitud del proceso
  (ver §4.3).

### 3.2 El test de granularidad

Una distinción es VALOR del eje si cambia **parámetros de máquina, aptitud del
proceso o precio de forma significativa (>±30%)**. Si sólo cambia estética o se
resuelve con un número → atributo de la MP.

- ✅ acrílico ≠ policarbonato (idénticos a la vista; el PC está PROHIBIDO en láser)
- ✅ vinilo monomérico ≠ polimérico ≠ cast (misma máquina, precio 1×/2×/4×)
- ✅ algodón ≠ poliéster (la sublimación sólo agarra en poliéster; DTF va en todo)
- ✅ PLA ≠ ABS (ABS exige cámara cerrada) ≠ TPU (exige direct-drive)
- ❌ mate vs brillo, removible vs permanente, gramaje, color, marca → atributos

### 3.3 Holdprint/HoldAI en vivo (2026-08-15, sesión real en app.holdworks.ai)

Relevamiento con cuenta activa sobre la generación nueva (HoldAI). Hallazgos de
primera mano sobre cómo manejan "familias":

**Tienen DOS sistemas de familia separados** (dos entidades: `ProductFamily` y
`FeedstockFamily`):

1. **Familias de PRODUCTO**: árbol de 2 niveles (15 familias → subfamilias →
   productos: "Corte y Mecanizado" → "Router CNC y Fresado"). Organiza el
   catálogo comercial. Equivale a nuestras subcategorías comerciales.
2. **Familias de MATERIA PRIMA**: **153 tags PLANOS multi-valor** por material,
   sin jerarquía ni agrupación (un solo grupo en el dropdown). Ej.: "Lámina
   acrílica" = `[Láminas, Plástico, Acrílico]`.

**El vocabulario de esos 153 tags es una bolsa sin gobernanza** que mezcla los
TRES ejes que nosotros separamos, más dos que ni consideraríamos:
composición (Acrílico, MDF, Aluminio, PETG, Policarbonato, PVC, XPS, PSAI,
Latón), formato (Láminas, Hoja, Película, Lonas, Perfiles, Cintas, Vinilos),
acabado/variante (Espejada, Perforado, Fundido=cast, Arenado, Bloqueado,
Retirable, Translúcido, Galvanizado, Alveolar, Compacto), proceso (Láser,
Sublimación, DTF, Solvente, UV, Serigrafía), producto/blank (Taza, Botella,
Mousepad, Copa) y formas de perfil (C, H, J, L, T, U, Cuadrado, Redondo).
Con **duplicados** ("Doble cara" ×2, "Taza" ×2, "Pulido" ×2, "Acero
inoxidable" ×2) y basura de traducción automática ("CLORURO DE POLIVINILO",
"Propina", "Ropa blanca"). Es el anti-ejemplo que valida nuestra separación de
ejes: los tags planos sin ejes degeneran en esto.

**El catálogo de materiales**: ~230 plantillas planas cuyo NOMBRE codifica
formato+composición ("Lámina acrílica", "Chapa de acero galvanizado", "Hoja de
PP"). Cada una está atada a un "Modelo de ingeniería de costos" inmutable
(campo deshabilitado) — el equivalente de nuestros templates. La grilla de
variantes es dimensiones × espesor × color (espesor como atributo, nunca tipo:
acrílico 1×2 m en 2/3/4/5/6/8/10 mm, Cristal/Blanco).

**Aclaración importante — HoldAI ≠ Holdprint clásico**: app.holdworks.ai es un
PRODUCTO NUEVO (rebuild AI-first), no una actualización del Holdprint clásico
(app.holdprint.com) que relevamos en julio. En HoldAI **no existe la entidad
máquina en ninguna parte** (verificado exhaustivamente: menús Inventario /
Costos / Registros / Producción y todos los Ajustes):
- Las 18 plantillas de maquinaria del clásico NO están.
- El centro de costo es simple: tipo (Impresión/Productivo/Instalación/…) +
  hora (Hombre|Máquina) + gastos → valor de la hora. Nada de boca, márgenes,
  perfiles ni consumibles.
- La productividad vive en el PROCESO del producto como fórmula de texto libre
  ("5min + 15 m²/h") generada por IA desde la descripción técnica.
- La compatibilidad producto↔material es una **lista directa de materias
  primas curada por IA** (no vía tags ni grillas material×espesor).
- "Recursos" (Ajustes→Producción) son capacidad de agendado (persona/máquina
  para el planificador), sin parámetros técnicos.
- Un "Checklist" de preguntas guía al presupuestista AI por producto.

Es la apuesta opuesta a la nuestra: donde el clásico tenía el modelo
estructurado (operación×material×espesor→velocidad, FAMILY multi-valor) que
veníamos copiando, HoldAI delega ese criterio al presupuestista AI. Nuestro
motor cotiza determinístico sin IA → la compatibilidad declarativa
(`tiposMaterial[]`) sigue siendo el camino correcto para nosotros, y ahora
además es un diferencial frente a la línea nueva de ellos.

### 3.4 Hallazgos que le dan valor extra al eje

- **Veto por proceso**: imán flexible no pasa por plotter de arrastre;
  microperforado no lamina estándar; lona sin PVC no termosella. El eje veta
  también corte/laminado/confección, no sólo "qué imprime".
- **El patrón calidad (monomérico/polimérico/cast) se repite** en vinilo de
  impresión, de corte y laminado en frío → conviene vocabulario consistente.
- **El coating sublimable es EL dato del merchandising**: se prefieren valores
  explícitos (`ceramica_sublimable`) sobre un flag ortogonal — el blank se
  compra ya polimerizado y nunca cambia de estado.
- **Estados de compatibilidad**: `apto` / `apto_con_precaucion` (HIPS grueso,
  PETG, galvanizado en fibra) / `prohibido` + motivo textual (educa) /
  `no_aplica` (CO2 no corta metal: imposibilidad, no peligro).

## 4. Diseño propuesto

### 4.1 Modelo

- **Catálogo canónico en código** (no enum de Prisma): lista plana de valores
  `{ codigo, nombre, grupo, descripcion }`. El `grupo` es SOLO presentación
  (ordenar selects, como xTool) — sin semántica.
  - Front: `src/lib/tipo-material.ts` (fuente). API: espejo en
    `apps/api/src/…/tipo-material.ts` (mismo criterio que otros catálogos
    duplicados front/API; build roots separados).
  - No-enum porque: ~50+ valores, va a crecer, y deja abierta la extensión por
    tenant sin migración.
- **Campo en MateriaPrima**: `tipoMaterial String?` (nullable — opt-in,
  materiales viejos siguen funcionando). Validado contra el catálogo en el DTO.
- **Consumo en perfiles**: `detalle.tiposMaterial: string[]` (multi-valor,
  patrón Holdprint). El chip-selector busca sobre el catálogo, agrupado.
- **Ortogonal a familia/subfamilia**: no se toca el enum existente. La
  subfamilia sigue siendo el formato (rollo/hoja/rígido) que consume el motor.

### 4.2 Qué NO hace la v1

- No toca el motor (el nesting sigue por subfamilia).
- No matriz de seguridad todavía (F4): primero el vocabulario, después el veto.
- No extensión por tenant todavía: catálogo curado del sistema; si un tenant
  necesita un valor, se agrega al catálogo (como los presets de biblioteca).

### 4.3 Variante que cambia aptitud (para F4)

~6 casos donde la variante DENTRO de la composición cambia aptitud/seguridad,
no sólo velocidad: acrílico cast/extruido (grabado distinto), cuero
vegetal/cromo (cromo hexavalente), cuerina PU/PVC, caucho natural/neopreno
(cloro), MDF crudo/melamínico (gases del film), foam board caras papel/PVC,
bicapa laserable/mecánico. El modelo de compatibilidad debe poder vetar a nivel
`tipoMaterial + variante` (default a nivel tipo). En v1, la variante es un
atributo sugerido de la MP; el veto fino es F4.

## 5. Catálogo propuesto

Nombres en español rioplatense (etiqueta local primero: fibrofácil, polyfan,
alto impacto). ★ = seed v1 (lo que nuestros presets/máquinas actuales ya usan).

### Vinilos autoadhesivos (grupo: Vinilos)
| código | nombre | por qué es valor |
|---|---|---|
| `vinilo_monomerico` ★ | Vinilo monomérico | commodity de impresión; precio base |
| `vinilo_polimerico` | Vinilo polimérico | 1.5–2× precio; curvas suaves |
| `vinilo_cast` | Vinilo cast (wrapping) | 3–5× precio; exige laminado cast |
| `vinilo_microperforado` | Vinilo microperforado (OWV) | perfil propio; no lamina estándar |
| `vinilo_corte_calandrado` ★ | Vinilo de corte calandrado | default del plotter (Oracal 651-tipo) |
| `vinilo_corte_cast` | Vinilo de corte cast | 2–3× precio, larga duración |
| `vinilo_reflectivo` | Vinilo reflectivo | cuchilla 60°/presión; 4–10× precio; atributo grado |
| `vinilo_corte_efectos` | Vinilos de efecto (holo/metal/glitter/fluo) | glitter exige cuchilla 60°; 2–4× |
| `vinilo_esmerilado` | Vinilo esmerilado (frosted) | rubro vidrieras; ~2× |
| `vinilo_pizarra` | Vinilo pizarra | espesor alto → más presión de corte |
| `iman_flexible` | Imán flexible | incompatible con plotter de arrastre (veto) |

### Lonas y textiles de impresión (grupo: Lonas y textiles)
| código | nombre | por qué |
|---|---|---|
| `lona_frontlit` ★ | Lona frontlit | commodity gran formato; atributo fabricación |
| `lona_backlit` ★ | Lona backlit | doble carga de tinta (tiempo 2×); 1.5–2× |
| `lona_blockout` | Lona blockout | doble faz (dos pasadas registradas); ~2× |
| `lona_mesh` | Lona mesh | con/sin liner condiciona impresora |
| `lona_sin_pvc` | Lona ecológica sin PVC | restringe tintas; no termosella igual |
| `textil_bandera` | Tela bandera | traspasa tinta; confección propia |
| `textil_poliester` ★ | Textil poliéster (display/prenda) | único sublimable; sensible a temperatura |
| `textil_backlit` | Textil backlit (SEG) | alta carga; confección con burlete |
| `textil_blackout` | Textil blackout | doble faz textil |
| `canvas` | Canvas/lienzo | perfil foto lento; precio alto |
| `textil_algodon` ★ | Algodón | bloquea sublimación; habilita DTF/serigrafía/bordado |
| `textil_mezcla` | Mezcla algodón/poliéster | sublimación degradada; % como atributo |
| `textil_nylon` | Nylon | HTV específico baja temperatura |

### Papeles y cartones (grupo: Papeles y cartones) — gramaje SIEMPRE atributo
| código | nombre | por qué |
|---|---|---|
| `papel_obra` ★ | Papel obra / bond (incl. rollo CAD) | el commodity; inkjet+tóner |
| `papel_ilustracion` ★ | Papel ilustración (couché) | mate/brillo atributo |
| `cartulina_grafica` ★ | Cartulina (duplex/triplex/SBS) | capas/caras atributo; duplex 1 cara |
| `opalina` ★ | Opalina | nombre canónico argentino de tarjetería |
| `autoadhesivo_papel` ★ | Autoadhesivo papel | liner+adhesivo; manejo especial |
| `autoadhesivo_polipropileno` | Autoadhesivo BOPP/film | no todo fusor lo tolera; precio ↑↑ |
| `papel_sintetico` | Papel sintético (Yupo/PP) | restringe tintas → compat de máquina |
| `papel_texturado_premium` | Texturados (lino, verjurado…) | 3–10× precio; patrón atributo |
| `papel_kraft_reciclado` | Kraft / reciclado | base no blanca |
| `papel_autocopiativo` ★ | Autocopiativo (NCR) | talonarios; microcápsulas |
| `papel_termico` | Papel térmico | incompatible con fusor |
| `papel_fotografico` ★ | Papel fotográfico | SOLO inkjet (coating se funde en fusor) |
| `papel_blueback` | Papel blueback | vía pública con engrudo |
| `carton_gris` ★ | Cartón gris | encuadernación; láser sucio pero estándar |
| `carton_microcorrugado` | Microcorrugado | packaging digital en mesa |
| `carton_nido_abeja` | Cartón nido de abeja (Re-board) | mesa gran espesor; stands |
| `foam_board` | Foam board (cartón pluma) | cuchillo oscilante; caras papel/PVC (PVC veta láser) |

### Plásticos rígidos (grupo: Plásticos rígidos)
| código | nombre | por qué |
|---|---|---|
| `acrilico` ★ | Acrílico (PMMA) | rey del CO2; cast/extruido atributo (F4) |
| `policarbonato` | Policarbonato | NO-láser (BPA/humo); se confunde con acrílico |
| `pvc_espumado` ★ | PVC espumado (Sintra) | nº1 de ruteo/UV; PROHIBIDO láser (cloro) |
| `pvc_solido` | PVC sólido/cristal | densidad ≠ espumado; mismo veto láser |
| `petg` | PET-G | plegable en frío; láser marginal |
| `poliestireno_alto_impacto` | Alto impacto (HIPS) | nombre de mostrador AR; láser sólo finos |
| `polipropileno_celular` | PP corrugado (Coroplast) | cuchillo, no láser; UV con primer |
| `abs` | ABS | PROHIBIDO láser (HCN); termoformado |
| `plastico_bicapa_grabado` | Bicapa de grabado (Rowmark) | placas/trofeos; laserable vs mecánico |

### Maderas (grupo: Maderas)
| código | nombre | por qué |
|---|---|---|
| `mdf` ★ | Fibrofácil (MDF) | EL material del láser argentino; crudo/melamínico atributo (F4) |
| `terciado` | Terciado / multilaminado | cola+huecos → parámetros ≠ MDF |
| `madera_maciza` ★ | Madera maciza | dureza atributo; incl. calabaza (mates) |
| `melamina` | Melamina | mueblería/stands; CNC con compresión, no láser |

### Metales (grupo: Metales)
| código | nombre | por qué |
|---|---|---|
| `aluminio` ★ | Aluminio | único ruteable en router de cartelería; anodizado atributo |
| `acero` ★ | Acero (chapa negra) | fibra/plegado/estructura (incl. perfiles: formato aparte) |
| `acero_galvanizado` | Chapa galvanizada | letras corpóreas; humos de zinc en fibra (aviso) |
| `acero_inoxidable` ★ | Acero inoxidable | corpóreos premium; termos (NO sublimable) |
| `laton_bronce` | Bronce/latón | placas; sólo fibra (reflectivo) |

### Compuestos y especiales (grupo: Compuestos)
| código | nombre | por qué |
|---|---|---|
| `acm` | ACM (aluminio compuesto) | ruteo + V-groove exclusivos; no-láser; premium exterior |
| `polyfan` | Polyfan (XPS alta densidad) | corpóreos CNC/hilo caliente; 100% local; jamás láser |
| `vidrio` | Vidrio | sólo grabado superficial + UV con primer |
| `piedra` | Piedra (granito/mármol) | foto-grabado memorial |
| `ceramica` | Cerámica esmaltada | grabado (Norton) / UV |

### Gomas y cueros (grupo: Gomas y cueros)
| código | nombre | por qué |
|---|---|---|
| `goma_laserable` ★ | Goma para sellos | parámetros propios; familia SELLOS |
| `goma_eva` | Goma EVA | corte barato promocional |
| `caucho_industrial` | Caucho industrial | neopreno PROHIBIDO láser (atributo compuesto, F4) |
| `cuero` | Cuero | vegetal/cromo ES seguridad (F4) |
| `cuero_sintetico` | Ecocuero | PU/PVC ídem (F4) |

### Merchandising / blanks (grupo: Blanks)
| código | nombre | por qué |
|---|---|---|
| `ceramica_sublimable` ★ | Cerámica sublimable | sin coating no hay sublimación |
| `metal_sublimable` | Metal sublimable (ChromaLuxe) | perfil de prensa propio |
| `carton_sublimable` | Cartón polimerizado | rompecabezas/posavasos |
| `plastico_rigido` | Plástico común (PP/PS/policarb.) | UV con primer, tampografía; nunca láser si PVC |

### Laminados y films (grupo: Laminación)
| código | nombre | por qué |
|---|---|---|
| `laminado_bopp` ★ | Film BOPP termolaminado | caliente (imprenta); soft-touch con recargo |
| `laminado_pet` | Film PET | rígido; credenciales/tapas |
| `laminado_pvc_frio` ★ | Laminado PVC en frío | protege vinilos; calidad debe matchear (regla F4) |

### Transferencia (grupo: Transferencia)
| código | nombre | por qué |
|---|---|---|
| `film_dtf` ★ | Film DTF textil | consumible de impresora DTF + horno |
| `film_dtf_uv` | Film DTF UV | otra impresora (rígidos) |
| `htv_flex` | Termotransferible flex (PU) | plotter espejado + plancha 150 °C |
| `htv_flock` | Termotransferible flock | más presión; 160 °C; 2× |
| `htv_efectos` | HTV de efectos | cuchilla 60°; 2–3× |
| `papel_transfer` | Papel transfer | plancha por variante claro/oscuro |
| `papel_sublimacion` ★ | Papel de sublimación | consumible de sublimación |

### Impresión 3D (grupo: 3D)
| código | nombre | por qué |
|---|---|---|
| `filamento_pla` ★ | PLA | el más barato; sin cerramiento |
| `filamento_petg` | PETG | cama caliente media |
| `filamento_abs` | ABS | cámara cerrada OBLIGATORIA (restricción de máquina) |
| `filamento_asa` | ASA | UV-estable (cartelería exterior) |
| `filamento_tpu` | TPU flexible | direct-drive obligatorio |
| `filamento_nylon` | Nylon | secado previo; caro |
| `filamento_compuesto` | Compuestos (carbono/madera) | boquilla endurecida ≥0.6 mm |
| `resina_estandar` | Resina estándar | base |
| `resina_ingenieria` | Resina ingeniería | +50–100% |
| `resina_flexible` | Resina flexible | símil goma |
| `resina_castable` | Resina castable | joyería; post-proceso propio |

### Sellos (grupo: Sellos)
| código | nombre | por qué |
|---|---|---|
| `fotopolimero_sello` | Fotopolímero | otra máquina (expositora UV); sólo tintas al agua |

(La goma laserable ya está en Gomas. Tintas/almohadillas: subfamilia alcanza.)

**Total: ~70 valores, ~25 seed v1.** El picker filtra por relevancia (editar
una MP de familia SUSTRATO no ofrece filamentos) y agrupa por `grupo`.

## 6. Fases

- **F1 — El vocabulario**: catálogo canónico front+API; campo `tipoMaterial` en
  MateriaPrima (nullable) + DTO; select agrupado en la ficha de MP; presets del
  sistema seed con su tipoMaterial (mata el atributo texto libre). Cero cambio
  de motor.
- **F2 — Perfiles lo consumen**: chip-selector multi-valor en perfiles de
  plotter de corte (y el filtro de la selección de perfil del comercial en el
  sheet — Fase 2 del plotter). Reemplaza el patrón "options hardcodeadas".
- **F3 — Migrar láser/CNC**: `materialLaserOptions` → catálogo; el campo
  `material` de esos perfiles pasa a `tiposMaterial[]` (multi-valor, hallazgo
  Holdprint que ya teníamos anotado).
- **F4 — Seguridad y reglas**: matriz proceso×material (apto / precaución /
  prohibido+motivo / no_aplica), veto a nivel variante (cuero al cromo),
  reglas de correspondencia (laminado cast sobre cast).

## 7. Preguntas abiertas

1. **¿Extensión por tenant?** v1: catálogo curado del sistema. La industria no
   tiene estándar (cada uno cura la suya) y LightBurn/Ruby asumen usuario-crea.
   Si un tenant lo pide, el modelo (string + catálogo, no enum) ya lo permite.
2. **HTV como valores vs subfamilia**: dos informes divergen. Los dejamos como
   valores (los procesan las MISMAS máquinas — plotter/plancha — con parámetros
   distintos por tipo, que es el test del eje; distinto de las tintas, 1:1 con
   su máquina).
3. **¿`papel_sintetico` y `autoadhesivo_polipropileno` se fusionan?** Ambos son
   PP; difieren en adhesivo y rubro (cartelería vs etiquetas). v1: separados.
4. **Espejo front/API**: duplicado consciente (como otros catálogos) o paquete
   compartido. v1: duplicado con test de paridad.
