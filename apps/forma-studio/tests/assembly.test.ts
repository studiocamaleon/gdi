import { expect, it } from "vitest";
import { assemblyDirection, frontDirection } from "../src/core/assembly";
import { chooseStyle, newProject } from "../src/core/project";

it.each([
  ["solid-back", 1, 1, -1],
  ["open-back", 1, 1, -1],
  ["double-support", 1, 1, -1],
  ["single-support", 1, 1, -1],
  ["back-fit", -1, 1, 1],
  ["acrylic-fit", -1, 1, 1],
  ["printed-fit", -1, 1, 1],
  ["halo", -1, 1, 1],
  ["double-led", 1, 1, -1],
  ["organic", 1, 1, -1],
] as const)(
  "%s conserva el cuerpo y extrae frente/fondo por su abertura",
  (style, front, face, back) => {
    const project = chooseStyle(newProject(), style);
    expect(frontDirection(project)).toBe(front);
    expect(assemblyDirection(project, "body")).toBe(0);
    expect(assemblyDirection(project, "face")).toBe(face);
    expect(assemblyDirection(project, "back")).toBe(back);
  },
);
it("la orgánica trasera retira acrílico y tapa por atrás", () => {
  const project = chooseStyle(newProject(), "organic");
  project.params.organicFit = "back";
  expect(frontDirection(project)).toBe(-1);
  expect(assemblyDirection(project, "face")).toBe(1);
  expect(assemblyDirection(project, "back")).toBe(1);
  project.params.organicSolid = true;
  expect(frontDirection(project)).toBe(1);
});
it("levanta la letra curva de su alojamiento sin desplazar la base", () => {
  const project = chooseStyle(newProject(), "curved");
  project.params.curveSeparate = true;
  expect(assemblyDirection(project, "body")).toBe(1);
  expect(assemblyDirection(project, "back")).toBe(0);
  project.params.curveSeparate = false;
  expect(assemblyDirection(project, "body")).toBe(0);
});
