"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, Monitor, Unplug } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useDesignTheme } from "@/components/design-system/appearance";
import s from "./gestion-pantallas.module.css";

type Pantalla = {
  id: string;
  nombre: string;
  intervaloSegundos: number;
  vinculadaEl: string;
  revocadaEl: string | null;
  expiraEl: string;
  ultimaConexionEl: string | null;
};

export function GestionPantallas() {
  const theme = useDesignTheme();
  const [pantallas, setPantallas] = useState<Pantalla[]>([]);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [intervalo, setIntervalo] = useState("15");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [revocando, setRevocando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [url, setUrl] = useState("/pantalla/produccion");
  const cargar = useCallback(async () => {
    try {
      setPantallas(await apiRequest<Pantalla[]>("/produccion/pantallas"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las pantallas.",
      );
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    setUrl(`${window.location.origin}/pantalla/produccion`);
    void cargar();
  }, [cargar]);

  async function vincular(event: FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await apiRequest("/produccion/pantallas/vincular", {
        method: "POST",
        body: JSON.stringify({
          codigo,
          nombre,
          intervaloSegundos: Number(intervalo),
        }),
      });
      setCodigo("");
      setNombre("");
      setMensaje(
        "Pantalla vinculada. El televisor mostrará las entregas en unos segundos.",
      );
      await cargar();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo vincular la pantalla.",
      );
    } finally {
      setGuardando(false);
    }
  }
  async function revocar(pantalla: Pantalla) {
    setRevocando(pantalla.id);
    setError("");
    setMensaje("");
    try {
      await apiRequest(`/produccion/pantallas/${pantalla.id}`, {
        method: "DELETE",
      });
      setMensaje(
        `Se revocó el acceso de ${pantalla.nombre}. Para usarla de nuevo deberá vincularse con otro código.`,
      );
      await cargar();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo revocar el acceso.",
      );
    } finally {
      setRevocando(null);
    }
  }
  return (
    <div className={`${theme} ${s.page}`} data-appearance="light">
      <Link href="/produccion/tablero" className={s.back}>
        <ArrowLeft size={16} />
        Volver al tablero
      </Link>
      <header className={s.header}>
        <Monitor aria-hidden="true" />
        <div>
          <h1>Pantallas de producción</h1>
          <p>Producción en tiempo real, en cada televisor del taller.</p>
        </div>
      </header>
      <section className={s.instructions}>
        <div>
          <h2>1. Abrí la vista en el televisor</h2>
          <p>
            En el navegador del Raspberry, entrá a esta dirección. Va a mostrar
            un código de ocho caracteres.
          </p>
          <code>{url}</code>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a href="/pantalla/produccion" target="_blank" rel="noreferrer" />
          }
        >
          <ExternalLink data-icon="inline-start" />
          Abrir vista TV
        </Button>
      </section>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {mensaje && (
        <Alert>
          <AlertDescription>{mensaje}</AlertDescription>
        </Alert>
      )}
      <section className={s.panel}>
        <h2>2. Vinculá la pantalla</h2>
        <p>
          Usá el código que estás viendo en el TV. El acceso queda limitado a
          esta empresa y se puede revocar en cualquier momento.
        </p>
        <form onSubmit={vincular} className={s.form}>
          <FieldGroup className={s.fields}>
            <Field>
              <FieldLabel htmlFor="pantalla-codigo">
                Código del televisor
              </FieldLabel>
              <Input
                id="pantalla-codigo"
                placeholder="ABCD-2345"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                required
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pantalla-nombre">
                Nombre de la pantalla
              </FieldLabel>
              <Input
                id="pantalla-nombre"
                placeholder="TV del taller"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                minLength={2}
                maxLength={60}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pantalla-intervalo">
                Segundos por página
              </FieldLabel>
              <Input
                id="pantalla-intervalo"
                type="number"
                min={10}
                max={60}
                step={1}
                value={intervalo}
                onChange={(e) => setIntervalo(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          <Button type="submit" loading={guardando} loadingText="Vinculando">
            Vincular pantalla
          </Button>
        </form>
        <small>
          El código vence a los 10 minutos. La vinculación dura 180 días y no
          depende de mantener tu sesión abierta en el Raspberry.
        </small>
      </section>
      <section className={s.panel}>
        <div className={s.listHeading}>
          <h2>Pantallas vinculadas</h2>
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              void cargar();
            }}
          >
            Actualizar
          </Button>
        </div>
        {cargando ? (
          <p role="status">Cargando pantallas…</p>
        ) : !pantallas.length ? (
          <p>Todavía no vinculaste ningún televisor.</p>
        ) : (
          <ul className={s.list}>
            {pantallas.map((p) => {
              const vencida = new Date(p.expiraEl).getTime() <= Date.now();
              return (
                <li key={p.id}>
                  <Monitor aria-hidden="true" />
                  <div className={s.details}>
                    <strong>{p.nombre}</strong>
                    <span>
                      {p.intervaloSegundos} segundos por página ·{" "}
                      {p.ultimaConexionEl
                        ? `Última conexión: ${new Date(p.ultimaConexionEl).toLocaleString("es-AR")}`
                        : "Esperando la primera conexión"}
                    </span>
                    <small>
                      Vinculación hasta el{" "}
                      {new Date(p.expiraEl).toLocaleDateString("es-AR")}
                    </small>
                  </div>
                  <Badge
                    variant={p.revocadaEl || vencida ? "secondary" : "outline"}
                  >
                    {p.revocadaEl
                      ? "Revocada"
                      : vencida
                        ? "Vencida"
                        : "Vinculada"}
                  </Badge>
                  {!p.revocadaEl && !vencida && (
                    <Button
                      variant="outline"
                      loading={revocando === p.id}
                      disabled={revocando !== null}
                      onClick={() => void revocar(p)}
                      aria-label={`Revocar acceso de ${p.nombre}`}
                    >
                      <Unplug data-icon="inline-start" />
                      Revocar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={s.panel}>
        <h2>Uso diario con Raspberry</h2>
        <p>
          Configurá Chromium para abrir la dirección del televisor en modo
          kiosco al encender. Usá un perfil persistente, para conservar la
          vinculación entre reinicios. Si borrás las cookies o usás navegación
          privada, tendrás que vincularlo nuevamente.
        </p>
        <p>
          La vista se adapta al tamaño disponible, rota las páginas y consulta
          cambios cada 10 segundos. Si pierde conexión, conserva la última
          lectura y muestra un aviso visible.
        </p>
      </section>
    </div>
  );
}
