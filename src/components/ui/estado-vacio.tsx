"use client";

/**
 * <EstadoVacio /> — wrapper opinado sobre <Empty> para reemplazar
 * los "Sin X" texto plano que aparecen en tablas, cards y listas.
 *
 * Estructura:
 *   - Icono (con fondo redondeado) opcional
 *   - Título (1 línea, qué falta)
 *   - Descripción (1-2 líneas, por qué falta y qué hacer)
 *   - CTA primario opcional (botón con onClick o link)
 *   - Acciones secundarias opcionales (links o botones outline)
 *
 * Variantes:
 *   - `compacto`: para vacíos dentro de cards (sin border-dashed grande).
 *   - default: para vacíos full-page.
 *
 * Uso:
 *   <EstadoVacio
 *     icon={<PackageIcon />}
 *     titulo="Sin productos cargados"
 *     descripcion="Empezá creando un producto o ejecutá el seed."
 *     cta={{ label: "Nuevo producto", href: "/productos-servicios/nuevo" }}
 *   />
 */

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export interface EstadoVacioCTA {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

interface EstadoVacioProps {
  icon?: React.ReactNode;
  titulo: string;
  descripcion?: React.ReactNode;
  cta?: EstadoVacioCTA;
  acciones?: EstadoVacioCTA[];
  /** `compacto` reduce padding y oculta el media wrapper grande. */
  variant?: "default" | "compacto";
  className?: string;
}

export function EstadoVacio({
  icon,
  titulo,
  descripcion,
  cta,
  acciones,
  variant = "default",
  className,
}: EstadoVacioProps) {
  const padding = variant === "compacto" ? "p-4" : "p-8";
  return (
    <Empty className={cn("border", padding, className)}>
      <EmptyHeader>
        {icon && (
          <EmptyMedia variant={variant === "compacto" ? "icon" : "default"}>
            {variant === "compacto" ? (
              icon
            ) : (
              <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-6">
                {icon}
              </div>
            )}
          </EmptyMedia>
        )}
        <EmptyTitle className={variant === "compacto" ? "text-sm" : "text-base"}>
          {titulo}
        </EmptyTitle>
        {descripcion && (
          <EmptyDescription
            className={variant === "compacto" ? "text-xs" : "text-sm"}
          >
            {descripcion}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {(cta || (acciones && acciones.length > 0)) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {cta && <CTAButton cta={cta} primary />}
            {acciones?.map((a, i) => (
              <CTAButton key={i} cta={a} />
            ))}
          </div>
        </EmptyContent>
      )}
    </Empty>
  );
}

function CTAButton({ cta, primary }: { cta: EstadoVacioCTA; primary?: boolean }) {
  const Icon = cta.icon;
  const inner = (
    <>
      {Icon && <Icon className="mr-2 size-4" />}
      {cta.label}
    </>
  );
  if (cta.href) {
    return (
      <Link href={cta.href}>
        <Button variant={primary ? "default" : "outline"} size="sm">
          {inner}
        </Button>
      </Link>
    );
  }
  return (
    <Button variant={primary ? "default" : "outline"} size="sm" onClick={cta.onClick}>
      {inner}
    </Button>
  );
}
