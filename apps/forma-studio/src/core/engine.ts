import type {
  CrossSection,
  Manifold,
  ManifoldToplevel,
  Vec3,
} from "manifold-3d";
import type { EngineInput, Model, Part, Layer, Contours, Point } from "./types";
import { LAYER_NAMES, styleDefaults } from "./project";
import { createLetter } from "./letter-models";
import { parseJoint } from "./storage";
import { componentLabel } from "./fit-assembly";
import { assemblyDirection, frontDirection } from "./assembly";
import { MAX_PATTERN_HOLES } from "./perforation";
import { createLightbox, type LightboxSolid } from "./lightbox-geometry";

export const signedArea = (p: Point[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
export const perimeter = (p: Contours) =>
  p.reduce(
    (s, c) =>
      s +
      c.reduce((d, a, i) => {
        const b = c[(i + 1) % c.length];
        return d + Math.hypot(a[0] - b[0], a[1] - b[1]);
      }, 0),
    0,
  );

export function buildModel(wasm: ManifoldToplevel, input: EngineInput): Model {
  const start = performance.now(),
    project = {
      ...input.project,
      params: {
        ...styleDefaults(input.project.style),
        ...input.project.params,
      },
    },
    p = project.params;
  const { CrossSection: CS, Manifold: M } = wasm;
  const owned = new Set<{ delete(): void }>();
  const keep = <T extends { delete(): void }>(v: T): T => {
    owned.add(v);
    return v;
  };
  const warnings: string[] = [];
  const perforation = { holes: 0, openArea: 0, frontArea: 0 };
  const parts: Part[] = [];
  let lightbox: Model["lightbox"];
  const cutTemplates: NonNullable<Model["cutTemplates"]> = [];
  const appliedFeatures = new Set<string>();
  const section = (polys: Contours) => keep(new CS(polys, "EvenOdd"));
  const offset = (s: CrossSection, d: number) =>
    keep(s.offset(d, p.corner === "Bevel" ? "Square" : p.corner, 2, 48));
  const diff = (a: CrossSection, b: CrossSection) => keep(a.subtract(b));
  const move = (m: Manifold, v: Vec3) => keep(m.translate(v));
  const union = (ms: Manifold[]) => keep(M.union(ms));
  const subtract = (a: Manifold, b: Manifold) => keep(a.subtract(b));
  const extrude = (s: CrossSection, h: number, z = 0) =>
    move(keep(s.extrude(Math.max(0.01, h))), [0, 0, z]);
  const circle = (r: number) => keep(CS.circle(Math.max(0.01, r), 48));
  const rect = (w: number, h: number, r: number) => {
    r = Math.max(0, Math.min(r, w / 2 - 0.001, h / 2 - 0.001));
    const square = keep(
      CS.square([Math.max(0.002, w - 2 * r), Math.max(0.002, h - 2 * r)], true),
    );
    return keep(square.offset(r, "Round", 2, 48));
  };
  const cyl = (h: number, r: number, rTop = r, z = 0) =>
    move(
      keep(
        M.cylinder(Math.max(0.01, h), Math.max(0.01, r), Math.max(0, rTop), 48),
      ),
      [0, 0, z],
    );
  const ring = (s: CrossSection, width: number) => diff(s, offset(s, -width));
  function finish(
    solid: Manifold,
    layer: Layer,
    index: number,
    material: Part["material"] = "filament",
    spec?: LightboxSolid,
  ) {
    let solids = [solid];
    if (input.mode === "letters")
      for (const cut of project.cuts) {
        const next: Manifold[] = [];
        for (const m of solids) {
          const normal: Vec3 = cut.axis === "x" ? [1, 0, 0] : [0, 1, 0];
          const reverse = normal.map((v) => -v) as Vec3;
          const a = keep(m.trimByPlane(normal, cut.at + cut.gap / 2));
          const b = keep(m.trimByPlane(reverse, -cut.at + cut.gap / 2));
          if (!a.isEmpty()) next.push(a);
          if (!b.isEmpty()) next.push(b);
        }
        solids = next;
      }
    solids.forEach((source, segment) => {
      if (source.isEmpty() || source.volume() < 0.001) return;
      // El STL almacena Float32. Eliminar aristas por debajo de esa precisión
      // en el sólido cerrado, antes de exportar, evita agujeros al redondear.
      const box = source.boundingBox();
      const precision = Math.max(
        0.001,
        ...[...box.min, ...box.max].map((v) => Math.abs(v) * 2 ** -22),
      );
      const roundedMesh = source.getMesh();
      for (let i = 0; i < roundedMesh.vertProperties.length; i++)
        roundedMesh.vertProperties[i] =
          Math.round(roundedMesh.vertProperties[i] / precision) * precision;
      roundedMesh.tolerance = precision;
      let m = keep(new M(roundedMesh));
      let mesh = m.getMesh();
      const collapsed = () => {
        const v = mesh.vertProperties,
          ids = mesh.triVerts,
          stride = mesh.numProp;
        for (let i = 0; i < ids.length; i += 3) {
          const a = ids[i] * stride,
            b = ids[i + 1] * stride,
            c = ids[i + 2] * stride;
          const ux = v[b] - v[a],
            uy = v[b + 1] - v[a + 1],
            uz = v[b + 2] - v[a + 2];
          const vx = v[c] - v[a],
            vy = v[c + 1] - v[a + 1],
            vz = v[c + 2] - v[a + 2];
          if (
            uy * vz - uz * vy === 0 &&
            uz * vx - ux * vz === 0 &&
            ux * vy - uy * vx === 0
          )
            return true;
        }
        return false;
      };
      // El redondeo puede convertir dos triángulos de una unión en una aleta
      // colineal. Simplificar el sólido cerrado repara sus aristas; omitir esas
      // caras al escribir STL dejaría una abertura. Sólo se aplica si hace falta.
      for (const factor of [1, 3, 6]) {
        if (!collapsed()) break;
        // Limpiar las coordenadas Float32 que recibirá el archivo, no los
        // vértices internos de doble precisión que todavía tenían superficie.
        const serialized = keep(
          new M(
            new wasm.Mesh({
              numProp: mesh.numProp,
              vertProperties: mesh.vertProperties,
              triVerts: mesh.triVerts,
            }),
          ),
        );
        m = keep(serialized.simplify(precision * factor));
        mesh = m.getMesh();
      }
      if (collapsed())
        throw new Error(
          "La malla contiene caras colapsadas y no puede exportarse. Revisá las dimensiones del perfil.",
        );
      if (m.isEmpty() || m.volume() < 0.001) return;
      const state = m.status();
      if (state !== "NoError")
        throw new Error(
          `Geometría inválida en ${LAYER_NAMES[layer]}: ${state}`,
        );
      const positions = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++)
        for (let a = 0; a < 3; a++)
          positions[i * 3 + a] = mesh.vertProperties[i * mesh.numProp + a];
      const profile = keep(m.project());
      const contours = profile.toPolygons();
      let print: Part["print"];
      if(spec?.printRotation){
        const [rx,ry,rz]=spec.printRotation.map(v=>v*Math.PI/180);
        const rotated=new Float32Array(positions.length);
        for(let i=0;i<positions.length;i+=3){
          let x=positions[i],y=positions[i+1],z=positions[i+2];
          [y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];
          [x,z]=[x*Math.cos(ry)+z*Math.sin(ry),-x*Math.sin(ry)+z*Math.cos(ry)];
          [x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];
          rotated.set([x,y,z],i);
        }
        const printSolid=keep(new M(new wasm.Mesh({numProp:3,vertProperties:rotated,triVerts:mesh.triVerts})));
        print={positions:rotated,bounds:printSolid.boundingBox(),contours:keep(printSolid.project()).toPolygons()};
      }
      parts.push({
        id: spec?.id ?? `${layer}-${index}-${segment}`,
        name: spec?.name ?? `${componentLabel(project, layer)} ${index + 1}${solids.length > 1 ? ` · sección ${segment + 1}` : ""}`,
        ...(print?{print}:{}),
        ...(spec?.motion?{motion:spec.motion}:{}),
        ...(spec?.snapTabs?{snapTabs:spec.snapTabs}:{}),
        layer,
        material,
        assemblyDirection: assemblyDirection(project, layer),
        printFlip:
          (layer === "face" &&
            material === "filament" &&
            project.style === "organic" &&
            p.organicShell) ||
          (layer === "back" &&
            material === "filament" &&
            (["acrylic-fit", "printed-fit", "perforated", "halo"].includes(
              project.style,
            ) ||
              (project.style === "organic" && p.organicFit === "back"))),
        positions,
        indices: new Uint32Array(mesh.triVerts),
        volume: m.volume(),
        surface: m.surfaceArea(),
        bounds: m.boundingBox(),
        contours,
        area: profile.area(),
        perimeter: perimeter(contours),
      });
    });
  }
  try {
    if(input.mode === "lightbox"){
      const generated=createLightbox(wasm,keep,project);
      generated.parts.forEach((part,i)=>finish(part.solid,part.layer,i,part.material || "filament",part));
      cutTemplates.push(...generated.templates);
      warnings.push(...generated.warnings);
      lightbox=generated.metadata;
    } else if (input.mode === "joint") {
      const j = parseJoint(project.joint);
      if (
        j.neck >= j.ball ||
        j.clearance < 0 ||
        j.retention < 0 ||
        j.socketTop < j.ball + j.clearance + 2
      )
        throw new Error(
          "Revisá el cuello, la esfera y el espesor del alojamiento.",
        );
      let flange = extrude(
        rect(j.flangeLength, j.flangeWidth, j.flangeRadius),
        j.flangeHeight,
      );
      for (const x of [-j.screwSpacing / 2, j.screwSpacing / 2]) {
        flange = subtract(
          flange,
          move(cyl(j.flangeHeight + 2, j.screw / 2, j.screw / 2, -1), [
            x,
            0,
            0,
          ]),
        );
        flange = subtract(
          flange,
          move(
            cyl(
              j.recessDepth + 0.1,
              j.recess / 2,
              j.recess / 2,
              j.flangeHeight - j.recessDepth,
            ),
            [x, 0, 0],
          ),
        );
      }
      if (j.notches)
        for (const y of [-j.flangeWidth / 2, j.flangeWidth / 2])
          flange = subtract(
            flange,
            move(cyl(j.flangeHeight + 2, j.notch / 2, j.notch / 2, -1), [
              0,
              y,
              0,
            ]),
          );
      const neckZ = j.flangeHeight + j.baseHeight;
      const cz =
        neckZ +
        j.neckHeight +
        Math.sqrt(Math.max(0, (j.ball / 2) ** 2 - (j.neck / 2) ** 2));
      let ball = move(keep(M.sphere(j.ball / 2, 64)), [0, 0, cz]);
      const top =
        cz +
        Math.sqrt(
          Math.max(
            0,
            (j.ball / 2) ** 2 - (Math.min(j.flatTop, j.ball) / 2) ** 2,
          ),
        );
      ball = keep(ball.trimByPlane([0, 0, -1], -top));
      let pin = union([
        flange,
        cyl(
          j.baseHeight,
          j.baseDiameter / 2,
          j.baseDiameter / 2,
          j.flangeHeight,
        ),
        cyl(j.neckHeight + 1, j.neck / 2, j.neck / 2, neckZ),
        cyl(Math.max(0.01, j.fillet), j.neck / 2 + j.fillet, j.neck / 2, neckZ),
        ball,
        cyl(
          j.tipDiameter / 2 / Math.tan((j.tipAngle * Math.PI) / 360),
          j.tipDiameter / 2,
          0,
          top - 0.01,
        ),
      ]);
      if (j.centralHole > 0)
        pin = subtract(
          pin,
          cyl(
            j.flangeHeight + j.baseHeight,
            j.centralHole / 2,
            j.centralHole / 2,
            -0.1,
          ),
        );
      const cavityR = (j.ball + j.clearance) / 2;
      const openingR = Math.max(0.5, j.ball / 2 - j.retention);
      const sphereZ =
        j.socketHeight -
        Math.sqrt(Math.max(0, cavityR * cavityR - openingR * openingR));
      let socket = union([
        cyl(j.socketHeight, j.socketBottom / 2, j.socketTop / 2),
        cyl(j.socketFlangeHeight, j.socketFlange / 2),
      ]);
      const cavity = move(keep(M.sphere(cavityR, 64)), [0, 0, sphereZ]);
      socket = subtract(
        socket,
        union([
          cavity,
          cyl(j.socketHeight + 2, j.socketScrew / 2, j.socketScrew / 2, -1),
          cyl(
            j.chamfer + 0.1,
            openingR,
            openingR + j.chamfer,
            j.socketHeight - j.chamfer,
          ),
          cyl(
            j.countersink / 2,
            j.countersink / 2,
            j.socketScrew / 2,
            j.socketHeight * 0.12,
          ),
        ]),
      );
      for (let i = 0; i < j.slots; i++) {
        let slot = move(
          keep(M.cube([j.socketTop, j.slotWidth, j.slotLength + 1])),
          [0, -j.slotWidth / 2, j.socketHeight - j.slotLength],
        );
        slot = keep(slot.rotate([0, 0, (i * 360) / j.slots]));
        socket = subtract(socket, slot);
        if (j.rootRelief) {
          const relief = move(
            keep(
              keep(
                cyl(j.socketTop, j.slotWidth * 0.7).rotate([0, 90, 0]),
              ).rotate([0, 0, (i * 360) / j.slots]),
            ),
            [0, 0, j.socketHeight - j.slotLength],
          );
          socket = subtract(socket, relief);
        }
      }
      if (j.fingerThin > 0) {
        const outerSkin = cyl(
          Math.max(0.1, j.slotLength - 2),
          (j.ball + j.clearance) / 2 + j.fingerThin,
          (j.ball + j.clearance) / 2 + j.fingerThin,
          j.socketHeight - j.slotLength + 2,
        );
        const lower = cyl(
          j.socketHeight - j.slotLength + 2,
          j.socketFlange / 2 + 1,
        );
        socket = keep(socket.intersect(union([outerSkin, lower])));
      }
      if (j.tilt) {
        pin = keep(pin.rotate([j.tilt, 0, 0]));
        socket = keep(socket.rotate([j.tilt, 0, 0]));
      }
      finish(pin, "pin", 0);
      finish(
        move(socket, [j.flangeLength / 2 + j.socketFlange / 2 + 12, 0, 0]),
        "socket",
        0,
      );
      const flex =
        ((1.5 * j.fingerThin * j.retention) / Math.max(1, j.slotLength ** 2)) *
        100;
      warnings.push(
        `Flexión geométrica estimada: ${flex.toFixed(2)} %. Validá el encastre con una muestra del material y la orientación elegidos.`,
      );
    } else {
      if (!input.shapes.length)
        throw new Error("El diseño no contiene contornos cerrados.");
      if (input.shapes.flat(3).some((v) => !Number.isFinite(v)))
        throw new Error("El diseño contiene coordenadas inválidas.");
      if (p.wall <= 0 || p.innerWall < 0 || p.height <= 0 || p.clearance < 0)
        throw new Error("Los espesores y la altura deben ser positivos.");
      let all = keep(CS.union(input.shapes.map(section)));
      if (p.mirror) {
        const bounds = all.bounds();
        all = keep(
          keep(all.scale([-1, 1])).translate([
            bounds.max[0] + bounds.min[0],
            0,
          ]),
        );
      }
      const regions = all.decompose().map(keep);
      if (regions.length > 160)
        throw new Error(
          "El diseño supera las 160 piezas. Dividilo en proyectos más pequeños.",
        );
      if (project.style === "curved") {
        const bounds = all.bounds(),
          cx = (bounds.min[0] + bounds.max[0]) / 2;
        const radius = p.curveRadius + p.curveCenter;
        if (radius <= 0)
          throw new Error(
            "El radio y el centro deben dejar el eje de giro fuera de la letra.",
          );
        const baseZ = p.curveBase ? p.curveBaseThickness : 0;
        const letters: Manifold[] = [];
        for (const shape of regions) {
          const radial = section(
            shape
              .toPolygons()
              .map((c) =>
                c.map(([x, y]) => [radius + y - bounds.min[1], x - cx]),
              ),
          );
          const revolved = keep(
            radial.revolve(
              Math.max(20, Math.round(p.curveSegments)),
              p.curveAngle,
            ),
          );
          letters.push(
            keep(
              revolved.warp((v) => {
                const [x, y, z] = v;
                v[0] = z;
                v[1] = x - radius;
                v[2] = y + baseZ;
              }),
            ),
          );
        }
        let base: Manifold | undefined;
        if (p.curveBase) {
          const width = bounds.max[0] - bounds.min[0] + 2 * p.curveSide;
          const height =
            bounds.max[1] - bounds.min[1] + 2 * p.curveDepth + p.curveAdvance;
          const profile = keep(
            rect(width, height, p.curveBaseRadius).translate([
              0,
              (bounds.max[1] - bounds.min[1] - p.curveAdvance) / 2,
            ]),
          );
          base = extrude(profile, p.curveBaseThickness);
          if (p.curveSeparate) {
            const depth = Math.min(p.curveFitDepth, p.curveBaseThickness - 0.5);
            for (let i = 0; i < letters.length; i++) {
              const footprint = keep(letters[i].slice(baseZ + 0.001));
              const tongue = extrude(footprint, depth, baseZ - depth);
              letters[i] = union([letters[i], tongue]);
              base = subtract(
                base,
                extrude(
                  offset(footprint, p.curveFitClearance),
                  depth + 0.01,
                  baseZ - depth,
                ),
              );
            }
            finish(base, "back", 0);
          }
        }
        if (base && !p.curveSeparate)
          finish(union([...letters, base]), "body", 0);
        else letters.forEach((m, i) => finish(m, "body", i));
      } else
        for (const [index, s] of regions.entries()) {
          let {
            body,
            face,
            back,
            pvc,
            faceMaterial,
            backMaterial,
            cavity,
            perforation: pattern,
          } = createLetter(wasm, keep, s, project.style, p);
          if (pattern) {
            perforation.holes += pattern.holes;
            perforation.openArea += pattern.openArea;
            perforation.frontArea += pattern.frontArea;
            if (perforation.holes > MAX_PATTERN_HOLES)
              throw new Error(
                "El cartel supera los 8000 huecos de calado. Aumentá su tamaño o separación.",
              );
            if (!pattern.holes)
              warnings.push(
                `Pieza ${index + 1}: el patrón no cabe dentro del borde protegido; su frente queda sin calar.`,
              );
          }
          const H = Math.max(p.base + p.height, body.boundingBox().max[2]);
          if (["solid-back", "double-led"].includes(project.style)) {
            const led = offset(
              s,
              -p.wall -
                p.innerWall -
                (project.style === "double-led" ? 1 : 0.5),
            );
            if (!led.isEmpty())
              cutTemplates.push({
                name: `base-led-${index + 1}`,
                contours: led.toPolygons(),
              });
          }
          if (cavity.isEmpty())
            warnings.push(
              `Pieza ${index + 1}: el trazo es más fino que la pared; queda macizo.`,
            );
          for (const feature of project.features) {
            const b = s.bounds();
            if (
              feature.x < b.min[0] ||
              feature.x > b.max[0] ||
              feature.y < b.min[1] ||
              feature.y > b.max[1]
            )
              continue;
            const f = keep(
              (feature.shape === "slot"
                ? rect(feature.width, feature.height, feature.radius)
                : circle(feature.diameter / 2)
              ).translate([feature.x, feature.y]),
            );
            if (feature.type === "hole") {
              const before =
                body.volume() + (back?.volume() || 0) + (pvc?.volume() || 0);
              body = subtract(body, extrude(f, H + 50, -1));
              if (back) back = subtract(back, extrude(f, H + 50, -1));
              if (pvc) pvc = subtract(pvc, extrude(f, H + 50, -1));
              if (
                before -
                  body.volume() -
                  (back?.volume() || 0) -
                  (pvc?.volume() || 0) >
                0.0001
              )
                appliedFeatures.add(feature.id);
            } else {
              const footprint = keep(
                circle(p.pinDiameter / 2).translate([feature.x, feature.y]),
              );
              const supported = keep(footprint.intersect(s));
              if (supported.area() < footprint.area() * 0.98) {
                warnings.push("Un pin está fuera del contorno y no se agregó.");
                continue;
              }
              const h = p.pinHeight || p.height;
              let pin = extrude(footprint, h, p.base);
              if (p.pinHole > 0)
                pin = subtract(
                  pin,
                  extrude(
                    keep(
                      circle(p.pinHole / 2).translate([feature.x, feature.y]),
                    ),
                    h + 0.2,
                    p.base + 0.2,
                  ),
                );
              body = union([body, pin]);
              appliedFeatures.add(feature.id);
            }
          }
          finish(body, "body", index);
          if (face) finish(face, "face", index, faceMaterial);
          if (back) finish(back, "back", index, backMaterial);
          if (pvc) finish(pvc, "pvc", index, "pvc");
          if (p.liner && !cavity.isEmpty())
            finish(
              extrude(
                ring(offset(cavity, -0.2), 0.6),
                Math.max(1, p.height - p.acrylic - p.ledge),
                p.base,
              ),
              "liner",
              index,
            );
        }
    }
    if (input.mode === "letters")
      project.features.forEach((feature, index) => {
        if (!appliedFeatures.has(feature.id))
          warnings.push(
            `${feature.type === "hole" ? "Perforación" : "Pin"} ${index + 1}: no toca una zona válida de la pieza. Revisá su posición.`,
          );
      });
    if (!parts.length)
      throw new Error("Los parámetros no producen piezas fabricables.");
    if (
      project.style === "perforated" &&
      input.mode === "letters" &&
      !perforation.holes
    )
      throw new Error(
        "El patrón no cabe en el frente protegido. Aumentá la letra o reducí el tamaño de los huecos y el borde.",
      );
    const mins = [0, 1, 2].map((a) =>
        Math.min(...parts.map((v) => v.bounds.min[a])),
      ),
      maxs = [0, 1, 2].map((a) =>
        Math.max(...parts.map((v) => v.bounds.max[a])),
      );
    return {
      ...(lightbox?{lightbox}:{}),
      ...(project.style === "perforated" && input.mode === "letters"
        ? { perforation }
        : {}),
      frontDirection: frontDirection(project),
      parts,
      cutTemplates,
      warnings: [...new Set(warnings)],
      width: maxs[0] - mins[0],
      height: maxs[1] - mins[1],
      depth: maxs[2] - mins[2],
      duration: performance.now() - start,
    };
  } finally {
    for (const obj of [...owned].reverse()) obj.delete();
  }
}
