"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  Building2Icon,
  ChevronDownIcon,
  CheckIcon,
  LogOutIcon,
  KeyRoundIcon,
} from "lucide-react";

import { logout, switchTenant, type CurrentUser } from "@/lib/auth";
import { clearSessionToken, setSessionToken } from "@/lib/session";
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
import { Button } from "@/components/ui/button";

function buildDisplayName(currentUser: CurrentUser) {
  const fullName = currentUser.nombreCompleto?.trim();
  if (fullName) {
    return fullName;
  }

  const [localPart] = currentUser.email.split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildInitialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "GD";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type UserTenantMenuProps = {
  currentUser: CurrentUser;
};

export function UserTenantMenu({ currentUser }: UserTenantMenuProps) {
  const router = useRouter();
  const [isSwitching, startSwitching] = React.useTransition();
  const [isLoggingOut, startLogout] = React.useTransition();
  const displayName = buildDisplayName(currentUser);
  const initials = buildInitialsFromName(displayName);
  const puedeCambiarEmpresa = currentUser.tenants.length > 1;

  const handleTenantSwitch = (tenantId: string) => {
    if (tenantId === currentUser.tenantActual.id) {
      return;
    }

    startSwitching(async () => {
      const response = await switchTenant(tenantId);

      if (response.accessToken) {
        await setSessionToken(response.accessToken);
      }

      router.refresh();
    });
  };

  const handleLogout = () => {
    startLogout(async () => {
      try {
        await logout();
      } finally {
        await clearSessionToken();
        router.replace("/login");
        router.refresh();
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="user-pill h-auto"
          />
        }
      >
        <Avatar className="av">
          <AvatarFallback className="bg-transparent text-inherit">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="meta">
          <div className="nm">{displayName}</div>
          <div className="org">
            {currentUser.tenantActual.nombre}
          </div>
        </div>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="min-w-80">
        <div className="space-y-1.5 rounded-t-2xl border-b border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_34%),linear-gradient(145deg,_rgba(28,28,31,0.98)_0%,_rgba(12,12,14,0.98)_100%)] px-3 py-3 text-white">
          <div className="text-sm font-semibold">{displayName}</div>
          <div className="text-xs text-white/55">{formatRoleLabel(currentUser.tenantActual.rol)}</div>
          <div className="flex items-center gap-2 pt-1 text-sm text-white/82">
            <CheckIcon className="size-4 text-emerald-300" />
            <span className="truncate">{currentUser.tenantActual.nombre}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {puedeCambiarEmpresa ? "Cambiar empresa de trabajo" : "Empresa disponible"}
          </DropdownMenuLabel>
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
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {tenant.id !== currentUser.tenantActual.id && puedeCambiarEmpresa ? (
                    <ArrowLeftRightIcon className="size-3.5" />
                  ) : null}
                  {formatRoleLabel(tenant.rol)}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="p-1">
          {/* La única forma de cambiar la clave propia: antes no existía
              ninguna, ni siquiera para el que la había elegido al entrar. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            render={<Link href="/cambiar-clave" />}
            className="h-9 w-full justify-start rounded-xl"
          >
            <KeyRoundIcon />
            Cambiar mi clave
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLoggingOut}
            onClick={handleLogout}
            className="h-9 w-full justify-start rounded-xl"
          >
            <LogOutIcon />
            {isLoggingOut ? "Cerrando sesion..." : "Cerrar sesion"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
