"use client";
import { MapPin, ContactRound, Phone, Mail, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type {
  UbicacionInbox,
  ContactoCompartidoInbox,
  CitaInbox,
} from "../../../apps/api/src/common/inbox/contenidos";
import s from "./inbox-contenido.module.css";
export function InboxCita({ cita }: { cita: CitaInbox }) {
  return (
    <div className={s.quote}>
      <strong>{cita.nombre}</strong>
      <span>{cita.texto}</span>
    </div>
  );
}
export function InboxUbicacion({
  ubicacion: l,
}: {
  ubicacion: UbicacionInbox;
}) {
  const destino = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.latitud},${l.longitud}`)}`;
  return (
    <div className={s.location}>
      <MapPin size={22} />
      <strong>{l.nombre || "Ubicación compartida"}</strong>
      {l.direccion && <span>{l.direccion}</span>}
      <span>
        {l.latitud.toFixed(6)}, {l.longitud.toFixed(6)}
      </span>
      <a
        href={destino}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Abrir en el mapa
      </a>
    </div>
  );
}
const escapar = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
function descargar(c: ContactoCompartidoInbox) {
  const datos = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapar(c.nombre)}`,
    `N:;${escapar(c.nombre)};;;`,
    ...(c.organizacion ? [`ORG:${escapar(c.organizacion)}`] : []),
    ...c.telefonos.map((t) => `TEL:${escapar(t)}`),
    ...c.correos.map((e) => `EMAIL:${escapar(e)}`),
    ...c.direcciones.map((d) => `ADR:;;${escapar(d)};;;;`),
    "END:VCARD",
  ].join("\r\n");
  const url = URL.createObjectURL(
      new Blob([datos], { type: "text/vcard;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "contacto.vcf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function InboxContactos({
  contactos,
}: {
  contactos: ContactoCompartidoInbox[];
}) {
  return (
    <div className={s.contacts}>
      {contactos.map((c, i) => (
        <div className={s.contact} key={i}>
          <ContactRound size={23} />
          <div>
            <strong>{c.nombre}</strong>
            {c.organizacion && <span>{c.organizacion}</span>}
            {c.telefonos.map((t, j) => (
              <span key={`tel-${j}`}>
                <Phone size={12} />
                {t}
              </span>
            ))}
            {c.correos.map((e, j) => (
              <span key={`mail-${j}`}>
                <Mail size={12} />
                {e}
              </span>
            ))}
            {c.direcciones.map((d, j) => (
              <span key={`dir-${j}`}>{d}</span>
            ))}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Guardar contacto ${c.nombre}`}
            title="Guardar contacto"
            onClick={() => descargar(c)}
          >
            <Download />
          </Button>
        </div>
      ))}
    </div>
  );
}
