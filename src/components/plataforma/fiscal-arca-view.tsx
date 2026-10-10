"use client";

import * as React from "react";
import { FileKey2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getFiscalArca,
  guardarFiscalArca,
  type FiscalArcaEstado,
} from "@/lib/plataforma-api";
import { fechaCorta } from "@/lib/fecha";

const MAX_ARCHIVO = 16 * 1024;

export function FiscalArcaView({
  esAdmin,
  vistaPrevia,
}: {
  esAdmin: boolean;
  vistaPrevia?: FiscalArcaEstado;
}) {
  const [estado, setEstado] = React.useState<FiscalArcaEstado | null>(
    vistaPrevia ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(!vistaPrevia);
  const [guardando, setGuardando] = React.useState(false);
  const [certificado, setCertificado] = React.useState<File | null>(null);
  const [clave, setClave] = React.useState<File | null>(null);
  const [intento, setIntento] = React.useState(0);
  const formulario = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (vistaPrevia) return;
    let vigente = true;
    getFiscalArca()
      .then((resultado) => {
        if (vigente) {
          setEstado(resultado);
          setError(null);
        }
      })
      .catch(() => {
        if (vigente) setError("No se pudo consultar la configuración de ARCA.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [intento, vistaPrevia]);

  function elegir(
    archivo: File | null,
    tipo: "certificado" | "clave",
    input: HTMLInputElement,
  ) {
    const extension =
      tipo === "certificado" ? /\.(crt|pem)$/i : /\.(key|pem)$/i;
    if (
      archivo &&
      (!extension.test(archivo.name) ||
        archivo.size === 0 ||
        archivo.size > MAX_ARCHIVO)
    ) {
      input.value = "";
      archivo = null;
      setError(
        "Seleccioná un archivo PEM con la extensión indicada, de hasta 16 KB.",
      );
    } else setError(null);
    if (tipo === "certificado") setCertificado(archivo);
    else setClave(archivo);
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!estado || !certificado || !clave || guardando || vistaPrevia) return;
    setGuardando(true);
    setError(null);
    try {
      const [cert, key] = await Promise.all([certificado.text(), clave.text()]);
      const resultado = await guardarFiscalArca({
        ambiente: estado.ambiente,
        certificado: cert,
        clavePrivada: key,
        revisionAnterior: estado.certificado?.revision ?? null,
      });
      setEstado(resultado);
      setCertificado(null);
      setClave(null);
      formulario.current?.reset();
      toast.success(
        "Certificado guardado. Verificá la conexión desde la empresa antes de facturar.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el certificado.",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando)
    return (
      <div className="cpl-page" role="status">
        Consultando la configuración fiscal…
      </div>
    );
  if (!estado)
    return (
      <div className="cpl-page flex flex-col items-start gap-4">
        <p role="alert">{error}</p>
        <ActionButton
          onPress={() => {
            setCargando(true);
            setIntento((n) => n + 1);
          }}
        >
          Reintentar
        </ActionButton>
      </div>
    );
  const cert = estado.certificado;
  return (
    <div className="cpl-page">
      <div className="flex max-w-5xl flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                <h2 className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" /> Certificado de
                  la plataforma
                </h2>
              </CardTitle>
              <Badge
                variant={estado.ambiente === "prod" ? "default" : "secondary"}
              >
                {estado.ambiente === "prod"
                  ? "Producción · validez fiscal"
                  : "Homologación · pruebas"}
              </Badge>
            </div>
            <CardDescription>
              Grafo usa este certificado para operar ante ARCA. Cada empresa
              conserva su CUIT, sus puntos de venta y su autorización.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">
                  Titular del certificado
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {cert
                    ? cert.cuit.replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3")
                    : "Sin cargar"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Vencimiento</dt>
                <dd className="mt-1 font-medium">
                  {cert ? fechaCorta(cert.validoHasta) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Estado del archivo
                </dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      cert && !estado.vigente ? "destructive" : "secondary"
                    }
                  >
                    {cert
                      ? estado.vigente
                        ? "Vigente"
                        : "Fuera de vigencia"
                      : "Pendiente"}
                  </Badge>
                </dd>
              </div>
            </dl>
            {!estado.proveedorConfigurado && (
              <p role="status" className="text-sm text-destructive">
                Falta configurar el acceso de Grafo a AFIP SDK en este entorno.
              </p>
            )}
            {!estado.cifradoDisponible && (
              <p role="status" className="text-sm text-destructive">
                Falta configurar la protección de credenciales. La carga está
                deshabilitada.
              </p>
            )}
          </CardContent>
          <CardFooter className="bg-surface-secondary">
            <p className="text-sm text-muted-foreground">
              Un archivo vigente no confirma la autorización de ARCA. Después de
              guardarlo, verificá la conexión y el punto de venta desde
              Integraciones de cada empresa.
            </p>
          </CardFooter>
        </Card>

        {esAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="flex items-center gap-2">
                  <FileKey2 className="size-5 text-primary" />{" "}
                  {cert ? "Reemplazar certificado" : "Cargar certificado"}
                </h2>
              </CardTitle>
              <CardDescription>
                Seleccioná ambos archivos del ambiente{" "}
                {estado.ambiente === "prod"
                  ? "de producción"
                  : "de homologación"}
                . Se guardarán cifrados; su contenido no volverá a mostrarse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                ref={formulario}
                onSubmit={guardar}
                className="flex flex-col gap-6"
              >
                <FieldGroup className="sm:flex-row">
                  <Field>
                    <FieldLabel htmlFor="arca-certificado">
                      Certificado .crt
                    </FieldLabel>
                    <Input
                      id="arca-certificado"
                      type="file"
                      accept=".crt,.pem"
                      disabled={guardando || !estado.cifradoDisponible || !!vistaPrevia}
                      onChange={(e) =>
                        elegir(
                          e.target.files?.[0] ?? null,
                          "certificado",
                          e.target,
                        )
                      }
                    />
                    <FieldDescription>
                      Archivo PEM emitido por ARCA. Hasta 16 KB.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="arca-clave">
                      Clave privada .key
                    </FieldLabel>
                    <Input
                      id="arca-clave"
                      type="file"
                      accept=".key,.pem"
                      disabled={guardando || !estado.cifradoDisponible || !!vistaPrevia}
                      onChange={(e) =>
                        elegir(e.target.files?.[0] ?? null, "clave", e.target)
                      }
                    />
                    <FieldDescription>
                      La clave que corresponde al certificado. Hasta 16 KB.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <ActionButton
                    type="submit"
                    isDisabled={
                      !certificado ||
                      !clave ||
                      guardando ||
                      !estado.cifradoDisponible
                    }
                  >
                    <Upload data-icon="inline-start" />
                    {guardando
                      ? "Guardando…"
                      : cert
                        ? "Reemplazar certificado"
                        : "Guardar certificado"}
                  </ActionButton>
                  <p className="text-sm text-muted-foreground">
                    Esta acción no emite comprobantes.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sólo un administrador de Plataforma puede cargar o reemplazar el
            certificado.
          </p>
        )}
      </div>
    </div>
  );
}
