"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2Icon,
  ChevronRightIcon,
  CreditCardIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const isDashboard = pathname === "/";
  const isRegistrosRoute = registros.some((item) => item.href === pathname);
  const [isRegistrosOpen, setIsRegistrosOpen] =
    React.useState(isRegistrosRoute);

  React.useEffect(() => {
    setIsRegistrosOpen(isRegistrosRoute);
  }, [isRegistrosRoute]);

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
                src="/brand/logo-saas.png"
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
                        isActive={pathname === item.href}
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
                  Suscripcion
                </p>
                <CardTitle className="mt-1 text-sm font-semibold text-white">
                  Plan Pro Industria
                </CardTitle>
              </div>
            </div>
            <CardDescription className="text-white/65">
              24 dias restantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="brand" size="sm" className="w-full">
              Administrar
            </Button>
          </CardContent>
        </Card>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Lucas Gomez"
              className="h-auto min-h-14 rounded-2xl border border-white/8 bg-white/4 px-2.5 py-2 shadow-none hover:bg-white/7"
            >
              <Avatar size="lg">
                <AvatarFallback className="bg-amber-400/20 font-medium text-amber-100">
                  LG
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-white">
                  Lucas Gomez
                </span>
                <span className="truncate text-xs text-white/55">
                  Administrador
                </span>
              </div>
              <Settings2Icon className="ml-auto text-white/45" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
