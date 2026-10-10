import { notFound } from "next/navigation";
import { FiscalArcaView } from "@/components/plataforma/fiscal-arca-view";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "@/components/plataforma/plataforma.module.css";

export default function ArcaDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <DesignSystemProvider theme="brand">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brand.theme} ${styles.theme} min-h-screen bg-background text-foreground`}
      >
        <header className="flex flex-col gap-2 border-b p-8">
          <p className="text-sm text-muted-foreground">
            PLATAFORMA · VISTA PREVIA SIN ENVÍOS
          </p>
          <h1 className="text-3xl font-semibold">Facturación ARCA.</h1>
          <p className="text-muted-foreground">
            Certificado y acceso fiscal de la plataforma.
          </p>
        </header>
        <FiscalArcaView
          esAdmin
          vistaPrevia={{
            ambiente: "prod",
            proveedorConfigurado: true,
            cifradoDisponible: true,
            vigente: false,
            certificado: null,
          }}
        />
      </main>
    </DesignSystemProvider>
  );
}
