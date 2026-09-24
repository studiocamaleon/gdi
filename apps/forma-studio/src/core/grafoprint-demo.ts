import { chooseStyle, newProject } from "./project";

// Isologo de tres nodos usado por la web. Los trazos se expanden a áreas
// rellenas para que el ejemplo sea fabricable por el mismo motor del editor.
const nodes = [[5.5, 6.5], [18, 6.5], [12, 17.5]] as const;
const edges = nodes.map((a, index) => {
  const b = nodes[(index + 1) % nodes.length];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = ((b[1] - a[1]) / length) * 0.7;
  const y = ((a[0] - b[0]) / length) * 0.7;
  return `<polygon points="${a[0] + x},${a[1] + y} ${b[0] + x},${b[1] + y} ${b[0] - x},${b[1] - y} ${a[0] - x},${a[1] - y}"/>`;
}).join("");

export const GRAFOPRINT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="#ff7546">${edges}${nodes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join("")}</g></svg>`;

export function grafoprintDemo() {
  const project = chooseStyle(newProject(), "acrylic-fit");
  project.name = "Isologo Grafoprint";
  project.source = {
    ...project.source,
    mode: "svg",
    svg: GRAFOPRINT_SVG,
    fileName: "grafoprint-isologo.svg",
    height: 200,
  };
  project.params = {
    ...project.params,
    height: 28,
    wall: 1.6,
    innerWall: 1.6,
    borderWidth: 1,
    fitBaseType: "flush",
    fitBaseHeight: 12,
    traySheet: 2,
    acrylic: 3,
    corner: "Round",
  };
  project.colors = {
    ...project.colors,
    body: "#262b30",
    face: "#ff7546",
    back: "#c2c7ca",
  };
  return project;
}

export function editorDraft(search: string) {
  const example = new URLSearchParams(search).get("ejemplo") === "grafoprint";
  return {
    // El ejemplo tiene su propio borrador y no pisa el trabajo anterior.
    key: example ? "forma.autosave.grafoprint" : "forma.autosave",
    create: example ? grafoprintDemo : newProject,
  };
}
