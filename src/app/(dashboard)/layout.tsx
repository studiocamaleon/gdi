import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getCurrentUserCached } from "@/lib/auth-server";
import { getSessionToken } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { NavigationFeedbackProvider } from "@/components/navigation/navigation-feedback";
import { UserTenantMenu } from "@/components/user-tenant-menu";
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
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    redirect("/login");
  }

  let currentUser;

  try {
    const current = await getCurrentUserCached();
    currentUser = current.currentUser;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  return (
    <NavigationFeedbackProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar currentUser={currentUser} />
        <SidebarInset className="main">
          <header className="topbar">
            <SidebarTrigger className="icon-btn" />
            <div className="ml-auto">
              <UserTenantMenu currentUser={currentUser} />
            </div>
          </header>

          <main className="gp-main flex flex-1">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </NavigationFeedbackProvider>
  );
}
