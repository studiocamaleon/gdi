"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import s from "./inbox-recuperacion.module.css";

function escucharConexion(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}
const leerSinInternet = () => navigator.onLine === false;
const leerConexionServidor = () => false;

export function AvisoRecuperacionInbox({
  sinInternet = false,
  conservaBorradores = false,
}: {
  sinInternet?: boolean;
  conservaBorradores?: boolean;
}) {
  return (
    <Empty role="status" aria-live="polite">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {sinInternet ? <WifiOff /> : <Spinner />}
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2}>
          {sinInternet ? "Esperando conexión" : "Estamos reconectando tu Inbox"}
        </EmptyTitle>
        <EmptyDescription>
          {sinInternet
            ? "Revisá tu conexión a Internet. Seguiremos automáticamente cuando vuelva."
            : "Grafo no está disponible por un momento. Las conversaciones volverán automáticamente; no hace falta recargar."}
          {conservaBorradores &&
            " Conservamos tus borradores en esta pestaña. Ningún mensaje se enviará automáticamente."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Sin datos privados hasta volver a verificar la sesión en el servidor.
 * refresh recupera la ruta, no ejecuta acciones ni limpia la cookie. */
export function InboxRecuperacion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const enCurso = useRef(false);
  const sinInternet = useSyncExternalStore(
    escucharConexion,
    leerSinInternet,
    leerConexionServidor,
  );
  useEffect(() => {
    enCurso.current = pendiente;
  }, [pendiente]);
  useEffect(() => {
    const reintentar = () => {
      const offline = navigator.onLine === false;
      if (offline || document.visibilityState === "hidden" || enCurso.current)
        return;
      enCurso.current = true;
      iniciar(() => router.refresh());
    };
    const timer = setInterval(reintentar, 5000);
    window.addEventListener("online", reintentar);
    document.addEventListener("visibilitychange", reintentar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", reintentar);
      document.removeEventListener("visibilitychange", reintentar);
    };
  }, [router]);
  return (
    <DesignSystemProvider theme="brand">
      <main className={cn(brand.theme, brand.legacy, s.page)}>
        <div className={s.panel}>
          <header className={s.brand}>
            <GrafoprintBrand />
            <span>INBOX</span>
          </header>
          <AvisoRecuperacionInbox sinInternet={sinInternet} />
        </div>
      </main>
    </DesignSystemProvider>
  );
}
