"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRightIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CircleDollarSignIcon,
  ChevronRightIcon,
  WarehouseIcon,
  BoxesIcon,
  FileTextIcon,
  FactoryIcon,
  FolderTreeIcon,
  IdCardIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  PrinterIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";

import { type CurrentUser } from "@/lib/auth";
import { NavLink } from "@/components/navigation/nav-link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const APP_VERSION = "v26.04";

const comercial = [
  {
    title: "Crear propuesta",
    href: "/comercial/crear-propuesta",
    icon: FileTextIcon,
  },
];

const registros = [
  {
    title: "Clientes",
    href: "/clientes",
    icon: UsersIcon,
  },
  {
    title: "Proveedores",
    href: "/proveedores",
    icon: Building2Icon,
  },
  {
    title: "Empleados",
    href: "/empleados",
    icon: IdCardIcon,
  },
];

const costos = [
  {
    title: "Centros de costo",
    href: "/costos/centros-de-costo",
    icon: FolderTreeIcon,
  },
  {
    title: "Maquinaria",
    href: "/costos/maquinaria",
    icon: PrinterIcon,
  },
  {
    title: "Rutas de produccion",
    href: "/costos/procesos",
    icon: WorkflowIcon,
  },
  {
    title: "Catalogo de productos",
    href: "/costos/productos",
    icon: BoxesIcon,
  },
];

const produccion = [
  {
    title: "Estaciones",
    href: "/produccion/estaciones",
    icon: ClipboardListIcon,
  },
];

const inventario = [
  {
    title: "Materias primas",
    href: "/inventario/materias-primas",
    icon: BoxesIcon,
  },
  {
    title: "Centro de stock",
    href: "/inventario/centro-stock",
    icon: WarehouseIcon,
  },
  {
    title: "Movimientos",
    href: "/inventario/movimientos",
    icon: ArrowLeftRightIcon,
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  currentUser: CurrentUser;
};

function GrafoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "relative inline-block size-6 shrink-0 rounded-[5px] bg-lime " +
        "after:absolute after:inset-[6px] after:rounded-full after:bg-lime-ink " +
        (className ?? "")
      }
    />
  );
}

function matchesRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatDiasSuscripcion(diasRestantes: number | null | undefined) {
  if (diasRestantes == null) {
    return "Sin vencimiento";
  }

  if (diasRestantes < 0) {
    return "Vencida";
  }

  if (diasRestantes === 0) {
    return "Vence hoy";
  }

  if (diasRestantes === 1) {
    return "1 dia restante";
  }

  return `${diasRestantes} dias restantes`;
}

const navButtonClasses =
  "font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:text-ink-0 data-[active=true]:[&_svg]:text-lime";

const subButtonClasses =
  "relative data-[active=true]:bg-transparent data-[active=true]:text-lime data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-3.5 data-[active=true]:before:w-[3px] data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-sm data-[active=true]:before:bg-lime";

