import Link from "next/link";
import { AlertTriangleIcon, LockKeyholeIcon } from "lucide-react";

import type { CurrentUser } from "@/lib/auth";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SuscripcionGlobalBanner({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  const suscripcion = currentUser.tenantActual.suscripcion;
  if (!suscripcion) return null;

  const soloLectura = suscripcion.soloLectura === true;
  const pagoPendiente = suscripcion.estadoProveedor === "past_due";
  if (!soloLectura && !pagoPendiente) return null;

  const dias = suscripcion.diasGraciaRestantes ?? null;
  const esAdmin = currentUser.tenantActual.rol === "administrador";

  return (
    <div className="px-3 pt-3 md:px-5">
      <Alert
        className={
          soloLectura
            ? "border-red-200 bg-red-50 text-red-950 md:pr-32"
            : "border-amber-200 bg-amber-50 text-amber-950 md:pr-32"
        }
      >
        {soloLectura ? <LockKeyholeIcon /> : <AlertTriangleIcon />}
        <AlertTitle>
          {soloLectura
            ? "La cuenta está en modo solo lectura"
            : "Hay un pago pendiente"}
        </AlertTitle>
        <AlertDescription className="text-current/75">
          {soloLectura
            ? "Podés consultar y exportar información, pero no crear ni modificar datos hasta regularizar el pago."
            : dias === null
              ? "Revisá el medio de pago para evitar que la cuenta pase a solo lectura."
              : `Tenés ${dias} ${dias === 1 ? "día" : "días"} para actualizar el pago antes de que la cuenta pase a solo lectura.`}
          {!esAdmin ? " Avisale a un administrador de la empresa." : ""}
        </AlertDescription>
        {esAdmin ? (
          <AlertAction className="static col-span-full mt-2 md:absolute md:top-2 md:right-2 md:mt-0">
            <Link
              href="/suscripcion"
              className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors hover:bg-muted"
            >
              Revisar pago
            </Link>
          </AlertAction>
        ) : null}
      </Alert>
    </div>
  );
}
