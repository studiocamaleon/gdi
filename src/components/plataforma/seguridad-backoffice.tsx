"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { PerfilMfa } from "@/components/perfil-mfa";
import { ActionButton } from "@/components/design-system/action-button";
import { getContextoPlataforma } from "@/lib/plataforma-api";
import { logout } from "@/lib/auth";
import { clearSessionToken } from "@/lib/session";
import styles from "./seguridad-backoffice.module.css";
import theme from "@/components/design-system/brand-workspace-theme.module.css";

export function SeguridadBackoffice({ email }: { email: string }) {
  const router = useRouter();
  const [bloqueado, setBloqueado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main className={`${theme.theme} ${styles.page}`} data-ui="heroui">
        <section className={styles.card}>
          <GrafoprintBrand />
          <div className={styles.intro}>
            <span>ACCESO DEL EQUIPO</span>
            <h1>
              Protegé tu acceso<span>.</span>
            </h1>
            <p>{email}</p>
            <p>
              Antes de administrar Grafo, activá el segundo factor y guardá tus
              códigos de recuperación. Tu sesión permite completar estos pasos.
            </p>
          </div>
          <PerfilMfa onBloqueoChange={setBloqueado} />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <ActionButton
              isDisabled={bloqueado || busy}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await getContextoPlataforma();
                  if (r.requiereSeguridad)
                    setError(
                      "Completá MFA y confirmá que guardaste los códigos. Si ya lo hiciste en otra sesión, volvé a ingresar con tu autenticador.",
                    );
                  else {
                    router.replace("/plataforma?vista=equipo");
                    router.refresh();
                  }
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo verificar tu seguridad.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Verificando…" : "Continuar a Plataforma"}
            </ActionButton>
            <ActionButton
              variant="outline"
              isDisabled={bloqueado || busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await logout();
                } finally {
                  await clearSessionToken();
                  router.replace("/backoffice");
                  router.refresh();
                }
              }}
            >
              Cerrar sesión
            </ActionButton>
          </div>
          {!bloqueado && (
            <p className={styles.note}>
              ¿Ya tenés MFA?{" "}
              <Link href="/backoffice">
                Ingresá nuevamente con tu autenticador.
              </Link>
            </p>
          )}
        </section>
      </main>
    </DesignSystemProvider>
  );
}
