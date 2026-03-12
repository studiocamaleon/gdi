"use client";

import * as React from "react";
import Image from "next/image";
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
];

const inventario = [
  {
    title: "Materias primas",
    href: "/inventario/materias-primas",
    icon: BoxesIcon,
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  currentUser: CurrentUser;
};

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
      <SidebarHeader className="gap-3 border-b border-sidebar-border/70 px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/" />}
              size="lg"
              tooltip="GDI ERP"
              className="h-auto min-h-32 justify-center bg-transparent px-0 py-0 hover:bg-transparent"
            >
              <Image
                src="/brand/logo-saas.svg"
                alt="Logo del SaaS"
                width={640}
                height={168}
                className="h-28 w-full max-w-[420px] object-contain object-center group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-auto"
                priority
              />
              <span className="sr-only">Inicio</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
