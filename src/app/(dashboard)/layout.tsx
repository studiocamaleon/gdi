import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let current;

  try {
    current = await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar currentUser={current.currentUser} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {current.currentUser.tenantActual.nombre}
            </span>
            <span className="text-xs text-muted-foreground">
              Rol: {current.currentUser.tenantActual.rol}
            </span>
          </div>
        </header>

        <main className="flex flex-1 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
