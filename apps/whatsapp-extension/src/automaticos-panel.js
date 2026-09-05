const $ = (id) => document.getElementById(id);
const labels = {
  pendiente: "Pendiente",
  web_reservada: "Preparando",
  web_enviando: "Enviando",
  enviada: "Enviada",
  web_incierta: "Revisar en WhatsApp",
  descartada: "Descartada",
};
export function installAutomaticosPanel() {
  const root = $("auto-settings");
  if (!root) return;
  async function refresh() {
    const result = await chrome.runtime.sendMessage({
      type: "grafo:auto-estado",
    });
    if (result?.error) {
      $("auto-state").textContent = result.error;
      return;
    }
    $("auto-state").textContent =
      result?.status || "La extensión todavía no envía avisos automáticos.";
    const state = result?.state;
    const bound =
      state?.dispositivoId &&
      state.dispositivoId === result.config?.dispositivoId &&
      state.tenantId === result.config?.tenantId;
    $("auto-enable").textContent = bound
      ? "Reconectar este equipo"
      : "Activar en este equipo";
    $("auto-pause").hidden = state?.modo !== "WHATSAPP_WEB";
    $("auto-wati").hidden = state?.modo !== "WHATSAPP_WEB";
    $("auto-account").textContent = state?.numero
      ? `Número emisor: +${state.numero}${state.pausado ? " · Avisos pausados en Grafo" : ""}`
      : "";
    const list = $("auto-log");
    list.replaceChildren();
    for (const job of state?.ultimos || []) {
      const item = document.createElement("p");
      item.className = "fine";
      item.textContent = `${labels[job.estado] || job.estado} · +${job.telefono}${job.motivo ? ` · ${job.motivo}` : ""}`;
      list.append(item);
    }
  }
  root.addEventListener("toggle", () => {
    if (root.open)
      refresh().catch((error) => {
        $("auto-state").textContent = error.message;
      });
  });
  for (const [id, modo] of [
    ["auto-enable", "WHATSAPP_WEB"],
    ["auto-pause", "PAUSADO"],
    ["auto-wati", "WATI"],
  ]) {
    $(id).addEventListener("click", async () => {
      $(id).disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({
          type: "grafo:auto-configurar",
          modo,
        });
        if (result?.error) throw new Error(result.error);
        await refresh();
      } catch (error) {
        $("auto-state").textContent = error.message;
      } finally {
        $(id).disabled = false;
      }
    });
  }
  $("auto-test").addEventListener("click", async () => {
    $("auto-test").disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({
        type: "grafo:auto-prueba",
      });
      if (result?.error) throw new Error(result.error);
      await refresh();
    } catch (error) {
      $("auto-state").textContent = error.message;
    } finally {
      $("auto-test").disabled = false;
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.autoStatus) {
      $("auto-state").textContent = changes.autoStatus.newValue || "";
      if (root.open) refresh().catch(() => {});
    }
  });
}
