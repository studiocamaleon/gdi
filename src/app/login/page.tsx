import { redirect } from "next/navigation";
import { tryGetCurrentUser } from "@/lib/auth";
import { GdiLoginArt } from "@/components/brand/gdi-login-art";
import { GdiLogo } from "@/components/brand/gdi-logo";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const current = await tryGetCurrentUser();

  if (current) {
    redirect("/");
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="relative min-h-[52vh] overflow-hidden bg-[#090d1d] text-white lg:min-h-screen">
        <GdiLoginArt animated className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,9,20,0.18),rgba(6,9,20,0.58))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,171,64,0.22),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(77,124,255,0.22),transparent_28%)]" />

        <div className="relative flex min-h-[52vh] flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:min-h-screen lg:px-12 lg:py-12">
          <div className="flex flex-col gap-8">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/55">
                Industria grafica digital
              </p>
              <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                El color es un poder que influye directamente en el alma.
              </h1>
              <p className="mt-3 text-sm text-white/62 sm:text-base">
                Wassily Kandinsky
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <GdiLogo className="h-auto w-full max-w-[21rem] sm:max-w-[25rem] lg:max-w-[29rem]" />
          </div>
        </div>
      </section>

      <section className="flex min-h-[48vh] items-center bg-[linear-gradient(180deg,oklch(0.992_0.004_85),oklch(0.968_0.008_85))] px-6 py-10 sm:px-10 lg:min-h-screen lg:px-16 lg:py-14">
        <div className="mx-auto flex w-full max-w-xl items-center">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
