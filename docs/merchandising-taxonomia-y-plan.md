# Merchandising y textil — taxonomía, catálogo y plan de implementación

> 2026-07-13. Complementa `productos-comprados-merchandising-diseno.md` (el
> modelo) con **el catálogo completo** de blanks a personalizar y el **plan** para
> tenerlos disponibles en la biblioteca (instalables por preset o alta manual).
> Catálogo grounded en proveedores argentinos reales (fuentes al final).

## 1. Objetivo

Tener disponibles, para agregar rápido a la biblioteca, todos los **blanks**
(artículos comprados por unidad que se decoran) tanto **objetos promocionales**
como **textiles / indumentaria**, con su clasificación, ejes de variante y
técnicas de decoración aplicables. Dos vías: **instalación por preset** (1 click,
catálogo curado) y **alta manual** (el usuario carga uno propio con un template).

## 2. Taxonomía

### 2.1 Ejes de clasificación

| Nivel | Objetos | Textiles | Dónde vive hoy |
|---|---|---|---|
| Rama (subfamilia) | `OBJETO_PROMOCIONAL_BASE` | `TEXTIL_INDUMENTARIA` | `MateriaPrima.subfamilia` (ambas ya existen) |
| Es blank comprado | `esProductoBase = true` | idem | `MateriaPrima.esProductoBase` (ya existe) |
| Categoría (grupo comercial) | Drinkware, Escritura, … (11) | Remeras, Buzos, … (11) | **A agregar** (metadata para navegar/filtrar) |
| Tipo | Taza, Termo, Lapicera… | Remera, Buzo, Gorra… | `atributosTecnicosJson.tipoObjeto/tipoPrenda` (ya en el template) |
| Variante | color/modelo/capacidad/material | talle × color (± tela/gramaje) | `MateriaPrimaVariante.atributosVarianteJson` |

Todo cae en la familia `SUSTRATO` (para no romper compatibilidad del motor), con
`unidadStock/Compra = UNIDAD` y `precioReferencia` por unidad en cada variante.

### 2.2 Ejes de variante y precio

- **Objetos**: `modelo` y `color` casi universales; `capacidad` (drinkware),
  `material` (mate, llavero, portarretrato), `medida` (impresos planos). Precio
  **por variante**.
- **Textiles**: `talle` (con rango) + `color` casi universal; `tela`/`material` y
  `gramaje` cuando aplica. Precio **plano dentro de un rango de talles**, con
  **recargo en talles especiales/grandes** y **precio por talle numérico** en
  indumentaria laboral (camisas, pantalones, mamelucos). → mejora futura: precio
  por rango de talle (hoy es por variante, se puede repetir el mismo precio).

### 2.3 Técnicas de decoración → familia de proceso (paso del motor)

La técnica NO es propiedad del blank: define qué **familia de paso** usa la ruta
del producto. El blank solo declara qué técnicas admite (metadata sugerida).

| Técnica | Familia de proceso | Estado | Sustrato típico |
|---|---|---|---|
| DTF UV | `impresion_por_area` (DTF_UV) + `aplicacion_transfer` (manual) | ✅ existe | rígidos: tazas, botellas |
| DTF textil | `impresion_por_area` (DTF_TEXTIL) + `aplicacion_transfer` | ✅ existe | algodón/mixto |
| Sublimación | `impresion_por_area` (SUBLIMACION) + `aplicacion_transfer`, o `impresion_por_pieza` | ✅ existe | poliéster / rígidos con coating |
| DTG | `impresion_por_pieza` | ✅ existe | algodón |
| Grabado láser | `grabado_laser` | ✅ existe | madera/metal/acrílico/vidrio |
| Impresión UV | `impresion_por_area` (UV) / `impresion_por_pieza` | ✅ existe | rígidos |
| Serigrafía (por color) | serigrafía | ⛔ familia por crear | textil/rígido |
| Bordado (por puntada) | bordado | ⛔ familia por crear | textil |
| Tampografía | tampografía | ⛔ familia por crear | rígidos chicos |
| Vinilo textil de corte | corte + `aplicacion_transfer` | ⚠️ parcial | textil |

