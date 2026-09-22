import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { ApiError } from "@/lib/api";
import { getInvitationState } from "@/lib/auth";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "@/components/plataforma/seguridad-backoffice.module.css";

export const metadata: Metadata = {
  title: "Tu invitación · Grafo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type AceptarInvitacionPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AceptarInvitacionPage({
  searchParams,
}: AceptarInvitacionPageProps) {
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  let invitation;
  let errorInvitacion = "";

  try {
    invitation = await getInvitationState(token);
  } catch (error) {
    if (error instanceof ApiError && [400, 404].includes(error.status)) {
      errorInvitacion =
        "El enlace venció, ya fue utilizado o fue reemplazado. Pedile al equipo de Grafo una nueva invitación.";
    } else {
      throw error;
    }
  }

  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main className={`${theme.theme} ${styles.page}`} data-ui="heroui">
        <section className={styles.card}>
          <GrafoprintBrand />
          {invitation ? (
            <AcceptInvitationForm invitation={invitation} token={token} />
          ) : (
            <div className={styles.intro}>
              <h1>
                Revisá tu invitación<span>.</span>
              </h1>
              <p role="alert">{errorInvitacion}</p>
              <Link href="/login">Ir a iniciar sesión</Link>
            </div>
          )}
        </section>
      </main>
    </DesignSystemProvider>
  );
}
