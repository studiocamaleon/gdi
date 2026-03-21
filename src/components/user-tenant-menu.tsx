"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  Building2Icon,
  ChevronDownIcon,
  CheckIcon,
  LogOutIcon,
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
import { Badge } from "@/components/ui/badge";
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-11 rounded-2xl border border-border/70 bg-background/80 px-2.5 hover:bg-accent/60"
          />
        }
      >
        <Avatar size="default">
          <AvatarFallback className="bg-[#ff7a00] text-white ring-1 ring-[#ff9a3d]/55 shadow-[0_8px_18px_rgba(255,122,0,0.35)]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 text-left leading-tight">
          <span className="truncate text-sm font-semibold">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {currentUser.tenantActual.nombre}
          </span>
        </div>
        <ChevronDownIcon className="ml-1 size-4 text-muted-foreground" />
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
