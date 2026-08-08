"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  CheckIcon,
  ArrowLeftRightIcon,
  KeyRoundIcon,
} from "lucide-react";

import { switchTenant, type CurrentUser } from "@/lib/auth";
import { setSessionToken } from "@/lib/session";

import s from "./perfil-usuario-modal.module.css";

interface Props {
  currentUser: CurrentUser;
  onClose: () => void;
}

function nombreDe(currentUser: CurrentUser): string {
  return currentUser.nombreCompleto?.trim() || currentUser.email;
}

function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function rolLabel(rol: string): string {
  return rol.charAt(0).toUpperCase() + rol.slice(1);
}

/**
 * Modal de perfil de usuario: la identidad y sus acciones viven acá (se abre
 * desde el avatar del sidebar). Reemplaza al menú del header. v1 trae cambiar
 * empresa de trabajo y cambiar clave; es el lugar donde va a ir creciendo la
 * configuración del perfil.
 */
export function PerfilUsuarioModal({ currentUser, onClose }: Props) {
  const router = useRouter();
  const [cambiando, startCambio] = React.useTransition();
  const nombre = nombreDe(currentUser);
  const puedeCambiarEmpresa = currentUser.tenants.length > 1;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cambiarEmpresa = (tenantId: string) => {
    if (tenantId === currentUser.tenantActual.id) return;
    startCambio(async () => {
      const res = await switchTenant(tenantId);
      if (res.accessToken) await setSessionToken(res.accessToken);
      router.refresh();
      onClose();
    });
  };

  return createPortal(
    <div className={s.overlay} onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Perfil de usuario"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className={s.head}>
          <span className={s.av}>{inicialesDe(nombre)}</span>
          <div className={s.ident}>
            <div className={s.nm}>{nombre}</div>
            <div className={s.mail}>{currentUser.email}</div>
          </div>
        </div>

        <div className={s.body}>
          <section className={s.sec}>
            <div className={s.secTitle}>
              {puedeCambiarEmpresa ? "Empresa de trabajo" : "Empresa"}
            </div>
            <div className={s.tenants}>
              {currentUser.tenants.map((tenant) => {
                const activo = tenant.id === currentUser.tenantActual.id;
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    className={`${s.tenant} ${activo ? s.tenantOn : ""}`}
                    disabled={cambiando || activo}
                    onClick={() => cambiarEmpresa(tenant.id)}
                  >
                    <Building2Icon className={s.tenantIco} />
                    <span className={s.tenantNm}>{tenant.nombre}</span>
                    <span className={s.tenantRol}>{rolLabel(tenant.rol)}</span>
                    {activo ? (
                      <CheckIcon className={s.tenantCheck} />
                    ) : puedeCambiarEmpresa ? (
                      <ArrowLeftRightIcon className={s.tenantSwap} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={s.sec}>
            <div className={s.secTitle}>Seguridad</div>
            <button
              type="button"
              className={s.action}
              onClick={() => {
                onClose();
                router.push("/cambiar-clave");
              }}
            >
              <KeyRoundIcon className={s.actionIco} />
              <span>Cambiar mi clave</span>
            </button>
          </section>

          <p className={s.soon}>Más opciones de perfil, en camino.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
