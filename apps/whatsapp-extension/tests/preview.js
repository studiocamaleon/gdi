import { renderResults } from "../src/render.js";
const data = {
  estado: "encontrado",
  telefono: "+54 9 2966 123456",
  cliente: {
    id: "demo",
    nombre: "Estudio Norte",
    razonSocial: "Diseño & Arquitectura",
    activo: true,
    contactos: ["María Torres"],
  },
  permisos: { clientes: true, ordenes: true },
  ordenes: [
    {
      id: "demo-1",
      numero: "OT-2026-0045",
      estado: "produccion",
      fechaEntrega: "2026-09-08",
      items: [
        {
          nombre: "Cartel corpóreo en Polyfan",
          cantidad: 2,
          cantidadUnidad: "u.",
        },
      ],
    },
    {
      id: "demo-2",
      numero: "OT-2026-0041",
      estado: "pendiente",
      fechaEntrega: "2026-09-11",
      items: [
        { nombre: "Vinilos para vidriera", cantidad: 4, cantidadUnidad: "u." },
      ],
    },
    {
      id: "demo-3",
      numero: "OT-2026-0032",
      estado: "entregada",
      fechaEntrega: "2026-08-28",
      items: [
        { nombre: "Tarjetas personales", cantidad: 500, cantidadUnidad: "u." },
      ],
    },
  ],
};
renderResults(
  document.getElementById("results"),
  data,
  "https://example.invalid",
  { selectClient() {}, refresh() {} },
);
document.addEventListener("click", (event) => {
  if (event.target.closest("a")) event.preventDefault();
});
