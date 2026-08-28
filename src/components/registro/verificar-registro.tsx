"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, LogInIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completarRegistro, type EstadoRegistro } from "@/lib/registro-api";
import { setSessionToken } from "@/lib/session";

export function VerificarRegistro({ token, estado, autenticado }: { token: string; estado: EstadoRegistro; autenticado: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function completar() {
    setCargando(true); setError(null);
    try {
      const respuesta = await completarRegistro(token, estado.requiereLogin);
      if (respuesta.requiereLogin) {
        router.push(`/login?registro=${encodeURIComponent(token)}`); return;
      }
      if (respuesta.accessToken) await setSessionToken(respuesta.accessToken);
      router.replace("/bienvenida"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos crear la cuenta."); setCargando(false); }
  }
  const bloqueado = !estado.valido || estado.completado;
  return <Card className="w-full max-w-lg py-7">
    <CardHeader className="text-center"><div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">{bloqueado ? <TriangleAlertIcon /> : <CheckCircle2Icon />}</div><CardTitle className="text-xl">{estado.completado ? "Esta cuenta ya fue creada" : estado.vencido ? "El enlace venció" : `Crear ${estado.empresa}`}</CardTitle><CardDescription>Plan {estado.plan} · correo {estado.email}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {estado.requiereLogin && !autenticado ? <Alert><LogInIcon /><AlertTitle>Ya existe una cuenta con este correo</AlertTitle><AlertDescription>Iniciá sesión con tu contraseña actual. Después volveremos acá para agregar la nueva empresa.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>No pudimos continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {bloqueado ? <Button className="w-full" render={<a href="/registro" />}>Volver a registrarme</Button> : estado.requiereLogin && !autenticado ? <Button className="w-full" render={<a href={`/login?registro=${encodeURIComponent(token)}`} />}>Iniciar sesión y continuar</Button> : <Button className="w-full" size="lg" loading={cargando} loadingText="Creando tu espacio…" onClick={completar}>Confirmar y crear mi cuenta</Button>}
    </CardContent>
  </Card>;
}
