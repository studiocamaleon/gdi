import { deliveryDate, statuses } from "./model.js";

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
export function link(origin, path, text, className = "link-button") {
  const node = element("a", text, className);
  node.href = `${origin}${path}`;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}
export function renderResults(root, data, origin, { selectClient, refresh }) {
  root.replaceChildren();
  if (data.estado === "seleccionar_cliente") {
    root.append(
      element(
        "p",
        "Este teléfono pertenece a varias fichas. Elegí el cliente para ver sus órdenes.",
        "notice",
      ),
    );
    for (const client of data.coincidencias) {
      const button = element(
        "button",
        `${client.nombre}${client.razonSocial ? ` · ${client.razonSocial}` : ""}${client.activo ? "" : " · Inactivo"}`,
        "choice",
      );
      button.addEventListener("click", () => selectClient(client.id));
      root.append(button);
    }
    return;
  }
  if (!data.cliente) {
    root.append(
      element(
        "div",
        "No encontramos este teléfono en los clientes ni en sus contactos de Grafo.",
        "card muted",
      ),
    );
    root.append(link(origin, "/clientes", "Ver clientes en Grafo ↗"));
    return;
  }
  const client = data.cliente;
  const card = element("section", undefined, "card contact");
  const heading = element("div", undefined, "contact-heading");
  heading.append(
    element(
      "div",
      client.nombre
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
      "avatar",
    ),
  );
  const title = element("div", undefined, "contact-title");
  title.append(
    element("div", "CLIENTE EN GRAFO", "eyebrow"),
    element("h1", client.nombre),
  );
  if (client.razonSocial && client.razonSocial !== client.nombre)
    title.append(element("p", client.razonSocial, "muted fine"));
  heading.append(title);
  card.append(heading);
  if (!client.activo) card.append(element("span", "Cliente inactivo", "badge"));
  if (client.contactos.length)
    card.append(
      element("p", `Contacto: ${client.contactos.join(", ")}`, "muted"),
    );
  card.append(
    element("p", data.telefono, "phone"),
    link(
      origin,
      `/clientes/${encodeURIComponent(client.id)}`,
      "Abrir ficha en Grafo ↗",
    ),
  );
  root.append(card);
  const ordersHeading = element("div", undefined, "section-heading");
  ordersHeading.append(element("h2", "Últimas órdenes"));
  const refreshButton = element("button", "Actualizar", "text-button");
  refreshButton.addEventListener("click", refresh);
  ordersHeading.append(refreshButton);
  root.append(ordersHeading);
  if (!data.permisos.ordenes) {
    root.append(
      element(
        "p",
        "Tu usuario no tiene permiso para consultar órdenes.",
        "muted",
      ),
    );
    return;
  }
  if (!data.ordenes.length)
    root.append(
      element("p", "Este cliente todavía no tiene órdenes.", "muted"),
    );
  for (const order of data.ordenes) {
    const orderCard = element("article", undefined, "card order");
    const top = element("div", undefined, "order-top");
    top.append(
      link(
        origin,
        `/produccion/ordenes/${encodeURIComponent(order.id)}`,
        `${order.numero} ↗`,
        "order-number",
      ),
    );
    top.append(
      element(
        "span",
        statuses[order.estado] || order.estado,
        `badge badge-${Object.hasOwn(statuses, order.estado) ? order.estado : "otro"}`,
      ),
    );
    const items = element("div", undefined, "order-items");
    for (const item of order.items)
      items.append(
        element(
          "p",
          `${new Intl.NumberFormat("es-AR").format(item.cantidad)} ${item.cantidadUnidad || "u."} · ${item.nombre}`,
        ),
      );
    if (!order.items.length)
      items.append(element("p", "Orden sin ítems", "muted"));
    const date = element("div", undefined, "delivery");
    date.append(
      element("span", "Entrega"),
      element("strong", deliveryDate(order.fechaEntrega)),
    );
    orderCard.append(top, items, date);
    root.append(orderCard);
  }
}
