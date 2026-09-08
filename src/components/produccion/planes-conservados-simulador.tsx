"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { NestingViewer } from "@/components/nesting/nesting-viewer";
import type { SimuladorJob } from "@/lib/simulador-impresion-api";
import s from "./planes-conservados-simulador.module.css";

export function PlanesConservadosSimulador({ jobs }: { jobs: SimuladorJob[] }) {
  const planes = jobs.filter((j) => j.planFabricacion);
  if (!planes.length) return null;
  return (
    <section className={s.section} aria-label="Planes listos para imprimir">
      <header className={s.heading}>
        <span className={s.kicker}>GRAFOPRINT · PRODUCCIÓN</span>
        <h2>Planes listos para imprimir</h2>
        <p>
          Conservan la distribución cotizada y el registro de sus capas para los
          procesos siguientes.
        </p>
      </header>
      <div className={s.plans}>
        {planes.map((job) => (
          <Card key={job.pasoId} size="sm">
            <CardHeader>
              <CardTitle>{job.producto}</CardTitle>
              <CardDescription>
                {job.codigo}
                {job.cliente ? ` · ${job.cliente}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NestingViewer result={job.planFabricacion!} maxPx={480} />
            </CardContent>
            <CardFooter className={s.footer}>
              <span>
                {job.planFabricacion!.piezasAcomodadas.toLocaleString("es-AR")}{" "}
                piezas
              </span>
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/produccion/ordenes/${job.ordenId}`} />}
              >
                Abrir producción <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
