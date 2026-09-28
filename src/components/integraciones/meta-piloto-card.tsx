"use client";

import { useRef, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  getMetaPiloto,
  enviarPruebaMeta,
  type EstadoMetaPiloto,
} from "@/lib/meta-piloto-api";

const estados: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "No entregado",
  enviada: "Aceptado por Meta",
  enviando: "Esperando confirmación",
  meta_incierta: "Envío sin confirmar",
  fallida: "No enviado",
};

export function MetaPilotoCard({
  inicial,
  puedeEnviar,
}: {
  inicial: EstadoMetaPiloto;
  puedeEnviar: boolean;
}) {
  const [datos, setDatos] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [hayReintento, setHayReintento] = useState(false);
  const [habilitado, setHabilitado] = useState(true);
  const clave = useRef<string | null>(null);
  const lock = useRef(false);
  async function ejecutar(enviar: boolean) {
    if (lock.current) return;
    lock.current = true;
    setOcupado(true);
    try {
      if (enviar && !clave.current) clave.current = crypto.randomUUID();
      const nuevo = enviar
        ? await enviarPruebaMeta(clave.current!)
        : await getMetaPiloto();
      if (!nuevo) {
        setHabilitado(false);
        return;
      }
      setDatos(nuevo);
      if (enviar) {
        clave.current = null;
        setHayReintento(false);
      }
    } catch (error) {
      // Conservar la misma clave tras una caída. Repetir la consulta no debe
      // producir otro mensaje si el servidor ya recibió el primer pedido.
      if (enviar) setHayReintento(true);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar la prueba.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>WhatsApp directo · prueba interna</CardTitle>
        <CardDescription>
          Comprobá el envío desde Grafo y la confirmación de entrega de Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <AlertTitle>
            {datos.listo && habilitado
              ? "Destinatario de prueba"
              : "Conexión pendiente"}
          </AlertTitle>
          <AlertDescription>
            {datos.listo && habilitado
              ? `Se enviará el saludo de prueba de Meta a ${datos.destinatario}. Cada nueva prueba envía un mensaje real.`
              : "Todavía falta habilitar la conexión de prueba en el servidor."}
            {!puedeEnviar &&
              " El plan de esta empresa todavía no incluye WhatsApp automático."}
          </AlertDescription>
        </Alert>
        {datos.mensajes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prueba</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.mensajes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    {new Date(m.createdAt).toLocaleString("es-AR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {estados[m.estadoEntrega ?? m.estado] ?? "Pendiente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.motivo ??
                      (m.estadoEntrega
                        ? "Confirmado por Meta."
                        : "La aceptación todavía no confirma la entrega.")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          disabled={ocupado || !datos.listo || !puedeEnviar || !habilitado}
          onClick={() => void ejecutar(true)}
        >
          <Send data-icon="inline-start" />
          {hayReintento
            ? "Reintentar la misma prueba"
            : "Enviar mensaje de prueba"}
        </Button>
        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => void ejecutar(false)}
        >
          <RefreshCw data-icon="inline-start" />
          Actualizar estados
        </Button>
      </CardFooter>
    </Card>
  );
}
