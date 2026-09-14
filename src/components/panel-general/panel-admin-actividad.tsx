"use client";
import Link from "next/link";
import type { PanelActividad } from "@/lib/panel-general-api";
import s from "./panel-admin-view.module.css";

export function tiempoActividad(fecha: string, ahora: number) {
  const minutos = Math.max(0, Math.floor((ahora - Date.parse(fecha)) / 60_000));
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

export function ActividadLista({
  items,
  ahora,
  onAbrir,
}: {
  items: PanelActividad["items"];
  ahora: number;
  onAbrir?: () => void;
}) {
  return (
    <ol className={s.timeline}>
      {items.map((item) => (
        <li key={item.id}>
          <span className={s.dot} aria-hidden />
          <div className="min-w-0 flex-1">
            {item.href ? (
              <Link href={item.href} onClick={onAbrir}>
                {item.titulo}
              </Link>
            ) : (
              <strong>{item.titulo}</strong>
            )}
            <p>{item.detalle}</p>
            {item.actor && <small>{item.actor}</small>}
          </div>
          <time
            dateTime={item.fecha}
            title={new Date(item.fecha).toLocaleString("es-AR")}
          >
            {tiempoActividad(item.fecha, ahora)}
          </time>
        </li>
      ))}
    </ol>
  );
}
