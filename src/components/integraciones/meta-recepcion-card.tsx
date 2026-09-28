"use client";

import { useRef, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
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
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { getMetaRecepcion, type RecepcionMeta } from "@/lib/meta-recepcion-api";

const tipos: Record<string, string> = {
  text: "Texto",
  image: "Imagen",
  audio: "Audio",
  video: "Video",
  document: "Documento",
  sticker: "Sticker",
  location: "Ubicación",
  contacts: "Contacto",
  reaction: "Reacción",
  interactive: "Respuesta interactiva",
  button: "Respuesta a botón",
  unsupported: "Contenido no compatible",
};

export function MetaRecepcionCard({ inicial }: { inicial: RecepcionMeta }) {
  const [datos, setDatos] = useState<RecepcionMeta | null>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const { fechaHora } = useFecha();

  async function actualizar() {
    if (lock.current) return;
    lock.current = true;
    setOcupado(true);
    setError(null);
    try {
      setDatos(await getMetaRecepcion());
    } catch {
      // No conservar conversaciones visibles si cambió el acceso o la sesión.
      setDatos(null);
      setError(
        "No se pudieron consultar los mensajes. Revisá tu sesión y volvé a actualizar.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Mensajes recibidos · prueba interna</CardTitle>
        <CardDescription>
          Los últimos 50 mensajes del contacto de prueba. Esta vista es de sólo
          lectura.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4" aria-busy={ocupado}>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos actualizar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !datos ? (
          <Alert>
            <AlertTitle>Recepción no disponible</AlertTitle>
            <AlertDescription>
              La prueba ya no está habilitada para esta empresa.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <AlertTitle>Contacto autorizado: {datos.contacto}</AlertTitle>
              <AlertDescription>
                Podés responder al número de prueba de Meta desde ese WhatsApp y
                después actualizar aquí. Los adjuntos se indican por su tipo;
                todavía no se pueden abrir ni responder desde Grafo.
              </AlertDescription>
            </Alert>
            {datos.mensajes.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircle />
                  </EmptyMedia>
                  <EmptyTitle>Todavía no hay mensajes recibidos</EmptyTitle>
                  <EmptyDescription>
                    Acá aparecerán los mensajes nuevos que recibamos después de
                    habilitar esta prueba.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ol
                aria-label="Mensajes recibidos"
                className="flex max-h-96 flex-col gap-3 overflow-y-auto"
              >
                {datos.mensajes.map((mensaje) => (
                  <li key={mensaje.id}>
                    <Card size="sm">
                      <CardHeader>
                        <CardTitle className="break-words">
                          {mensaje.nombreContacto || mensaje.remitente}
                        </CardTitle>
                        <CardDescription>
                          <time dateTime={mensaje.enviadoEl}>
                            {fechaHora(mensaje.enviadoEl)}
                          </time>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {mensaje.tipo === "text" ? (
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {mensaje.texto}
                          </p>
                        ) : (
                          <p>
                            Este contenido todavía no se puede visualizar en
                            Grafo.
                          </p>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Badge variant="secondary">
                          {tipos[mensaje.tipo] ?? "Otro contenido"}
                        </Badge>
                      </CardFooter>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => void actualizar()}
        >
          <RefreshCw data-icon="inline-start" />
          {ocupado ? "Actualizando mensajes…" : "Actualizar mensajes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