## 3. Modelo de datos (cómo cae cada blank)

```
MateriaPrima {
  familia: SUSTRATO
  subfamilia: OBJETO_PROMOCIONAL_BASE | TEXTIL_INDUMENTARIA
  esProductoBase: true
  templateId: objeto_promocional_base_v1 | textil_indumentaria_v1
  unidadStock/Compra: UNIDAD
  atributosTecnicosJson: { categoria, tipoObjeto|tipoPrenda, material, ... }
  variantes: [ MateriaPrimaVariante {
    atributosVarianteJson: { color, modelo|talle, capacidad|tela, ... }
    precioReferencia: <precio de compra por unidad>  // null hasta que el usuario cargue
  } ]
}
```

## 4. Plan de implementación

**Fase A — HECHO** (2026-07-13): flag `esProductoBase`, subfamilia
`TEXTIL_INDUMENTARIA`, templates `objeto_promocional_base_v1` /
`textil_indumentaria_v1`, alta manual template-driven, seed Taza + Remera, modo
"sin medida" en el producto, familia `aplicacion_transfer` manual/máquina.

**Fase B — Biblioteca instalable + navegación**
- **B0 · Categoría (metadata):** agregar campo `categoria` a los dos templates
  (con opciones = las 11+11 categorías) y un filtro/agrupador por categoría en la
  UI de biblioteca. Costo chico; habilita navegar por rubro.
- **B1 · Catálogo de presets:** autor los presets de blanks (MaterialPreset +
  MaterialPresetVariante) en `material-presets.js`, organizados por categoría,
  **precio null**, con variantes representativas. Se instalan con el flujo
  existente (`InstallMaterialPreset`). Priorización por volumen de negocio:
  - **Tanda 1 (alta demanda):** Drinkware (taza, taza mágica, termo, botella,
    mate, vaso), Remera (algodón, dama, niño), Buzo (canguro, redondo), Gorra
    (trucker, gabardina), Lapicera, Tote bag, Mousepad, Llavero, Cuaderno/Agenda,
    Posavasos. (~25 presets, cubre el 80% de la demanda)
  - **Tanda 2:** resto de objetos (tecnología, oficina, hogar/bazar, regalería,
    bolsos) + textiles (chombas, camperas, trabajo, bebé, deportivo, hogar textil,
    accesorios).
  - **Tanda 3:** cola larga (escolar, salud, automotor, nichos).
- **B2 · Editor de matriz de variantes:** generar color × talle (S–XXL × N
  colores) de una para acelerar el alta textil, evitando cargar 30 variantes a
  mano.

**Fase C — Rutas sugeridas por técnica (futuro)**
- Vincular blank + técnica → plantilla de ruta sugerida (ej. crear "Taza DTF UV"
  auto-arma impresión por área + aplicación de transfer con los slots cableados).
- Crear las familias de proceso faltantes: serigrafía (por color), bordado (por
  puntada), tampografía.

## 5. Decisiones abiertas (para arrancar Fase B)

1. **Arranque de presets:** ¿Tanda 1 (alta demanda) o todo el catálogo?
2. **Campo `categoria`:** ¿lo agrego ahora (para navegar por rubro) o después?
3. **Matriz de variantes color×talle:** ¿en esta fase o Fase C?
4. **Precio:** null (el usuario carga). Ya decidido; se mantiene.

---

## Apéndice A — Catálogo de objetos promocionales (~150)

Formato: **nombre** — ejes · técnicas · material.

### Drinkware
Taza cerámica · Taza mágica/termocrómica · Taza cónica · Taza interior color ·
Jarro enlozado (peltre) · Jarro/vaso térmico c/tapa · Hoppy · Chopp cervecero ·
Vaso de vidrio (pinta/long drink) · Vaso plástico reutilizable · Tumbler c/sorbete
· Copa (vino/champagne/gin) · Botella deportiva · Botella térmica acero · Botella
vidrio c/funda · Bidón deportivo · Termo (mate) · Termo pico cebador/bala · Mate
(imperial/camionero) · Mate autocebante · Bombilla · Set matero · Yerbera/azucarera
· Matera (bolso) · Shaker/coctelera · Cantimplora · Petaca · Enfriador de latas.

