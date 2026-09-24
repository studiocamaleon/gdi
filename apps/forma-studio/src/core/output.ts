import { MaxRectsPacker } from "maxrects-packer";
import { zipSync, strToU8 } from "fflate";
import { jsPDF } from "jspdf";
import type { Contours, Model, Part, Placement, Project } from "./types";
import { LIGHTBOX_SIDE_PROFILES } from "./lightbox-side";
import { LIGHTBOX_MOUNT_STYLES } from "./lightbox-mount";
import { STYLES } from "./project";

export function printingPart(part: Part): Part {
  if(!part.print)return part;
  return {...part,positions:part.print.positions,bounds:part.print.bounds,contours:part.print.contours,print:undefined,printFlip:false};
}

export function download(
  data: BlobPart | Uint8Array,
  name: string,
  type = "application/octet-stream",
) {
  const bytes = data instanceof Uint8Array ? Uint8Array.from(data) : data;
  const blob = new Blob([bytes], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function stl(parts: Part[], normalize = false): ArrayBuffer {
  const triangles = parts.reduce((s, p) => s + p.indices.length / 3, 0);
  const buffer = new ArrayBuffer(84 + triangles * 50),
    view = new DataView(buffer);
  const title = new TextEncoder().encode("Grafo3D | mm | solid geometry");
  new Uint8Array(buffer, 0, 80).set(title);
  view.setUint32(80, triangles, true);
  let at = 84;
  for (const source of parts) {
    const part=normalize?printingPart(source):source;
    for (let i = 0; i < part.indices.length; i += 3) {
      const ps = [0, 1, 2].map((n) =>
        [0, 1, 2].map((axis) =>
          Math.fround(
            (normalize && part.printFlip && axis !== 1
              ? part.bounds.max[axis] +
                part.bounds.min[axis] -
                part.positions[part.indices[i + n] * 3 + axis]
              : part.positions[part.indices[i + n] * 3 + axis]) -
              (normalize ? part.bounds.min[axis] : 0),
          ),
        ),
      );
      const u = ps[1].map((v, a) => v - ps[0][a]),
        v = ps[2].map((v, a) => v - ps[0][a]);
      const normal = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ],
        length = Math.hypot(...normal);
      // La conversión de doble precisión a STL Float32 puede colapsar aristas
      // diminutas. No enviamos caras sin superficie al laminador.
      if (length === 0) continue;
      for (const n of [...normal.map((v) => v / length), ...ps.flat()]) {
        view.setFloat32(at, n, true);
        at += 4;
      }
      view.setUint16(at, 0, true);
      at += 2;
    }
  }
  view.setUint32(80, (at - 84) / 50, true);
  return at === buffer.byteLength ? buffer : buffer.slice(0, at);
}
export function dxf(contours: Contours): string {
  const out = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  for (const polygon of contours) {
    out.push("0", "POLYLINE", "8", "CORTE", "66", "1", "70", "1");
    for (const [x, y] of polygon)
      out.push(
        "0",
        "VERTEX",
        "8",
        "CORTE",
        "10",
        x.toFixed(5),
        "20",
        y.toFixed(5),
        "30",
        "0",
      );
    out.push("0", "SEQEND");
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\r\n");
}
export function svgContours(contours: Contours): string {
  const points = contours.flat();
  if (!points.length) return '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const minX = Math.min(...points.map((v) => v[0])),
    minY = Math.min(...points.map((v) => v[1])),
    maxX = Math.max(...points.map((v) => v[0])),
    maxY = Math.max(...points.map((v) => v[1]));
  const paths = contours
    .map(
      (c) =>
        `M${c.map(([x, y]) => `${(x - minX).toFixed(4)},${(maxY - y).toFixed(4)}`).join("L")}Z`,
    )
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX - minX}mm" height="${maxY - minY}mm" viewBox="0 0 ${maxX - minX} ${maxY - minY}"><path fill="none" stroke="black" stroke-width="0.1" fill-rule="evenodd" d="${paths}"/></svg>`;
}
export function packParts(
  parts: Part[],
  project: Project,
): { placements: Placement[]; oversized: Part[]; beds: number } {
  const { bedWidth, bedHeight, bedDepth, gap, rotate } = project.production;
  const packer = new MaxRectsPacker(bedWidth, bedHeight, gap, {
    smart: false,
    pot: false,
    square: false,
    allowRotation: rotate,
  });
  const oversized: Part[] = [];
  for (const source of parts) {
    const part=printingPart(source);
    const width = part.bounds.max[0] - part.bounds.min[0],
      height = part.bounds.max[1] - part.bounds.min[1];
    if (((part.material==="filament"||part.material==="flexible") && part.bounds.max[2]-part.bounds.min[2]>bedDepth) || !(
      (width <= bedWidth && height <= bedHeight) ||
      (rotate && height <= bedWidth && width <= bedHeight)
    )) {
      oversized.push(part);
      continue;
    }
    packer.add(width, height, { part });
  }
  const placements: Placement[] = [];
  packer.bins.forEach((bin, bed) =>
    bin.rects.forEach((rect) =>
      placements.push({
        part: rect.data.part,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        rotated: rect.rot,
        bed,
      }),
    ),
  );
  return { placements, oversized, beds: packer.bins.length };
}
export function placedPart(placement: Placement): Part {
  const { part, x, y, rotated } = placement,
    positions = new Float32Array(part.positions.length);
  const h = part.bounds.max[1] - part.bounds.min[1];
  for (let i = 0; i < positions.length; i += 3) {
    const px = part.positions[i] - part.bounds.min[0],
      py = part.positions[i + 1] - part.bounds.min[1];
    const printX = part.printFlip
      ? part.bounds.max[0] - part.bounds.min[0] - px
      : px;
    positions[i] = x + (rotated ? h - py : printX);
    positions[i + 1] = y + (rotated ? printX : py);
    positions[i + 2] = part.printFlip
      ? part.bounds.max[2] - part.positions[i + 2]
      : part.positions[i + 2] - part.bounds.min[2];
  }
  return { ...part, positions, printFlip: false };
}
export function costs(project: Project, model: Model) {
  const c = project.production;
  const volume = model.parts
    .filter((p) => p.material === "filament")
    .reduce((s, p) => s + p.volume, 0);
  const flexibleVolume=model.parts.filter(p=>p.material==="flexible").reduce((s,p)=>s+p.volume,0);
  const flexibleSolidMass=flexibleVolume/1000*c.flexibleDensity;
  const solidMass = (volume / 1000) * c.density + flexibleSolidMass,
    wasteFactor = 1 + c.waste / 100;
  const mass = solidMass * wasteFactor,
    hours = mass / Math.max(0.1, c.gramsHour);
  const acrylicArea =
    model.parts
      .filter((p) => p.material === "acrylic")
      .reduce((s, p) => s + p.area, 0) / 1e6;
  const pvcArea =
    model.parts
      .filter((p) => p.material === "pvc")
      .reduce((s, p) => s + p.area, 0) / 1e6;
  const pvc = pvcArea * wasteFactor * c.pvcM2;
  const flexibleMass=flexibleSolidMass*wasteFactor;
  const flexible=flexibleMass/1000*c.flexiblePriceKg;
  const filament = ((mass-flexibleMass) / 1000) * c.priceKg,
    machine = hours * c.machineHour,
    acrylic = acrylicArea * wasteFactor * c.acrylicM2;
    const cost = filament + flexible + machine + acrylic + pvc,
    price = cost / (1 - Math.min(c.margin, 95) / 100);
  return {
    solidMass,
    flexibleMass,
    flexible,
    mass,
    hours,
    acrylicArea,
    pvcArea,
    pvc,
    filament,
    machine,
    acrylic,
    cost,
    price,
  };
}
export function quoteEnvelope(project: Project, model: Model) {
  return {
    schema: "grafo.fabrication-design",
    version: project.mode === "lightbox" ? 3 :
      project.mode === "letters" &&
      ["acrylic-fit", "printed-fit", "perforated"].includes(project.style) &&
      project.params.fitBaseType !== "legacy"
        ? 2
        : 1,
    units: "mm",
    source: {
      application: "forma-studio",
      version: "0.1.0",
      projectId: project.id,
      name: project.name,
    },
    generatedAt: new Date().toISOString(),
    design: {
      mode: project.mode,
      style: project.mode==="lightbox"?"circular-double-face":project.style,
      parameters: project.mode === "lightbox" ? project.lightbox : project.mode === "joint" ? project.joint : project.params,
      ...(model.lightbox?{lightbox:model.lightbox}:{}),
      ...(model.perforation
        ? {
            perforation: {
              holes: model.perforation.holes,
              openAreaMm2: model.perforation.openArea,
              frontAreaMm2: model.perforation.frontArea,
            },
          }
        : {}),
      dimensions: {
        width: model.width,
        height: model.height,
        depth: model.depth,
      },
    },
    ...(model.lightbox?{purchasedComponents:{rimScrews:{...model.lightbox.rimFasteners,materialKind:"commercial",includedInEstimate:false},mountScrews:{...model.lightbox.mount.bodyScrews,materialKind:"commercial",includedInEstimate:false},mountInserts:{...model.lightbox.mount.inserts,materialKind:"commercial",includedInEstimate:false},wallAnchors:{quantity:model.lightbox.mount.wallAnchors,materialKind:"commercial",includedInEstimate:false}}}:{}),
    components: model.parts.map((p) => ({
      id: p.id,
      name: p.name,
      layer: p.layer,
      materialKind: p.material,
      ...(p.print?{printDimensionsMm:p.print.bounds.max.map((v,i)=>v-p.print!.bounds.min[i])}:{}),
      quantity: 1,
      widthMm: p.bounds.max[0] - p.bounds.min[0],
      heightMm: p.bounds.max[1] - p.bounds.min[1],
      depthMm: p.bounds.max[2] - p.bounds.min[2],
      volumeMm3: p.volume,
      surfaceAreaMm2: p.surface,
      cutAreaMm2: p.area,
      cutPerimeterMm: p.perimeter,
      contoursMm: p.contours,
    })),
    estimates: {
      ...costs(project, model),
      currency: project.production.currency,
      assumptions: {
        density: project.production.density,
        wastePercent: project.production.waste,
        gramsPerHour: project.production.gramsHour,
        pricePerKg: project.production.priceKg,
        machineHour: project.production.machineHour,
        acrylicM2: project.production.acrylicM2,
        pvcM2: project.production.pvcM2,
        marginPercent: project.production.margin,
      },
    },
    warnings: model.warnings,
  };
}
export function bundle(project: Project, model: Model): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const part of model.parts) {
    if (part.material === "filament" || part.material === "flexible")
      files[`impresion/${part.material === "flexible" ? "flexible/" : ""}${part.id}.stl`] = new Uint8Array(stl([part], true));
    else {
      files[`corte/${part.material}/${part.id}.dxf`] = strToU8(
        dxf(part.contours),
      );
      files[`corte/${part.material}/${part.id}.svg`] = strToU8(
        svgContours(part.contours),
      );
    }
  }
  for (const template of model.cutTemplates || [])
    files[`corte/plantillas/${template.name}.dxf`] = strToU8(
      dxf(template.contours),
    );
  files["proyecto.forma.json"] = strToU8(JSON.stringify(project, null, 2));
  files["grafo-fabricacion.json"] = strToU8(
    JSON.stringify(quoteEnvelope(project, model), null, 2),
  );
  if(model.lightbox){
    files["MONTAJE-BANDEROLA.txt"]=strToU8(model.lightbox.assembly.map((v,i)=>`${i+1}. ${v}`).join("\n\n"));
    files["componentes-comerciales.json"]=strToU8(JSON.stringify({
      note:"Cantidades de preparación, sin precios. Fuente, cableado y anclajes a dimensionar según los componentes reales y la instalación.",
      lighting:{status:model.lightbox.lighting,note:"Sistema de iluminación pendiente de definir; sin cantidad, potencia ni fijaciones calculadas."},
      wallAnchors:model.lightbox.mount.wallAnchors,remotePowerSupply:null,
      mountInserts:{...model.lightbox.mount.inserts,note:"Insertos M4 por calor instalados en el brazo antes del montaje. Alojamiento a ajustar según fabricante y filamento. No se imprimen."},
      mountScrews:{...model.lightbox.mount.bodyScrews,note:"Cuatro tornillos desde adentro hacia afuera, roscados en insertos del brazo. Sumar la arandela al evaluar el largo y dejar margen antes del fondo ciego. No se imprimen."},
      rimScrews:{...model.lightbox.rimFasteners,note:model.lightbox.rimClosure==="snap"?"Cierre click impreso; no utiliza tornillos en los aros.":"Tornillos para plástico a seleccionar y ensayar. Pilotos lisos; no hay rosca ni tornillos impresos. Elegir un largo menor que underHeadLengthMax."},
    },null,2));
    files["piezas.json"]=strToU8(JSON.stringify(model.parts.map(p=>({id:p.id,name:p.name,material:p.material,quantity:1})),null,2));
    for(const side of ["a","b"] as const){
      const art=project.faceArtwork?.[side];
      if(art){const [header,data]=art.split(",");const ext=header.includes("png")?"png":header.includes("webp")?"webp":"jpg";
        files[`graficas/cara-${side}.${ext}`]=Uint8Array.from(atob(data),ch=>ch.charCodeAt(0));}
    }
  }
  files["LEEME.txt"] = strToU8(
    "Grafo3D · Unidades: milímetros. Los STL individuales se apoyan en Z=0. Los archivos de corte conservan la escala 1:1. Validá holguras con una muestra y procesá los STL con el laminador de tu impresora. Los tiempos y consumos son estimaciones de sólido, no una simulación de trayectorias.",
  );
  return zipSync(files, { level: 6 });
}
export function technicalPdf(
  project: Project,
  model: Model,
  number: string,
): ArrayBuffer {
  const doc = new jsPDF();
  const c = costs(project, model);
  let y = 20;
  const text = (s: string, size = 10, width = 176) => {
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(s, width)) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 16, y);
      y += size * 0.5 + 2;
    }
  };
  const money = (v: number) => `${project.production.currency} ${v.toFixed(2)}`;
  doc.setTextColor(11, 17, 23);
  if (project.production.logo) {
    try {
      const format = project.production.logo.startsWith("data:image/jpeg")
        ? "JPEG"
        : "PNG";
      const props = doc.getImageProperties(project.production.logo),
        width = 24,
        height = Math.min(18, (width * props.height) / props.width);
      doc.addImage(
        project.production.logo,
        format,
        165,
        12,
        (height * props.width) / props.height,
        height,
      );
    } catch {
      /* El texto y el documento siguen disponibles si el logo no se puede decodificar. */
    }
  }
  text(
    project.production.company || "Grafo3D",
    20,
    project.production.logo ? 140 : 176,
  );
  text("FICHA DE PRODUCCIÓN · " + number, 10);
  text(project.name, 16);
  doc.setTextColor(55, 60, 58);
  text(project.production.contact);
  text(new Date().toLocaleString("es-AR"));
  text(
    `Construcción: ${project.mode === "lightbox" ? "Banderola circular de doble cara" : project.mode === "joint" ? "Encastre esférico" : STYLES.find((s) => s.id === project.style)?.name}`,
  );
  text(
    `Dimensiones: ${model.width.toFixed(1)} × ${model.height.toFixed(1)} × ${model.depth.toFixed(1)} mm`,
  );
  text(
    `Piezas: ${model.parts.length} | Filamento: ${project.production.filament}`,
  );
  text(
    `Masa sólida: ${c.solidMass.toFixed(1)} g | Consumo con merma: ${c.mass.toFixed(1)} g`,
  );
  text(
    `Impresión estimada: ${c.hours.toFixed(1)} h | Acrílico neto: ${c.acrylicArea.toFixed(4)} m² | PVC neto: ${c.pvcArea.toFixed(4)} m²`,
  );
  text(
    `Costo estimado: ${money(c.cost)} | Precio orientativo: ${money(c.price)}`,
  );
  if(model.lightbox){
    const mount=model.lightbox.mount;
    if(mount.enabled)text(`Un brazo central ${LIGHTBOX_MOUNT_STYLES[mount.style].label.toLowerCase()}, separado del cuerpo. ${mount.bodyScrews.quantity} tornillos M4 con arandelas desde el interior, roscados en ${mount.inserts.quantity} insertos por calor. Alojamiento ciego: Ø${mount.inserts.holeDiameter} x ${mount.inserts.holeDepth} mm. Cabezas ocultas dentro del cartel. ${mount.wallAnchors} anclajes al muro. Herrajes comerciales fuera del costo local.`,9);
    const screws=model.lightbox.rimFasteners;
    if(model.lightbox.rimClosure==="snap"){
      text(`Aros con cierre click: ${model.lightbox.snapTabsPerFace} pestañas integradas por cara. Liberar los uñeros hacia afuera antes de extraer el aro. Ensayar ajuste y reaperturas con el filamento real.`,9);
    }else{
    text(`Aros envolventes con ${screws.quantity} tornillos laterales comerciales, no incluidos en el costo local. Paso en aro: ${screws.clearanceDiameter} mm. Piloto ciego: ${screws.pilotDiameter} mm de diámetro y ${screws.pilotDepth} mm de profundidad.`,9);
    text("Probar tornillo, largo y apriete sobre el filamento real. Retirar los tornillos antes de extraer los aros. La tornillería no se genera como STL.",9);
    }
    text("Interior libre: sistema de iluminación y fijaciones LED pendientes de definir.",9);
    const lateral=model.lightbox.sideProfile;
    if(lateral.kind!=="smooth")text(`Lateral ${LIGHTBOX_SIDE_PROFILES[lateral.kind]}: relieve exterior de ${lateral.relief.toFixed(1)} mm entre Z ${lateral.from.toFixed(1)} y ${lateral.to.toFixed(1)} mm. Diámetro máximo del lateral: ${lateral.maxDiameter.toFixed(1)} mm. Encastres cilíndricos y zona de soportes sin relieve.`,9);
  }
  y += 4;
  text("COMPONENTES", 12);
  for (const part of model.parts) {
    if (y > 248) {
      doc.addPage();
      y = 20;
    }
    text(
      `${part.name} · ${part.material === "filament" ? project.production.filament : part.material === "flexible" ? "Filamento flexible" : part.material === "pvc" ? "PVC" : "Acrílico"}`,
      10,
    );
    text(
      `${(part.bounds.max[0] - part.bounds.min[0]).toFixed(1)} × ${(part.bounds.max[1] - part.bounds.min[1]).toFixed(1)} × ${(part.bounds.max[2] - part.bounds.min[2]).toFixed(1)} mm | Volumen: ${(part.volume / 1000).toFixed(2)} cm³`,
      9,
    );
    const estimate = costs(project, { ...model, parts: [part] });
    text(
      part.material === "filament" || part.material === "flexible"
        ? `Consumo: ${estimate.mass.toFixed(1)} g | Tiempo: ${estimate.hours.toFixed(2)} h | Costo: ${money(estimate.cost)}`
        : `Área de corte: ${(part.area / 1e6).toFixed(4)} m² | Perímetro: ${(part.perimeter / 1000).toFixed(2)} m | Costo: ${money(estimate.cost)}`,
      9,
    );
  }
  y += 4;
  text("CONTROL DE PRODUCCIÓN", 12);
  for (const line of project.production.checklist.split("\n").filter(Boolean))
    text("[  ] " + line, 10);
  y += 4;
  for (const line of doc.splitTextToSize(
    "Estimaciones calculadas desde el sólido y las tarifas configuradas. El laminador determina el consumo y tiempo finales. Probar tolerancias de encastre con una muestra antes de producir el conjunto.",
    176,
  ))
    text(line, 9);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 114);
    doc.text(`Grafo3D | ${number}`, 16, 287);
    doc.text(`${page} / ${pages}`, 194, 287, { align: "right" });
  }
  return doc.output("arraybuffer");
}
