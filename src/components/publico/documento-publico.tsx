"use client";

import * as React from "react";
import { Card, Chip } from "@heroui/react";
import { Link2OffIcon, LockKeyholeIcon, type LucideIcon } from "lucide-react";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import { cn } from "@/lib/utils";
import s from "./documento-publico.module.css";

export function DocumentoPublico({
  negocio,
  descripcion,
  logo,
  children,
}: {
  negocio?: string;
  descripcion: string;
  logo?: string;
  children: React.ReactNode;
}) {
  const [logoFallido, setLogoFallido] = React.useState(false);
  const iniciales = negocio
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <div
        data-ui="heroui"
        data-appearance="light"
        className={cn(theme.theme, theme.legacy, s.page)}
      >
        <div className={s.container}>
          <header className={s.header}>
            <div className={s.business}>
              {negocio ? (
                <>
                  <span className={s.businessMark}>
                    {logo && !logoFallido ? (
                      // Endpoint público con la misma autorización del documento.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt=""
                        onError={() => setLogoFallido(true)}
                      />
                    ) : (
                      iniciales
                    )}
                  </span>
                  <div>
                    <strong>{negocio}</strong>
                    <span>{descripcion}</span>
                  </div>
                </>
              ) : (
                <GrafoprintBrand />
              )}
            </div>
            {negocio ? (
              <div className={s.powered}>
                <span>Con tecnología</span>
                <GrafoprintBrand />
              </div>
            ) : null}
          </header>
          <main className={s.main}>{children}</main>
          <footer className={s.footer}>
            <LockKeyholeIcon aria-hidden />
            <p>
              Este enlace es privado. Compartilo sólo con quien necesite ver{" "}
              {descripcion === "Seguimiento de tu pedido"
                ? "el pedido"
                : "el presupuesto"}
              .
            </p>
          </footer>
        </div>
      </div>
    </DesignSystemProvider>
  );
}

export function SeccionPublica({
  titulo,
  detalle,
  icon: Icon,
  children,
  className,
}: {
  titulo: string;
  detalle?: React.ReactNode;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(s.panel, className)}>
      <Card.Header className={s.panelHeader}>
        <span className={s.sectionIcon}>
          <Icon aria-hidden />
        </span>
        <Card.Title className={s.panelTitle} aria-level={2}>
          {titulo}
        </Card.Title>
        {detalle ? <span className={s.sectionDetail}>{detalle}</span> : null}
      </Card.Header>
      <Card.Content className={s.panelBody}>{children}</Card.Content>
    </Card>
  );
}

export function EstadoPublico({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <Chip variant="soft" color={tone} size="sm" className={s.status}>
      {children}
    </Chip>
  );
}

export function DocumentoNoEncontrado({
  tipo,
}: {
  tipo: "pedido" | "presupuesto";
}) {
  return (
    <DocumentoPublico
      descripcion={
        tipo === "pedido" ? "Seguimiento de tu pedido" : "Presupuesto para vos"
      }
    >
      <Empty className={s.empty}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Link2OffIcon />
          </EmptyMedia>
          <EmptyTitle>
            No encontramos{" "}
            {tipo === "pedido" ? "este pedido" : "este presupuesto"}
          </EmptyTitle>
          <EmptyDescription>
            El enlace puede ser incorrecto o ya no estar disponible. Revisalo o
            pedile uno nuevo a tu imprenta.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </DocumentoPublico>
  );
}
