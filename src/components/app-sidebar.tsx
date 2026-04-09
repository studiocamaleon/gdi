"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRightIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  ChevronRightIcon,
  WarehouseIcon,
  BoxesIcon,
  FileTextIcon,
  FactoryIcon,
  GemIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

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
    href: "/inventario/movimientos-kardex",
    icon: ArrowLeftRightIcon,
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  currentUser: CurrentUser;
};

function SidebarBrandLogo({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      width="677"
      height="369"
      viewBox="0 0 677 369"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gdi-cyan-inline" x1="124" y1="57" x2="192" y2="153" gradientUnits="userSpaceOnUse">
          <stop stopColor="#28B8F2" />
          <stop offset="1" stopColor="#1295D0" />
        </linearGradient>
        <linearGradient id="gdi-magenta-inline" x1="218" y1="56" x2="290" y2="151" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF0D96" />
          <stop offset="1" stopColor="#DD007D" />
        </linearGradient>
        <linearGradient id="gdi-yellow-inline" x1="123" y1="151" x2="189" y2="252" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF100" />
          <stop offset="1" stopColor="#F5DD00" />
        </linearGradient>
        <linearGradient id="gdi-black-inline" x1="219" y1="153" x2="286" y2="247" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D1D1B" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <filter id="soft-shadow-inline" x="92" y="28" width="232" height="254" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#soft-shadow-inline)">
        <g className="cmyk-bubbles">
          <circle className="cmyk-bubble" cx="152.5" cy="96.5" r="49.5" fill="url(#gdi-cyan-inline)" />
          <circle className="cmyk-bubble" cx="247.5" cy="96.5" r="49.5" fill="url(#gdi-magenta-inline)" />
          <circle className="cmyk-bubble" cx="152.5" cy="191.5" r="49.5" fill="url(#gdi-yellow-inline)" />
          <circle className="cmyk-bubble" cx="247.5" cy="191.5" r="49.5" fill="url(#gdi-black-inline)" />
        </g>

        <g className="core-bubbles">
          <circle className="core-bubble" cx="200" cy="96.5" r="16" fill="#5F5F78" fillOpacity="0.26" />
          <circle className="core-bubble" cx="200" cy="191.5" r="16" fill="#5F5F78" fillOpacity="0.26" />
          <circle className="core-bubble" cx="152.5" cy="144" r="16" fill="#5F5F78" fillOpacity="0.18" />
          <circle className="core-bubble" cx="247.5" cy="144" r="16" fill="#5F5F78" fillOpacity="0.18" />
          <circle className="core-bubble" cx="200" cy="144" r="20" fill="#4A4A57" fillOpacity="0.18" />
        </g>
      </g>

      <g fill="#FAFAF8">
        <text
          x="332"
          y="161"
          fontFamily="Montserrat, Avenir Next, Poppins, Arial, sans-serif"
          fontSize="126"
          fontWeight="700"
          letterSpacing="0.5"
        >
          GDI
        </text>
        <text
          x="334"
          y="206"
          fontFamily="Montserrat, Avenir Next, Poppins, Arial, sans-serif"
          fontSize="40"
          fontWeight="500"
          letterSpacing="-0.2"
        >
          grafica digital
        </text>
        <text
          x="334"
          y="244"
          fontFamily="Montserrat, Avenir Next, Poppins, Arial, sans-serif"
          fontSize="40"
          fontWeight="500"
          letterSpacing="-0.2"
        >
          inteligente
        </text>
      </g>
    </svg>
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

function getSuscripcionTone(diasRestantes: number | null | undefined) {
  if (diasRestantes == null) {
    return "outline";
  }

  if (diasRestantes <= 0) {
    return "destructive";
  }

  if (diasRestantes <= 7) {
    return "secondary";
  }

  return "outline";
}

function getSuscripcionProgress(diasRestantes: number | null | undefined) {
  if (diasRestantes == null) {
    return 100;
  }

  if (diasRestantes <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(8, Math.round((diasRestantes / 30) * 100)));
}

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
  const suscripcionProgress = getSuscripcionProgress(diasRestantes);

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
      <SidebarHeader className="gap-1 border-b border-sidebar-border/70 px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink href="/" />}
              size="lg"
              tooltip="GDI ERP"
              className="logo-hover-target h-auto min-h-32 justify-center bg-transparent px-1 py-0.5 hover:bg-transparent"
            >
              <SidebarBrandLogo
                className="sidebar-logo !block !h-34 !w-full max-w-[460px] object-contain object-center transition-transform duration-300 ease-out group-data-[collapsible=icon]:!h-16 group-data-[collapsible=icon]:!w-auto"
              />
              <span className="sr-only">Inicio</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <style jsx global>{`
          .sidebar-logo .cmyk-bubble {
            transform-box: fill-box;
            transform-origin: center;
          }
          .sidebar-logo .core-bubbles {
            transform-origin: 200px 144px;
          }
          .sidebar-logo .core-bubble {
            transform-box: fill-box;
            transform-origin: center;
          }
          .logo-hover-target:hover .sidebar-logo {
            transform: translateY(-2px) scale(1.03);
          }
          .logo-hover-target:hover .sidebar-logo .cmyk-bubble {
            animation-name: sidebar-cmyk-pulse;
            animation-duration: 1.8s;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }
          .logo-hover-target:hover .sidebar-logo .cmyk-bubble:nth-child(1) {
            animation-delay: 0s;
          }
          .logo-hover-target:hover .sidebar-logo .cmyk-bubble:nth-child(2) {
            animation-delay: 0.2s;
          }
          .logo-hover-target:hover .sidebar-logo .cmyk-bubble:nth-child(3) {
            animation-delay: 0.35s;
          }
          .logo-hover-target:hover .sidebar-logo .cmyk-bubble:nth-child(4) {
            animation-delay: 0.5s;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubbles {
            animation-name: sidebar-core-orbit-hover;
            animation-duration: 1.4s;
            animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
            animation-iteration-count: infinite;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubble {
            animation-name: sidebar-core-pulse;
            animation-duration: 1.1s;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubble:nth-child(1) {
            animation-delay: 0s;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubble:nth-child(2) {
            animation-delay: 0.2s;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubble:nth-child(3) {
            animation-delay: 0.35s;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubble:nth-child(4) {
            animation-delay: 0.5s;
          }
          .logo-hover-target:hover .sidebar-logo .core-bubble:nth-child(5) {
            animation-delay: 0.7s;
          }
          @keyframes sidebar-core-orbit-hover {
            0% {
              transform: rotate(0deg);
            }
            40% {
              transform: rotate(16deg);
            }
            100% {
              transform: rotate(0deg);
            }
          }
          @keyframes sidebar-core-pulse {
            0%,
            100% {
              opacity: 0.88;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.08);
            }
          }
          @keyframes sidebar-cmyk-pulse {
            0%,
            100% {
              transform: scale(1) translateY(0px);
              filter: saturate(1);
            }
            50% {
              transform: scale(1.1) translateY(-3px);
              filter: saturate(1.2);
            }
          }
        `}</style>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-2 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink href="/" />}
              isActive={isDashboard}
              tooltip="Panel general"
              className="font-medium"
            >
              <LayoutDashboardIcon />
              <span>Panel general</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="mx-2 my-2 w-auto" />

        <SidebarMenu>
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
                    className="font-medium"
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

        <SidebarMenu>
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
                    className="font-medium"
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
                    className="font-medium"
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
                    tooltip="Produccion"
                    className="font-medium"
                    isActive={isProduccionRoute}
                  />
                }
              >
                <FactoryIcon />
                <span>Produccion</span>
                <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/menu-button:rotate-90" />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-1">
                <SidebarMenuSub>
                  {produccion.map((item) => (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton
                        render={<NavLink href={item.href} />}
                        isActive={matchesRoute(pathname, item.href)}
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
                    className="font-medium"
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
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border/70 p-3">
        <button
          type="button"
          onClick={() => toast.info("Administración de suscripción disponible próximamente.")}
          className="group relative cursor-pointer rounded-2xl text-left outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/40 group-data-[collapsible=icon]:hidden"
        >
          <Card
            size="sm"
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_32%),linear-gradient(145deg,_rgba(33,33,37,0.98)_0%,_rgba(11,11,12,0.98)_42%,_rgba(22,22,25,0.98)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_rgba(0,0,0,0.24)] ring-0 transition-all duration-300 group-hover:border-white/18 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_22px_44px_rgba(0,0,0,0.28)]"
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute -left-1/3 top-0 h-full w-1/3 bg-gradient-to-r from-cyan-400/0 via-cyan-400/22 to-cyan-400/0 blur-xl transition-transform duration-500 group-hover:translate-x-[260%]" />
              <div className="absolute -left-1/3 top-0 h-full w-1/3 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/18 to-fuchsia-500/0 blur-xl transition-transform delay-75 duration-500 group-hover:translate-x-[290%]" />
              <div className="absolute -left-1/3 top-0 h-full w-1/3 bg-gradient-to-r from-amber-300/0 via-amber-300/20 to-amber-300/0 blur-xl transition-transform delay-150 duration-500 group-hover:translate-x-[320%]" />
            </div>
            <CardHeader className="relative gap-3 p-4">
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                  Plan actual
                </p>
                <div className="flex items-center gap-2">
                  <GemIcon className="size-4 text-cyan-300 transition-transform duration-300 group-hover:scale-110" />
                  <CardTitle className="truncate text-lg font-semibold tracking-[-0.03em] text-white">
                    {planNombre}
                  </CardTitle>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-300 transition-[width] duration-500"
                    style={{ width: `${suscripcionProgress}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-white/72">
                  <CalendarClockIcon className="size-3.5 text-white/42" />
                  <span>{suscripcionEstado}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative border-t border-white/8 bg-white/[0.03] px-4 py-2.5">
              <p className="text-center text-[10px] uppercase tracking-[0.18em] text-white/38 transition-colors duration-300 group-hover:text-white/60">
                Administrar
              </p>
            </CardContent>
          </Card>
        </button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
