# Pasos de cartelería — revisión de idioma y familias (2026-08-10)

> **Estado**: ANÁLISIS — decisión pendiente con el usuario. Disparador: la ruta
> del Cartel backlight cuesta leerla ("¿por qué la chapa trasera es *Montado
> sobre material*? ¿por qué la soldadura es *Trabajo manual*?"). Contexto
> previo: [derivadores-geometricos-diseno.md](derivadores-geometricos-diseno.md)
> (la mecánica), [pasos-tenant-por-plantilla-diseno.md](pasos-tenant-por-plantilla-diseno.md)
> (el mecanismo de instancias), [carteleria-configurador-diseno.md](carteleria-configurador-diseno.md) §15.

## 1. El diagnóstico en una frase

La **mecánica** de la ruta está bien y fue decidida a propósito (80% motor
genérico, golden master de por medio); lo que falla es el **idioma**: tres
oficios reales del taller viajan disfrazados de familias genéricas, y armar
esos pasos exige saber recetas no obvias.

## 2. La ruta real del backlight, paso por paso

| # | Paso (ruta) | Familia | ¿Se entiende? |
|---|---|---|---|
| 1 | Fabricación de estructura | `estructura_bastidor` | ✅ familia propia, deriva la geometría |
| 2 | Soldadura | `trabajo_manual` | ⚠️ oficio real disfrazado — la receta es "heredar `puntos_soldadura`" |
| 3 | Pintura de estructura | `pintura_superficial` | ✅ familia propia, hereda `pintura_m2` |
| 4 | Impresión de lona | `impresion_por_area` | ✅ estándar de gran formato |
| 5 | Chapa trasera | `montaje_sobre_sustrato` | ❌ **nada se "monta sobre" nada** — el oficio es *cortar la chapa de la hoja y colocarla*. La receta: `fuentePiezasMontaje: piezas_visibles` + costeo por tramos + hoja 1220×2440 |
| 6 | Iluminación LED | `iluminacion_led` | ✅ familia propia |
| 7 | Tensado de lona | `trabajo_manual` | ⚠️ oficio real disfrazado |
| 8 | Cenefas | `trabajo_manual` | ⚠️ hereda `cenefa_m2` con slot chapa por m² teórico (×1,08) — el doc de derivadores ya anota como pendiente pasarla a hojas reales |

Lo que confunde no es UN paso: es que el modelador tiene que **traducir**
oficio → familia genérica → receta de configuración, y esa traducción vive en
la cabeza (o en un doc), no en el catálogo.

## 3. Por qué NO conviene resolverlo con ifs ni familias-por-producto

- La regla de oro de derivadores sigue vigente: producto nuevo = a lo sumo un
  derivador puro; jamás un if de rubro en el motor.
- La poda del catálogo (33→30 familias) fue en la dirección contraria a
  inflar el catálogo del sistema con azúcar.
- `montaje_sobre_sustrato` **es** el comportamiento correcto para la chapa
  trasera (nesting de hoja + tramos + tiempo por pieza); el problema es el
  nombre y los defaults, no la mecánica.

## 4. La propuesta: dos niveles

### Nivel A — sin código: instancias PasoTenant con nombre de oficio (AHORA)

El mecanismo ya existe y está COMPLETO (pasos-tenant-por-plantilla): una
instancia hereda la ficha completa de su plantilla (derivador, nesting,
primitivas) y aporta **su nombre y sus defaults**. Crear en el catálogo del
tenant:

| Instancia (nombre de oficio) | Plantilla | Defaults que trae |
|---|---|---|
| **Corte y colocación de chapa** | `montaje_sobre_sustrato` | fuente de piezas `piezas_visibles`, costeo por tramos, slot chapa (hoja) |
| **Soldadura de estructura** | `trabajo_manual` | hereda `puntos_soldadura`, ritmo por puntos, slot insumos de soldadura (preset `MP.soldadura`) |
| **Tensado / colocación de lona** | `trabajo_manual` | ritmo por m² o por pieza |

Resultado: el selector de pasos y la ruta hablan en idioma de taller, y la
receta queda EMPAQUETADA en la instancia — no hay que redescubrirla por
producto. Es literalmente el caso de uso que el doc de instancias llama
"huecos del catálogo" (§2.2).

### Nivel B — con código: promover a familias del SISTEMA (cuando toque provisión)

Si cartelería se empaqueta como plantilla provisionable para tenants nuevos,
esas 3 recetas convienen como familias del catálogo Grafo
(`corte_chapa`, `soldadura_estructura`, `colocacion_lona`): pura declaración
en `familias.ts` (cero motor), con compat de slots más estricta (chapa) y el
nombre correcto para todos. Hacerlo HOY duplicaría lo que las instancias
resuelven gratis; hacerlo al provisionar es un paso del empaquetado.

### Mejores ya aplicadas hoy (independientes de la decisión)

- Chips de variantes distinguen hoja 1220×2440 vs carga por m² (plantilla
  chapa declara presentación/ancho/alto) — era la "deuda cosmética" de la
  Etapa 4.
- El guard del montaje diagnostica la causa real: variante sin medidas de
  hoja (`montaje_material_sin_medidas`) en vez del genérico "revisá el
  material y la fuente de piezas".
- `sustrato_montaje` acepta chapa metálica (compat que faltaba).

## 5. Pendientes técnicos que este análisis confirma (ya anotados en derivadores §8d)

- **Cenefa por hojas**: hoy cotiza m² teóricos ×1,08; el derivador ya conoce
  el desarrollo (perímetro × (D + 2·solapa)) — puede publicar las TIRAS como
  despiece y nestearlas en la misma hoja de chapa que el fondo.
- `minimoCompra` genérico (§4.3).
- Diagnóstico fino de barras del bastidor.

## 6. Decisión pendiente

1. ¿Vamos por Nivel A ya (3 instancias en el tenant Grafoprint + re-apuntar
   la ruta del backlight)? Ojo hallazgo §8d: el motor cotiza del SNAPSHOT de
   `RutaVersion` — re-apuntar pasos exige re-publicar la ruta.
2. ¿El nombre humano de `montaje_sobre_sustrato` ("Montado sobre material")
   se retoca a algo como "Corte y montaje de material en hoja" mientras tanto?
3. ¿La cenefa por hojas entra como próxima etapa de derivadores o queda en
   backlog?
