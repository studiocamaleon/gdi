# Integración del Hotwire Linker en Grafo

## Objetivo

Agregar al flujo de nesting de Grafo una etapa CAM para la cortadora de polifan:

```text
Nesting SVG
→ generación automática de uniones
→ revisión/simulación
→ exportación TAP
→ GRBL Control
```

El motor está escrito en TypeScript y no depende del DOM, Canvas ni librerías nativas. Puede ejecutarse en un servicio NestJS, una función Node o un worker.

## Recomendación de arquitectura

La geometría y la exportación TAP deberían ejecutarse en el backend. La interfaz recibe `linkedSvg`, `routeSvg`, `bridges`, `metrics` y `report` para representar y revisar el resultado.

```text
Next.js / editor de nesting
        │ SVG final
        ▼
API NestJS / servicio de producción
        │ generateHotwireJob()
        ├── TAP
        ├── route.json
        ├── report.json
        └── preview SVG/HTML
```

Razones para ejecutarlo del lado servidor:

- resultado determinista;
- validación centralizada del perfil de máquina;
- persistencia de la versión exacta del TAP asociada a la OT;
- posibilidad de re-generar y auditar;
- evita diferencias entre navegadores.

## Instalación como workspace

Puede copiarse la carpeta dentro del monorepo:

```text
packages/
└── hotwire-linker/
```

Luego agregarla como dependencia interna del backend:

```json
{
  "dependencies": {
    "@grafo/hotwire-linker": "workspace:*"
  }
}
```

## Llamada básica

```ts
import { generateHotwireJob } from "@grafo/hotwire-linker";

const result = generateHotwireJob({
  svg: nesting.svg,
  sourceName: `placa-${plate.id}.svg`,
});
```

La configuración por defecto ya corresponde a Corporearte:

- cama útil: 1250 × 600 mm;
- origen inferior izquierdo;
- origen automático debajo/a la izquierda del bounding box;
- entrada de 8 mm;
- `F350`;
- `Z.24`;
- seis decimales;
- encabezado de VectorLinker;
- CRLF;
- sin footer.

## Persistencia recomendada

Guardar estos datos junto a la placa o trabajo de producción:

```ts
interface HotwirePlateRevision {
  id: string;
  plateId: string;
  engineVersion: string;       // 1.0.0
  machineProfileId: string;
  sourceSvg: string;
  linkedSvg: string;
  tap: string;
  routeJson: unknown;
  reportJson: unknown;
  createdAt: Date;
  createdByUserId: string;
  status: "DRAFT" | "REVIEWED" | "SENT_TO_MACHINE";
}
```

No conviene regenerar silenciosamente un TAP ya aprobado: cualquier cambio del motor, perfil o SVG debe crear una revisión nueva.

## API sugerida

```ts
@Post(":plateId/hotwire/generate")
async generateHotwire(@Param("plateId") plateId: string) {
  const plate = await this.platesService.getWithSvg(plateId);

  const job = generateHotwireJob({
    svg: plate.nestingSvg,
    sourceName: `plate-${plate.id}.svg`,
  });

  return {
    linkedSvg: job.linkedSvg,
    routeSvg: job.routeSvg,
    routeMachine: job.routeMachine,
    bridges: job.bridges,
    metrics: job.metrics,
    report: job.report,
    tapBase64: Buffer.from(job.tap, "ascii").toString("base64"),
  };
}
```

Para descargar el TAP, devolverlo como bytes ASCII y no como JSON para preservar CRLF:

```ts
@Get(":revisionId/download.tap")
async downloadTap(@Param("revisionId") revisionId: string, @Res() res: Response) {
  const revision = await this.hotwireService.getRevision(revisionId);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${revision.fileName}"`);
  res.end(Buffer.from(revision.tap, "ascii"));
}
```

## Pantalla recomendada

Después del nesting, agregar una etapa **Preparar corte de polifan** con:

- vista de la placa;
- contornos negros;
- uniones externas verdes;
- accesos a huecos violetas;
- origen azul;
- orden numerado;
- animación de recorrido;
- coordenadas X/Y;
- longitud de contornos;
- longitud de uniones;
- tiempo estimado;
- límites X/Y;
- advertencias.

Acciones:

```text
Regenerar uniones
Cambiar origen
Simular
Aprobar recorrido
Descargar TAP
```

## Origen

El SVG de Grafo usa Y hacia abajo. La máquina usa Y hacia arriba. El motor conserva visualmente la orientación mediante la transformación correspondiente.

Por defecto, el origen automático se calcula con el bounding box de todas las piezas:

```ts
originSvg.x = bounds.minX - 8 mm
originSvg.y = bounds.maxY + 8 mm
```

Los valores se limitan al área SVG. Ese punto se convierte en `X0 Y0` en el TAP.

Grafo puede permitir que el operario arrastre el origen y volver a generar:

```ts
const job = generateHotwireJob({
  svg,
  originSvg: { x: 2, y: 414.463 },
});
```

El motor rechaza coordenadas negativas o fuera de la cama cuando `strictBounds` está activo.

## Edición manual de uniones

La versión actual resuelve automáticamente el recorrido y entrega información suficiente para construir la edición manual:

```ts
job.bridges
job.routeSvg
job.routeMachine
```

Una siguiente iteración puede incorporar:

```ts
manualBridges?: Array<{
  fromContourId: string;
  fromPoint: { x: number; y: number };
  toContourId: string;
  toPoint: { x: number; y: number };
}>;
```

La UI debería ajustar puntos sobre el perímetro más cercano y volver a validar:

- intersección con contornos;
- cruce con otras uniones;
- conectividad total;
- límites de máquina;
- regreso al origen.

## Manejo de errores

Errores típicos que deben mostrarse al operario:

- path abierto;
- comando SVG no aplanado;
- path con `transform`;
- contorno fuera del área SVG;
- origen fuera del SVG;
- nesting imposible de vincular sin atravesar piezas;
- coordenadas negativas;
- recorrido fuera de 1250 × 600 mm.

No ocultar estos errores ni exportar el TAP automáticamente ante una validación fallida.

## Versionado del perfil

El perfil de máquina no debe quedar repartido en código de UI. Mantenerlo como configuración versionada:

```text
config/corporearte-polifan-1250x600.json
```

Si cambia `F`, `Z`, encabezado, cama o decimales, registrar una versión nueva del perfil y conservar la utilizada en cada OT.

## Validación previa al lanzamiento

Antes de habilitarlo como opción productiva:

1. Abrir el TAP del Puma en GRBL Control sin enviarlo.
2. Comparar orientación y límites de la previsualización.
3. Ejecutar con el hilo apagado.
4. Verificar que vuelve al cero.
5. Probar dos rectángulos simples.
6. Probar una letra con hueco.
7. Probar el Puma completo en una placa de descarte.
8. Guardar el TAP validado como fixture de regresión.

La lista completa está en `docs/VALIDACION_MAQUINA.md`.
