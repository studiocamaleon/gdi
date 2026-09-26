"use client";

import { ArrowUpRight } from "lucide-react";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import s from "./inbox-preview.module.css";

/** Ensaya la apertura desde Grafo sin modificar la navegación operativa. */
export function InboxLaunchPreview({ href }: { href: string }) {
  return (
    <DesignSystemProvider appearance="light" theme="brand">
      <main
        className={cn(brand.theme, brand.legacy, s.launcher)}
        data-appearance="light"
      >
        <div className={s.launchCard}>
          <GrafoprintBrand />
          <h1>Tu espacio de atención</h1>
          <p>
            Abrí el inbox en una pestaña nueva. Tené tus conversaciones a mano
            mientras seguís trabajando en Grafo.
          </p>
          <Button
            render={<a href={href} target="_blank" rel="noopener noreferrer" />}
          >
            Abrir inbox en otra pestaña
            <ArrowUpRight data-icon="inline-end" />
          </Button>
          <small>Acceso de demostración · usa datos ficticios</small>
        </div>
      </main>
    </DesignSystemProvider>
  );
}
