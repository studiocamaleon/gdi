"use client";
import { useState } from "react";
import s from "./perfil-usuario-modal.module.css";

export function UsuarioAvatar({
  nombre,
  version,
  preview,
  grande = false,
}: {
  nombre: string;
  version?: string | null;
  preview?: string | null;
  grande?: boolean;
}) {
  const [fallida, setFallida] = useState<string | null>(null);
  const src =
    preview ??
    (version
      ? `/api/backend/auth/perfil/foto?v=${encodeURIComponent(version)}`
      : null);
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const iniciales =
    partes.length > 1
      ? partes[0][0] + partes[partes.length - 1][0]
      : (partes[0]?.slice(0, 2) ?? "U");
  return (
    <span className={`${s.avatar} ${grande ? s.avatarGrande : ""}`}>
      {src && fallida !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Imagen privada, servida por el BFF autenticado.
        <img
          src={src}
          alt={`Foto de ${nombre}`}
          onError={() => setFallida(src)}
        />
      ) : (
        <span aria-hidden="true">{iniciales.toUpperCase()}</span>
      )}
    </span>
  );
}