### Escritura
Lapicera plástica · Lapicera metálica · Lapicera ecológica (cartón/bambú/trigo) ·
Roller/gel · Lapicera premium (estuche) · Lápiz madera/plantable · Portaminas ·
Resaltador · Marcador/fibrón · Set de escritura · Lapicera c/stylus · Bolígrafo
multifunción.

### Oficina / escritorio
Cuaderno tapa dura · Cuaderno ecológico (kraft/corcho) · Agenda · Libreta/anotador
· Block autoadhesivas (tacos) · Carpeta/portafolio · Mousepad · Pad gamer ·
Portarretratos · Tarjetero · Portalápices/organizador · Calendario de escritorio ·
Almanaque de pared · Señalador · Set de escritorio · Pisapapeles · Portagafetes ·
Regla de escritorio · Sello personalizado.

### Tecnología
Pen drive · Power bank · Parlante Bluetooth · Auriculares BT/earbuds · Auriculares
c/cable · Cargador inalámbrico · Cable/cargador retráctil · Hub USB · Soporte de
celular · Soporte para auto · Aro de luz LED · Mouse · Cubre webcam · Popsocket ·
Luz LED/velador USB · Lámpara acrílico 3D · Ventilador USB/mano · Reloj despertador
digital · Cargador solar · Termómetro/estación de escritorio.

### Llavería y accesorios
Llavero acrílico · metálico · madera/MDF · PU/cuero · silicona/PVC · c/destapador ·
linterna/LED · antiestrés/flotante · Pin/prendedor (botón) · Pin esmaltado · Imán
de heladera · Destapador/abridor · Chapita identificadora · Portallaves de pared ·
Lanyard/cinta portacredencial · Cinta métrica llavero.

### Hogar / bazar
Posavasos · Individual/mantel individual · Tabla de picada/asado · Tabla de cocina
· Delantal (lona) · Portavelas · Alcancía · Cenicero · Reloj de pared · Reloj de
escritorio · Bandeja · Salvamanteles/apoya ollas · Sacacorchos/set de vino · Set de
asado · Cuchillo criollo · Frasco/mug de vidrio c/tapa · Maceta/macetero · Difusor
de aromas.

### Bolsos / estuches rígidos
Neceser rígido · Estuche rígido (lentes/tecnología) · Valija rígida · Mochila
rígida/antirrobo · Portanotebook/funda notebook · Conservadora/cooler · Lonchera/
vianda rígida · Vianda/tupper (set) · Portaviandas térmico apilable.

### Escolar
Regla/juego de geometría · Cartuchera rígida · Compás · Sacapuntas · Goma de
borrar · Mochila escolar · Set escolar · Pizarra/pizarrita.

### Salud / cuidado personal
Alcohol en gel (botella/dispenser) · Dispenser de escritorio · Pastillero ·
Termómetro digital · Espejo de bolsillo/compacto · Set de manicura · Cepillo/peine
· Protector solar/labial (blank) · Balanza de baño · Porta barbijo (case).

### Automotor / herramientas
Set de herramientas · Multiherramienta/pinza · Navaja/cuchillo plegable · Cinta
métrica (flexómetro) · Linterna · Llavero linterna/silbato · Cargador de auto ·
Vaso térmico para auto · Rasqueta/removedor de hielo · Parasol/cubre volante ·
Manómetro.

### Regalería / eventos
Medalla · Trofeo/copa · Plaqueta/placa · Galvano/cuadro reconocimiento ·
Reconocimiento acrílico 3D/cristal · Abanico · Paraguas/sombrilla · Pelota
antiestrés · Peluche/muñeco antiestrés · Ancheta/caja de regalo · Rompecabezas/
puzzle · Juego de mesa/naipes/dados · Globo de nieve · Banderín/bandera de mano ·
Pulsera de evento (silicona) · Corbatín/moño · Portacelular flotante/brazalete ·
Souvenir grabado (llavero/imán/plaqueta).

