"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completarOnboarding } from "@/lib/registro-api";

export function Bienvenida() {
  const router = useRouter(); const [cargando, setCargando] = useState(false);
  async function entrar() { setCargando(true); await completarOnboarding(); router.replace("/"); router.refresh(); }
  return <Card className="w-full max-w-2xl py-8"><CardHeader><div className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">Tu espacio está listo</div><CardTitle className="text-3xl">Bienvenido a Grafoprint</CardTitle><CardDescription>Tu Trial ya está corriendo. Empezá por estas tres decisiones y el sistema se va a adaptar a tu imprenta.</CardDescription></CardHeader><CardContent className="space-y-6"><ol className="grid gap-3 sm:grid-cols-3">{["Completá los datos de tu empresa", "Cargá máquinas y materiales", "Creá tu primer producto"].map((t, i) => <li key={t} className="rounded-xl border bg-muted/30 p-4"><span className="mb-3 grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span><span className="font-medium">{t}</span></li>)}</ol><div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckIcon className="size-4 text-emerald-600" /> No necesitás tarjeta durante la prueba.</div><Button size="lg" className="w-full" loading={cargando} loadingText="Preparando el panel…" onClick={entrar}>Entrar a mi empresa <ArrowRightIcon /></Button></CardContent></Card>;
}
