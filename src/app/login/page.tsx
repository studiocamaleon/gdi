import { redirect } from "next/navigation";

import { tryGetCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const current = await tryGetCurrentUser();

  if (current) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_30%),linear-gradient(180deg,rgba(12,10,9,1),rgba(23,23,23,1))] px-4 py-10">
      <LoginForm />
    </main>
  );
}