## Apéndice B — Catálogo de textiles / indumentaria (~105)

Formato: **nombre** — talle · tela · técnicas · nota de precio.

### Remeras
Remera clásica algodón peinado (S-XXL) · Talles especiales/grandes (recargo) ·
Niño (4-16) · Dama entallada · Babylook/corte femenino · Cuello V · Manga larga ·
Musculosa · Remerón/oversize · Boxy fit · Ranglan (mangas contrastadas) · Crop top
· Deportiva dry-fit/poliéster · Técnica microperforada · Térmica frizada · Body de
dama.

### Camisas y chombas
Chomba piqué clásica · Chomba dama · Chomba niño · Chomba deportiva poliéster
(sublimable) · Camisa de vestir · Camisa de trabajo grafa/ombú.

### Buzos y abrigo
Buzo cuello redondo (frisa) · Canguro/hoodie · Canguro oversize · Media cierre ·
Cierre completo c/capucha · Niño · Dama entallado · Mini buzo/crop · Polar
(micropolar) · Chaleco frisa/polar · Sweater/pulóver de hilo.

### Camperas
Rompevientos · Softshell · Polar · Inflable/puffer · De trabajo/abrigo laboral ·
Piluso rompeviento.

### Gorras y sombreros
Trucker · Trucker niño · Gabardina (6 paños) · Plana/snapback · Full sublimable ·
Piluso/bucket · Visera · Gorro de lana/beanie · Sombrero de ala.

### Bolsos y tela
Tote bag · Ecobag (friselina/algodón) · Morral/bandolera · Mochila de tela/gym
sack · Riñonera de tela · Bolso matero · Bolso deportivo/bolsón · Cartuchera/estuche
de tela · Portanotebook de tela.

### Indumentaria de trabajo
Ambo sanitario · Chomba de trabajo · Camisa grafa · Pantalón (grafa/cargo) ·
Mameluco enterizo · Pechera/jardinero · Guardapolvo/delantal escolar · Delantal
gastronómico · Delantal a la cintura (bistró) · Chaqueta de chef · Remera/chaleco
alta visibilidad · Cofia/gorro sanitario.

### Bebé y niños
Body (manga corta/larga) · Babero · Mameluco/osito · Ranita/pantaloncito · Remera
bebé · Conjunto (body + gorro) · Manta plush sublimable.

### Deportivo
Camiseta de fútbol (sublimable) · Short deportivo · Conjunto (camiseta + short) ·
Camiseta de básquet · Pantalón de jogging (frisa) · Calza deportiva · Remera árbitro
· Pechera/peto de entrenamiento.

### Hogar textil
Toalla de mano · Toallón · Toalla de gimnasio (microfibra) · Bandera de tela ·
Pañuelo/bandera de mano · Mantel/camino de mesa · Almohada/funda · Manta/frazada
polar · Repasador/paño · Individual textil · Bata/salida de baño.

### Accesorios textiles
Bandana/pañuelo multiuso · Cuello polar/buff · Medias · Gorro de lana · Guantes/
mitones · Cinta/vincha deportiva · Bufanda/chalina · Corbata sublimable · Lanyard
de tela · Neceser de neoprene.

## Apéndice C — Fuentes (catálogos reales consultados)

- **Objetos:** Zecat, Elementi, Promoproductos (IMPROM), Promoempre, Blocko,
  Ecoshop, Promosud, Matila Estampados / AJsublim, Elemento Láser, Webstore.
- **Textiles:** Kingtex, Ronaldtex, Duchos, Textil Once, SubliTextil, Danitex,
  Crear Indumentaria, Reycar, RGS, Linco, Lo Más Sublimado, Remerasya, Gala Design,
  HT5, 2SantosPrint, Racat, Viento Textil, Tienda Los Ángeles, Sublimables.