export function AppSidebar({ currentUser, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/";
  const isComercialRoute = comercial.some((item) =>
    matchesRoute(pathname, item.href),
  );
  const isRegistrosRoute = registros.some((item) =>
    matchesRoute(pathname, item.href),
  );
  const isCostosRoute = costos.some((item) => matchesRoute(pathname, item.href));
  const isProduccionRoute = produccion.some((item) =>
    matchesRoute(pathname, item.href),
  );
  const isInventarioRoute = inventario.some((item) =>
    matchesRoute(pathname, item.href),
  );
  const [isComercialOpen, setIsComercialOpen] = React.useState(isComercialRoute);
  const [isRegistrosOpen, setIsRegistrosOpen] = React.useState(isRegistrosRoute);
  const [isCostosOpen, setIsCostosOpen] = React.useState(isCostosRoute);
  const [isProduccionOpen, setIsProduccionOpen] = React.useState(isProduccionRoute);
  const [isInventarioOpen, setIsInventarioOpen] = React.useState(isInventarioRoute);
  const planNombre = currentUser.tenantActual.suscripcion?.planNombre?.trim() || "Plan diamante";
  const diasRestantes = currentUser.tenantActual.suscripcion?.diasRestantes ?? 18;
  const suscripcionEstado = formatDiasSuscripcion(diasRestantes);
  const hasNumericDias = typeof diasRestantes === "number" && diasRestantes > 0;

  React.useEffect(() => {
    setIsComercialOpen(isComercialRoute);
  }, [isComercialRoute]);

  React.useEffect(() => {
    setIsRegistrosOpen(isRegistrosRoute);
  }, [isRegistrosRoute]);

  React.useEffect(() => {
    setIsCostosOpen(isCostosRoute);
  }, [isCostosRoute]);

  React.useEffect(() => {
    setIsProduccionOpen(isProduccionRoute);
  }, [isProduccionRoute]);

  React.useEffect(() => {
    setIsInventarioOpen(isInventarioRoute);
  }, [isInventarioRoute]);

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-0 border-b border-sidebar-border px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink href="/" />}
              tooltip="Grafo"
              className="h-auto gap-2.5 bg-transparent px-1 py-1 hover:bg-transparent"
            >
              <GrafoMark />
              <span className="font-sans text-base font-medium tracking-[-0.02em] text-ink-0 group-data-[collapsible=icon]:hidden">
                grafo
              </span>
              <span className="ml-auto rounded-sm border border-line-hi px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-ink-3 group-data-[collapsible=icon]:hidden">
                {APP_VERSION}
              </span>
              <span className="sr-only">Inicio</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            Operación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<NavLink href="/" />}
                  isActive={isDashboard}
                  tooltip="Panel general"
                  className={navButtonClasses}
                >
                  <LayoutDashboardIcon />
                  <span>Panel general</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <Collapsible
                  open={isComercialOpen}
                  onOpenChange={setIsComercialOpen}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip="Comercial"
                        className={navButtonClasses}
                        isActive={isComercialRoute}
                      />
                    }
                  >
                    <BriefcaseBusinessIcon />
                    <span>Comercial</span>
                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/menu-button:rotate-90" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1">
                    <SidebarMenuSub>
                      {comercial.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            render={<NavLink href={item.href} />}
                            isActive={matchesRoute(pathname, item.href)}
                            className={subButtonClasses}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <Collapsible
                  open={isRegistrosOpen}
                  onOpenChange={setIsRegistrosOpen}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip="Registros"
                        className={navButtonClasses}
                        isActive={isRegistrosRoute}
                      />
                    }
                  >
                    <UsersIcon />
                    <span>Registros</span>
                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/menu-button:rotate-90" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1">
                    <SidebarMenuSub>
                      {registros.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            render={<NavLink href={item.href} />}
                            isActive={matchesRoute(pathname, item.href)}
                            className={subButtonClasses}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            Costos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Collapsible
                  open={isCostosOpen}
                  onOpenChange={setIsCostosOpen}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip="Costos"
                        className={navButtonClasses}
                        isActive={isCostosRoute}
                      />
                    }
                  >
                    <CircleDollarSignIcon />
                    <span>Costos</span>
                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/menu-button:rotate-90" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1">
                    <SidebarMenuSub>
                      {costos.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            render={<NavLink href={item.href} />}
                            isActive={matchesRoute(pathname, item.href)}
                            className={subButtonClasses}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            Producción
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Collapsible
                  open={isProduccionOpen}
                  onOpenChange={setIsProduccionOpen}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip="Producción"
                        className={navButtonClasses}
                        isActive={isProduccionRoute}
                      />
                    }
                  >
                    <FactoryIcon />
                    <span>Producción</span>
                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/menu-button:rotate-90" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1">
                    <SidebarMenuSub>
                      {produccion.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            render={<NavLink href={item.href} />}
                            isActive={matchesRoute(pathname, item.href)}
                            className={subButtonClasses}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            Datos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Collapsible
                  open={isInventarioOpen}
                  onOpenChange={setIsInventarioOpen}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip="Inventario"
                        className={navButtonClasses}
                        isActive={isInventarioRoute}
                      />
                    }
                  >
                    <BoxesIcon />
                    <span>Inventario</span>
                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/menu-button:rotate-90" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1">
                    <SidebarMenuSub>
                      {inventario.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            render={<NavLink href={item.href} />}
                            isActive={matchesRoute(pathname, item.href)}
                            className={subButtonClasses}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2.5">
        <button
          type="button"
          onClick={() =>
            toast.info("Administración de suscripción disponible próximamente.")
          }
          className="group relative w-full overflow-hidden rounded-md border border-sidebar-border bg-bg-2 p-3.5 text-left transition hover:border-line-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 group-data-[collapsible=icon]:hidden"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(232,255,92,0.08),transparent_60%)]"
          />
          <div className="relative">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
              Plan actual
            </p>
            <p className="mt-0.5 font-serif text-lg italic leading-tight tracking-[-0.01em] text-ink-0">
              {planNombre}
            </p>
            <p className="mt-1.5 font-mono text-[10px] text-ink-2">
              {hasNumericDias ? (
                <>
                  <span className="font-medium text-lime">
                    {diasRestantes} {diasRestantes === 1 ? "día" : "días"}
                  </span>{" "}
                  restantes
                </>
              ) : (
                suscripcionEstado
              )}
            </p>
          </div>
          <div className="relative mt-2.5 border-t border-sidebar-border pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors group-hover:text-ink-1">
            Administrar suscripción →
          </div>
        </button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
