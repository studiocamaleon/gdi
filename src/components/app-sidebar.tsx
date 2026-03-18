"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  Building2Icon,
  CircleDollarSignIcon,
  ChevronRightIcon,
  CreditCardIcon,
  BoxesIcon,
  FolderTreeIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PrinterIcon,
  Settings2Icon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { logout, switchTenant, type CurrentUser } from "@/lib/auth";
import { clearSessionToken, setSessionToken } from "@/lib/session";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    href: "/costos/productos-servicios",
    icon: BoxesIcon,
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
    icon: CreditCardIcon,
  },
  {
    title: "Historial",
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

function buildInitials(email: string) {
  const [localPart] = email.split("@");
  return localPart.slice(0, 2).toUpperCase();
}

export function AppSidebar({ currentUser, ...props }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/";
  const isRegistrosRoute = registros.some((item) =>
    matchesRoute(pathname, item.href),
  );
  const isCostosRoute = costos.some((item) => matchesRoute(pathname, item.href));
  const isInventarioRoute = inventario.some((item) =>
    matchesRoute(pathname, item.href),
  );
  const [isRegistrosOpen, setIsRegistrosOpen] = React.useState(isRegistrosRoute);
  const [isCostosOpen, setIsCostosOpen] = React.useState(isCostosRoute);
  const [isInventarioOpen, setIsInventarioOpen] = React.useState(isInventarioRoute);
  const [isSwitching, startSwitching] = React.useTransition();
  const [isLoggingOut, startLogout] = React.useTransition();

  React.useEffect(() => {
    setIsRegistrosOpen(isRegistrosRoute);
  }, [isRegistrosRoute]);

  React.useEffect(() => {
    setIsCostosOpen(isCostosRoute);
  }, [isCostosRoute]);

  React.useEffect(() => {
    setIsInventarioOpen(isInventarioRoute);
  }, [isInventarioRoute]);

  const handleTenantSwitch = (tenantId: string) => {
    if (tenantId === currentUser.tenantActual.id) {
      return;
    }

    startSwitching(async () => {
      const response = await switchTenant(tenantId);

      if (response.accessToken) {
        setSessionToken(response.accessToken);
      }

      router.refresh();
    });
  };

  const handleLogout = () => {
    startLogout(async () => {
      try {
        await logout();
      } finally {
        clearSessionToken();
        router.replace("/login");
        router.refresh();
      }
    });
  };

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-1 border-b border-sidebar-border/70 px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/" />}
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
              render={<Link href="/" />}
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
                        render={<Link href={item.href} />}
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
                        render={<Link href={item.href} />}
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
                        render={<Link href={item.href} />}
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
        <Card
          size="sm"
          className="rounded-2xl border border-white/8 bg-white/4 text-white shadow-none ring-0 group-data-[collapsible=icon]:hidden"
        >
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white/8 text-amber-300 ring-1 ring-white/10">
                <CreditCardIcon />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                  Empresa activa
                </p>
                <CardTitle className="mt-1 text-sm font-semibold text-white">
                  {currentUser.tenantActual.nombre}
                </CardTitle>
              </div>
            </div>
            <CardDescription className="text-white/65">
              Rol actual: {currentUser.tenantActual.rol}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="brand" size="sm" className="w-full" disabled>
              <ArrowLeftRightIcon />
              Selector en el menu
            </Button>
          </CardContent>
        </Card>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={currentUser.email}
                    className="h-auto min-h-14 rounded-2xl border border-white/8 bg-white/4 px-2.5 py-2 shadow-none hover:bg-white/7"
                  />
                }
              >
                <Avatar size="lg">
                  <AvatarFallback className="bg-amber-400/20 font-medium text-amber-100">
                    {buildInitials(currentUser.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-white">
                    {currentUser.email}
                  </span>
                  <span className="truncate text-xs text-white/55">
                    {currentUser.tenantActual.nombre}
                  </span>
                </div>
                <Settings2Icon className="ml-auto text-white/45" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={8} className="min-w-72">
                <DropdownMenuLabel>
                  {currentUser.email}
                  <div className="mt-1 text-xs text-muted-foreground">
                    Empresa activa: {currentUser.tenantActual.nombre}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel inset>Empresas disponibles</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={currentUser.tenantActual.id}
                    onValueChange={handleTenantSwitch}
                  >
                    {currentUser.tenants.map((tenant) => (
                      <DropdownMenuRadioItem
                        key={tenant.id}
                        value={tenant.id}
                        disabled={isSwitching}
                      >
                        <Building2Icon />
                        {tenant.nombre}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {tenant.rol}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="h-auto justify-start self-start px-2 text-primary group-data-[collapsible=icon]:hidden"
        >
          <LogOutIcon data-icon="inline-start" />
          {isLoggingOut ? "Cerrando sesion..." : "Cerrar sesion"}
        </Button>

        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              size="default"
              tooltip={isLoggingOut ? "Cerrando sesion..." : "Cerrar sesion"}
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="text-primary hover:text-primary"
            >
              <LogOutIcon />
              <span className="sr-only">
                {isLoggingOut ? "Cerrando sesion..." : "Cerrar sesion"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
