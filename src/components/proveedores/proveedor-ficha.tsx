"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  HistoryIcon,
  MapPinHouseIcon,
  PlusIcon,
  SaveIcon,
  StarIcon,
  Trash2Icon,
  UserRoundPlusIcon,
} from "lucide-react";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { NavLink } from "@/components/navigation/nav-link";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { createProveedor, updateProveedor } from "@/lib/proveedores-api";
import {
  ProveedorContacto,
  ProveedorDetalle,
  ProveedorDireccion,
  ProveedorPayload,
  TipoDireccion,
  latamCountries,
} from "@/lib/proveedores";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type ProveedorFichaProps = {
  proveedor: ProveedorDetalle;
  mode: "create" | "edit" | "view";
};

type FieldErrors = {
  nombre?: string;
  email?: string;
  telefono?: string;
  cuit?: string;
  condicionPagoDias?: string;
  contactos: Record<string, string>;
  direcciones: Record<string, string>;
};

type DatosGeneralesState = {
  nombre: string;
  razonSocial: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  email: string;
  pais: string;
  /** Datos para PAGARLE — ver docs/egresos-y-cuentas-por-pagar-diseno.md */
  cuit: string;
  condicionIva: string;
  /** Texto y no número: el input vacío tiene que poder quedar vacío. */
  condicionPagoDias: string;
  cbuAlias: string;
};

const CONDICIONES_IVA = [
  { value: "", label: "Sin especificar" },
  { value: "RI", label: "Responsable inscripto" },
  { value: "MONOTRIBUTO", label: "Monotributo" },
  { value: "EXENTO", label: "Exento" },
  { value: "CF", label: "Consumidor final" },
];

const countryItems = latamCountries.map((country) => ({
  label: `${country.flag} ${country.name}`,
  value: country.code,
}));

const phoneCodeItems = latamCountries.map((country) => ({
  label: `${country.flag} +${country.phoneCode}`,
  value: country.phoneCode,
}));

const addressTypeItems: Array<{ label: string; value: TipoDireccion }> = [
  { label: "Principal", value: "principal" },
  { label: "Facturacion", value: "facturacion" },
  { label: "Entrega", value: "entrega" },
];

function formatWhatsappPhone(phoneCode: string, phoneNumber: string) {
  const sanitizedNumber = phoneNumber.replace(/\D/g, "");
  const sanitizedCode = phoneCode.replace(/\D/g, "");

  if (!sanitizedCode && !sanitizedNumber) {
    return "";
  }

  if (!sanitizedNumber) {
    return `+${sanitizedCode}`;
  }

  return `+${sanitizedCode} ${sanitizedNumber}`;
}

function contactoTieneDatos(contacto: ProveedorContacto) {
  return Boolean(
    contacto.nombre.trim() ||
    contacto.cargo.trim() ||
    contacto.email.trim() ||
    contacto.telefonoNumero.trim(),
  );
}

function direccionTieneDatos(direccion: ProveedorDireccion) {
  return Boolean(
    direccion.descripcion.trim() ||
    direccion.codigoPostal.trim() ||
    direccion.direccion.trim() ||
    direccion.numero.trim() ||
    direccion.ciudad.trim(),
  );
}

function buildPayload(
  datosGenerales: DatosGeneralesState,
  contactos: ProveedorContacto[],
  direcciones: ProveedorDireccion[],
): ProveedorPayload {
  return {
    nombre: datosGenerales.nombre.trim(),
    razonSocial: datosGenerales.razonSocial.trim() || undefined,
    cuit: datosGenerales.cuit.replace(/\D/g, "") || undefined,
    condicionIva: datosGenerales.condicionIva || undefined,
    condicionPagoDias:
      datosGenerales.condicionPagoDias.trim() === ""
        ? undefined
        : Number(datosGenerales.condicionPagoDias),
    cbuAlias: datosGenerales.cbuAlias.trim() || undefined,
    email: datosGenerales.email.trim(),
    pais: datosGenerales.pais.trim(),
    telefonoCodigo: datosGenerales.telefonoNumero.trim()
      ? datosGenerales.telefonoCodigo.trim()
      : "",
    telefonoNumero: datosGenerales.telefonoNumero.trim(),
    contactos: contactos.filter(contactoTieneDatos).map((contacto) => ({
      id: contacto.id,
      nombre: contacto.nombre.trim(),
      cargo: contacto.cargo.trim() || undefined,
      email: contacto.email.trim() || undefined,
      telefonoCodigo: contacto.telefonoNumero.trim()
        ? contacto.telefonoCodigo.trim() || undefined
        : undefined,
      telefonoNumero: contacto.telefonoNumero.trim() || undefined,
      principal: contacto.principal,
    })),
    direcciones: direcciones.filter(direccionTieneDatos).map((direccion) => ({
      id: direccion.id,
      descripcion: direccion.descripcion.trim(),
      pais: direccion.pais.trim(),
      codigoPostal: direccion.codigoPostal.trim() || undefined,
      direccion: direccion.direccion.trim(),
      numero: direccion.numero.trim() || undefined,
      ciudad: direccion.ciudad.trim(),
      tipo: direccion.tipo,
      principal: direccion.principal,
    })),
  };
}

function validatePayload(
  payload: ProveedorPayload,
  contactos: ProveedorContacto[],
  direcciones: ProveedorDireccion[],
): FieldErrors {
  const errors: FieldErrors = { contactos: {}, direcciones: {} };
  if (!payload.nombre) errors.nombre = "Ingresá el nombre del proveedor.";
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.email = "Ingresá un correo electrónico válido.";
  }
  if (payload.telefonoNumero && !payload.telefonoCodigo) {
    errors.telefono = "Elegí el código de país del teléfono.";
  }
  if (payload.cuit && payload.cuit.length !== 11) {
    errors.cuit = "El CUIT debe tener 11 dígitos.";
  }
  if (payload.condicionIva === "RI" && !payload.cuit) {
    errors.cuit = "Un Responsable Inscripto necesita CUIT.";
  }
  if ((payload.condicionPagoDias ?? 0) > 365) {
    errors.condicionPagoDias = "El plazo máximo es de 365 días.";
  }
  contactos.forEach((contacto) => {
    if (!contactoTieneDatos(contacto)) return;
    if (!contacto.nombre.trim()) {
      errors.contactos[contacto.id] = "Ingresá el nombre del contacto.";
    } else if (
      contacto.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto.email)
    ) {
      errors.contactos[contacto.id] = "Revisá el correo del contacto.";
    }
  });
  direcciones.forEach((direccion) => {
    if (!direccionTieneDatos(direccion)) return;
    if (
      !direccion.descripcion.trim() ||
      !direccion.direccion.trim() ||
      !direccion.ciudad.trim()
    ) {
      errors.direcciones[direccion.id] =
        "Completá descripción, dirección y ciudad.";
    }
  });
  return errors;
}

function firstError(errors: FieldErrors) {
  return (
    errors.nombre ??
    errors.email ??
    errors.telefono ??
    errors.cuit ??
    errors.condicionPagoDias ??
    Object.values(errors.contactos)[0] ??
    Object.values(errors.direcciones)[0] ??
    null
  );
}

function createEmptyContacto(phoneCode: string): ProveedorContacto {
  return {
    id: crypto.randomUUID(),
    nombre: "",
    cargo: "",
    email: "",
    telefonoCodigo: phoneCode,
    telefonoNumero: "",
    principal: false,
  };
}

function createEmptyDireccion(countryCode: string): ProveedorDireccion {
  return {
    id: crypto.randomUUID(),
    descripcion: "",
    pais: countryCode,
    codigoPostal: "",
    direccion: "",
    numero: "",
    ciudad: "",
    tipo: "entrega",
    principal: false,
  };
}

export function ProveedorFicha({ proveedor, mode }: ProveedorFichaProps) {
  const router = useRouter();
  const { fechaHora } = useFecha();
  const [isSaving, startSaving] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({
    contactos: {},
    direcciones: {},
  });
  const [version, setVersion] = React.useState(proveedor.updatedAt);
  const [datosGenerales, setDatosGenerales] =
    React.useState<DatosGeneralesState>({
      nombre: proveedor.nombre,
      razonSocial: proveedor.razonSocial,
      telefonoCodigo: proveedor.telefonoCodigo,
      telefonoNumero: proveedor.telefonoNumero,
      email: proveedor.email,
      pais: proveedor.pais,
      cuit: proveedor.cuit,
      condicionIva: proveedor.condicionIva,
      condicionPagoDias:
        proveedor.condicionPagoDias == null
          ? ""
          : String(proveedor.condicionPagoDias),
      cbuAlias: proveedor.cbuAlias,
    });
  const [contactos, setContactos] = React.useState(proveedor.contactos);
  const [direcciones, setDirecciones] = React.useState(proveedor.direcciones);
  const [activeContactoId, setActiveContactoId] = React.useState(
    proveedor.contactos[0]?.id ?? "",
  );
  const [activeDireccionId, setActiveDireccionId] = React.useState(
    proveedor.direcciones[0]?.id ?? "",
  );
  const readOnly = mode === "view";
  const snapshot = JSON.stringify({ datosGenerales, contactos, direcciones });
  const [savedSnapshot, setSavedSnapshot] = React.useState(snapshot);
  const isDirty = !readOnly && snapshot !== savedSnapshot;

  React.useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const confirmNavigation = (event: { preventDefault(): void }) => {
    if (
      isDirty &&
      !window.confirm("Hay cambios sin guardar. ¿Querés salir igualmente?")
    ) {
      event.preventDefault();
    }
  };

  const telefonoWhatsapp = formatWhatsappPhone(
    datosGenerales.telefonoCodigo,
    datosGenerales.telefonoNumero,
  );

  React.useEffect(() => {
    if (contactos.length === 0) {
      setActiveContactoId("");
      return;
    }

    if (!contactos.some((contacto) => contacto.id === activeContactoId)) {
      setActiveContactoId(contactos[0].id);
    }
  }, [activeContactoId, contactos]);

  React.useEffect(() => {
    if (direcciones.length === 0) {
      setActiveDireccionId("");
      return;
    }

    if (!direcciones.some((direccion) => direccion.id === activeDireccionId)) {
      setActiveDireccionId(direcciones[0].id);
    }
  }, [activeDireccionId, direcciones]);

  const addContacto = () => {
    const newContacto = createEmptyContacto(datosGenerales.telefonoCodigo);
    setContactos((current) => [
      ...current,
      { ...newContacto, principal: current.length === 0 },
    ]);
    setActiveContactoId(newContacto.id);
  };

  const removeContacto = (contactoId: string) => {
    setContactos((current) => {
      const nextContactos = current.filter(
        (contacto) => contacto.id !== contactoId,
      );

      if (
        nextContactos.length > 0 &&
        !nextContactos.some((contacto) => contacto.principal)
      ) {
        nextContactos[0] = { ...nextContactos[0], principal: true };
      }

      return nextContactos;
    });
  };

  const updateContacto = (
    contactoId: string,
    field: keyof ProveedorContacto,
    value: string | boolean,
  ) => {
    setContactos((current) =>
      current.map((contacto) =>
        contacto.id === contactoId ? { ...contacto, [field]: value } : contacto,
      ),
    );
  };

  const setPrimaryContacto = (contactoId: string) => {
    setContactos((current) =>
      current.map((contacto) => ({
        ...contacto,
        principal: contacto.id === contactoId,
      })),
    );
  };

  const addDireccion = () => {
    const newDireccion = createEmptyDireccion(datosGenerales.pais);
    setDirecciones((current) => [
      ...current,
      { ...newDireccion, principal: current.length === 0 },
    ]);
    setActiveDireccionId(newDireccion.id);
  };

  const removeDireccion = (direccionId: string) => {
    setDirecciones((current) => {
      const nextDirecciones = current.filter(
        (direccion) => direccion.id !== direccionId,
      );

      if (
        nextDirecciones.length > 0 &&
        !nextDirecciones.some((direccion) => direccion.principal)
      ) {
        nextDirecciones[0] = { ...nextDirecciones[0], principal: true };
      }

      return nextDirecciones;
    });
  };

  const updateDireccion = (
    direccionId: string,
    field: keyof ProveedorDireccion,
    value: string | boolean,
  ) => {
    setDirecciones((current) =>
      current.map((direccion) =>
        direccion.id === direccionId
          ? { ...direccion, [field]: value }
          : direccion,
      ),
    );
  };

  const setPrimaryDireccion = (direccionId: string) => {
    setDirecciones((current) =>
      current.map((direccion) => ({
        ...direccion,
        principal: direccion.id === direccionId,
      })),
    );
  };

  const handleSave = () => {
    setErrorMessage(null);
    setFieldErrors({ contactos: {}, direcciones: {} });

    const payload = buildPayload(datosGenerales, contactos, direcciones);
    const validationErrors = validatePayload(payload, contactos, direcciones);
    const validationError = firstError(validationErrors);

    if (validationError) {
      setFieldErrors(validationErrors);
      setErrorMessage(validationError);
      toast.error(validationError);
      return;
    }

    startSaving(async () => {
      try {
        const savedProveedor =
          mode === "create"
            ? await createProveedor(payload)
            : await updateProveedor(proveedor.id, {
                ...payload,
                updatedAt: version,
              });

        if (mode === "create") {
          toast.success("Proveedor creado correctamente.");
          router.push(`/proveedores/${savedProveedor.id}`);
          router.refresh();
          return;
        }

        setVersion(savedProveedor.updatedAt);
        setSavedSnapshot(snapshot);
        toast.success("Cambios guardados.");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo guardar el proveedor.";

        setErrorMessage(message);
        toast.error(message);
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6 [&>*]:shrink-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <NavLink
            href="/proveedores"
            onClick={confirmNavigation}
            className={buttonVariants({
              variant: "sidebar",
              size: "sm",
              className: "w-fit",
            })}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a proveedores
          </NavLink>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {mode === "create"
                  ? "Nuevo proveedor"
                  : readOnly
                    ? "Proveedor"
                    : "Ficha de proveedor"}
              </h1>
              {!proveedor.activo ? (
                <Badge variant="outline">Inhabilitado</Badge>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Consolida los datos principales del proveedor, sus contactos y sus
              direcciones operativas en una sola vista de trabajo.
            </p>
            {readOnly ? <Badge variant="secondary">Solo lectura</Badge> : null}
          </div>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="brand" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <GdiSpinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
            </Button>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>No se pudieron guardar los cambios</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset
        disabled={readOnly}
        className="contents [&>*]:shrink-0"
      >
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold tracking-tight">
              Datos generales
            </CardTitle>
            <CardDescription>
              Definí la información base del proveedor y el teléfono principal
              en formato compatible con WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid lg:grid-cols-2">
              <Field data-invalid={Boolean(fieldErrors.nombre)}>
                <FieldLabel htmlFor="proveedor-nombre">
                  Nombre del proveedor
                </FieldLabel>
                <Input
                  id="proveedor-nombre"
                  value={datosGenerales.nombre}
                  onChange={(event) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                  placeholder="Ej. Cafe del Centro"
                  aria-invalid={Boolean(fieldErrors.nombre)}
                />
                <FieldError>{fieldErrors.nombre}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="proveedor-razon-social">
                  Razon social
                </FieldLabel>
                <Input
                  id="proveedor-razon-social"
                  value={datosGenerales.razonSocial}
                  onChange={(event) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      razonSocial: event.target.value,
                    }))
                  }
                  placeholder="Ej. Cafe del Centro SRL"
                />
              </Field>

              {/* Datos para PAGARLE. Sin esto, el proveedor sirve para
                referenciar materiales pero no para cargar su factura ni
                emitirle un pago. Ver docs/egresos-y-cuentas-por-pagar-diseno.md */}
              <Field data-invalid={Boolean(fieldErrors.cuit)}>
                <FieldLabel htmlFor="proveedor-cuit">CUIT</FieldLabel>
                <Input
                  id="proveedor-cuit"
                  value={datosGenerales.cuit}
                  onChange={(event) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      cuit: event.target.value.replace(/\D/g, "").slice(0, 11),
                    }))
                  }
                  placeholder="30712345671"
                  inputMode="numeric"
                  aria-invalid={Boolean(fieldErrors.cuit)}
                />
                <FieldError>{fieldErrors.cuit}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="proveedor-condicion-iva">
                  Condicion frente al IVA
                </FieldLabel>
                <Select
                  items={CONDICIONES_IVA}
                  value={datosGenerales.condicionIva}
                  onValueChange={(value) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      condicionIva: value ?? "",
                    }))
                  }
                >
                  <SelectTrigger
                    id="proveedor-condicion-iva"
                    className="w-full"
                  >
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CONDICIONES_IVA.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field data-invalid={Boolean(fieldErrors.condicionPagoDias)}>
                <FieldLabel htmlFor="proveedor-plazo">
                  Condicion de pago (dias)
                </FieldLabel>
                <Input
                  id="proveedor-plazo"
                  value={datosGenerales.condicionPagoDias}
                  onChange={(event) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      condicionPagoDias: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 3),
                    }))
                  }
                  placeholder="30"
                  inputMode="numeric"
                  aria-invalid={Boolean(fieldErrors.condicionPagoDias)}
                />
                <FieldError>{fieldErrors.condicionPagoDias}</FieldError>
                <FieldDescription>
                  Precarga el vencimiento al cargar una factura suya. 0 =
                  contado.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="proveedor-cbu">CBU o alias</FieldLabel>
                <Input
                  id="proveedor-cbu"
                  value={datosGenerales.cbuAlias}
                  onChange={(event) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      cbuAlias: event.target.value,
                    }))
                  }
                  placeholder="mi.alias.banco"
                />
              </Field>

              <Field data-invalid={Boolean(fieldErrors.email)}>
                <FieldLabel htmlFor="proveedor-email">
                  Correo electronico principal
                </FieldLabel>
                <Input
                  id="proveedor-email"
                  type="email"
                  value={datosGenerales.email}
                  onChange={(event) =>
                    setDatosGenerales((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="contacto@empresa.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                <FieldError>{fieldErrors.email}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="proveedor-pais">Pais</FieldLabel>
                <Select
                  items={countryItems}
                  value={datosGenerales.pais}
                  onValueChange={(value) => {
                    if (!value) {
                      return;
                    }

                    setDatosGenerales((current) => ({
                      ...current,
                      pais: value,
                    }));
                  }}
                >
                  <SelectTrigger id="proveedor-pais" className="w-full">
                    <SelectValue placeholder="Selecciona un pais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {countryItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <FieldGroup className="grid md:grid-cols-[180px_1fr] lg:col-span-2">
                <Field data-invalid={Boolean(fieldErrors.telefono)}>
                  <FieldLabel htmlFor="telefono-codigo">Codigo pais</FieldLabel>
                  <Select
                    items={phoneCodeItems}
                    value={datosGenerales.telefonoCodigo}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }

                      setDatosGenerales((current) => ({
                        ...current,
                        telefonoCodigo: value,
                      }));
                    }}
                  >
                    <SelectTrigger
                      id="telefono-codigo"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.telefono)}
                    >
                      <SelectValue placeholder="Codigo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {phoneCodeItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field data-invalid={Boolean(fieldErrors.telefono)}>
                  <FieldLabel htmlFor="telefono-numero">
                    Telefono principal
                  </FieldLabel>
                  <Input
                    id="telefono-numero"
                    inputMode="tel"
                    value={datosGenerales.telefonoNumero}
                    onChange={(event) =>
                      setDatosGenerales((current) => ({
                        ...current,
                        telefonoNumero: event.target.value,
                      }))
                    }
                    placeholder="Numero sin codigo pais"
                    aria-invalid={Boolean(fieldErrors.telefono)}
                  />
                  <FieldError>{fieldErrors.telefono}</FieldError>
                  <FieldDescription>
                    Se guardara como: {telefonoWhatsapp || "Sin definir"}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">
                  Contactos
                </CardTitle>
                <CardDescription>
                  Puedes registrar uno o mas contactos y definir cual sera el
                  principal para la relacion comercial.
                </CardDescription>
              </div>
              <Button
                variant="brand"
                className="w-full sm:w-auto"
                onClick={addContacto}
              >
                <UserRoundPlusIcon data-icon="inline-start" />
                Agregar contacto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Tabs
              value={activeContactoId}
              onValueChange={(value) => {
                if (value) {
                  setActiveContactoId(value);
                }
              }}
            >
              <TabsList className="h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-xl border border-sidebar-border/20 bg-sidebar/8 p-1">
                {contactos.map((contacto, index) => (
                  <TabsTrigger
                    key={contacto.id}
                    value={contacto.id}
                    className="flex-none rounded-lg px-3 py-1.5"
                  >
                    {contacto.nombre || `Contacto ${index + 1}`}
                    {contacto.principal ? (
                      <StarIcon className="fill-current text-primary" />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>

              {contactos.map((contacto, index) => (
                <TabsContent key={contacto.id} value={contacto.id}>
                  {activeContactoId === contacto.id ? (
                    <Card className="rounded-xl border-border/70 shadow-none">
                      <CardHeader className="gap-4 border-b border-border/70">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {contacto.nombre || `Contacto ${index + 1}`}
                            </CardTitle>
                            {contacto.principal ? (
                              <Badge variant="secondary">
                                <StarIcon
                                  data-icon="inline-start"
                                  className="fill-current text-primary"
                                />
                                Principal
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {!contacto.principal ? (
                              <Button
                                variant="sidebar"
                                size="sm"
                                onClick={() => setPrimaryContacto(contacto.id)}
                              >
                                Definir principal
                              </Button>
                            ) : null}
                            <Button
                              variant="sidebar"
                              size="sm"
                              onClick={() => removeContacto(contacto.id)}
                            >
                              <Trash2Icon data-icon="inline-start" />
                              Quitar
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <FieldGroup className="grid lg:grid-cols-2">
                          <Field
                            data-invalid={Boolean(
                              fieldErrors.contactos[contacto.id],
                            )}
                          >
                            <FieldLabel
                              htmlFor={`contacto-nombre-${contacto.id}`}
                            >
                              Nombre completo
                            </FieldLabel>
                            <Input
                              id={`contacto-nombre-${contacto.id}`}
                              value={contacto.nombre}
                              onChange={(event) =>
                                updateContacto(
                                  contacto.id,
                                  "nombre",
                                  event.target.value,
                                )
                              }
                              placeholder="Nombre y apellido"
                              aria-invalid={Boolean(
                                fieldErrors.contactos[contacto.id],
                              )}
                            />
                            <FieldError>
                              {fieldErrors.contactos[contacto.id]}
                            </FieldError>
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`contacto-cargo-${contacto.id}`}
                            >
                              Cargo o area
                            </FieldLabel>
                            <Input
                              id={`contacto-cargo-${contacto.id}`}
                              value={contacto.cargo}
                              onChange={(event) =>
                                updateContacto(
                                  contacto.id,
                                  "cargo",
                                  event.target.value,
                                )
                              }
                              placeholder="Compras, administracion, marketing..."
                            />
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`contacto-email-${contacto.id}`}
                            >
                              Correo electronico
                            </FieldLabel>
                            <Input
                              id={`contacto-email-${contacto.id}`}
                              type="email"
                              value={contacto.email}
                              onChange={(event) =>
                                updateContacto(
                                  contacto.id,
                                  "email",
                                  event.target.value,
                                )
                              }
                              placeholder="mail@empresa.com"
                            />
                          </Field>

                          <FieldGroup className="grid md:grid-cols-[180px_1fr]">
                            <Field>
                              <FieldLabel
                                htmlFor={`contacto-codigo-${contacto.id}`}
                              >
                                Codigo pais
                              </FieldLabel>
                              <Select
                                items={phoneCodeItems}
                                value={contacto.telefonoCodigo}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return;
                                  }

                                  updateContacto(
                                    contacto.id,
                                    "telefonoCodigo",
                                    value,
                                  );
                                }}
                              >
                                <SelectTrigger
                                  id={`contacto-codigo-${contacto.id}`}
                                  className="w-full"
                                >
                                  <SelectValue placeholder="Codigo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {phoneCodeItems.map((item) => (
                                      <SelectItem
                                        key={item.value}
                                        value={item.value}
                                      >
                                        {item.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>

                            <Field>
                              <FieldLabel
                                htmlFor={`contacto-telefono-${contacto.id}`}
                              >
                                Telefono
                              </FieldLabel>
                              <Input
                                id={`contacto-telefono-${contacto.id}`}
                                inputMode="tel"
                                value={contacto.telefonoNumero}
                                onChange={(event) =>
                                  updateContacto(
                                    contacto.id,
                                    "telefonoNumero",
                                    event.target.value,
                                  )
                                }
                                placeholder="Numero del contacto"
                              />
                              <FieldDescription>
                                WhatsApp:{" "}
                                {formatWhatsappPhone(
                                  contacto.telefonoCodigo,
                                  contacto.telefonoNumero,
                                ) || "Sin definir"}
                              </FieldDescription>
                            </Field>
                          </FieldGroup>
                        </FieldGroup>
                      </CardContent>
                    </Card>
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">
                  Direcciones
                </CardTitle>
                <CardDescription>
                  Registra multiples direcciones y marca una como principal para
                  uso operativo.
                </CardDescription>
              </div>
              <Button
                variant="brand"
                className="w-full sm:w-auto"
                onClick={addDireccion}
              >
                <PlusIcon data-icon="inline-start" />
                Agregar direccion
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Tabs
              value={activeDireccionId}
              onValueChange={(value) => {
                if (value) {
                  setActiveDireccionId(value);
                }
              }}
            >
              <TabsList className="h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-xl border border-sidebar-border/20 bg-sidebar/8 p-1">
                {direcciones.map((direccion, index) => (
                  <TabsTrigger
                    key={direccion.id}
                    value={direccion.id}
                    className="flex-none rounded-lg px-3 py-1.5"
                  >
                    {direccion.descripcion || `Direccion ${index + 1}`}
                    {direccion.principal ? (
                      <StarIcon className="fill-current text-primary" />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>

              {direcciones.map((direccion, index) => (
                <TabsContent key={direccion.id} value={direccion.id}>
                  {activeDireccionId === direccion.id ? (
                    <Card className="rounded-xl border-border/70 shadow-none">
                      <CardHeader className="gap-4 border-b border-border/70">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">
                              {direccion.descripcion ||
                                `Direccion ${index + 1}`}
                            </CardTitle>
                            {direccion.principal ? (
                              <Badge variant="secondary">
                                <StarIcon
                                  data-icon="inline-start"
                                  className="fill-current text-primary"
                                />
                                Principal
                              </Badge>
                            ) : null}
                            {direccion.tipo !== "principal" ? (
                              <Badge variant="outline">
                                <MapPinHouseIcon data-icon="inline-start" />
                                {
                                  addressTypeItems.find(
                                    (item) => item.value === direccion.tipo,
                                  )?.label
                                }
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {!direccion.principal ? (
                              <Button
                                variant="sidebar"
                                size="sm"
                                onClick={() =>
                                  setPrimaryDireccion(direccion.id)
                                }
                              >
                                Definir principal
                              </Button>
                            ) : null}
                            <Button
                              variant="sidebar"
                              size="sm"
                              onClick={() => removeDireccion(direccion.id)}
                            >
                              <Trash2Icon data-icon="inline-start" />
                              Quitar
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <FieldGroup className="grid lg:grid-cols-2">
                          <Field
                            data-invalid={Boolean(
                              fieldErrors.direcciones[direccion.id],
                            )}
                          >
                            <FieldLabel
                              htmlFor={`direccion-descripcion-${direccion.id}`}
                            >
                              Descripcion
                            </FieldLabel>
                            <Input
                              id={`direccion-descripcion-${direccion.id}`}
                              value={direccion.descripcion}
                              onChange={(event) =>
                                updateDireccion(
                                  direccion.id,
                                  "descripcion",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. Domicilio principal"
                              aria-invalid={Boolean(
                                fieldErrors.direcciones[direccion.id],
                              )}
                            />
                            <FieldError>
                              {fieldErrors.direcciones[direccion.id]}
                            </FieldError>
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`direccion-tipo-${direccion.id}`}
                            >
                              Tipo
                            </FieldLabel>
                            <Select
                              items={addressTypeItems}
                              value={direccion.tipo}
                              onValueChange={(value) => {
                                if (!value) {
                                  return;
                                }

                                updateDireccion(direccion.id, "tipo", value);
                              }}
                            >
                              <SelectTrigger
                                id={`direccion-tipo-${direccion.id}`}
                                className="w-full"
                              >
                                <SelectValue placeholder="Selecciona un tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {addressTypeItems.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`direccion-pais-${direccion.id}`}
                            >
                              Pais
                            </FieldLabel>
                            <Select
                              items={countryItems}
                              value={direccion.pais}
                              onValueChange={(value) => {
                                if (!value) {
                                  return;
                                }

                                updateDireccion(direccion.id, "pais", value);
                              }}
                            >
                              <SelectTrigger
                                id={`direccion-pais-${direccion.id}`}
                                className="w-full"
                              >
                                <SelectValue placeholder="Selecciona un pais" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {countryItems.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`direccion-cp-${direccion.id}`}
                            >
                              Codigo postal
                            </FieldLabel>
                            <Input
                              id={`direccion-cp-${direccion.id}`}
                              value={direccion.codigoPostal}
                              onChange={(event) =>
                                updateDireccion(
                                  direccion.id,
                                  "codigoPostal",
                                  event.target.value,
                                )
                              }
                              placeholder="Codigo postal"
                            />
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`direccion-calle-${direccion.id}`}
                            >
                              Direccion
                            </FieldLabel>
                            <Input
                              id={`direccion-calle-${direccion.id}`}
                              value={direccion.direccion}
                              onChange={(event) =>
                                updateDireccion(
                                  direccion.id,
                                  "direccion",
                                  event.target.value,
                                )
                              }
                              placeholder="Calle o avenida"
                            />
                          </Field>

                          <Field>
                            <FieldLabel
                              htmlFor={`direccion-numero-${direccion.id}`}
                            >
                              Numero
                            </FieldLabel>
                            <Input
                              id={`direccion-numero-${direccion.id}`}
                              value={direccion.numero}
                              onChange={(event) =>
                                updateDireccion(
                                  direccion.id,
                                  "numero",
                                  event.target.value,
                                )
                              }
                              placeholder="Numero o piso"
                            />
                          </Field>

                          <Field className="lg:col-span-2">
                            <FieldLabel
                              htmlFor={`direccion-ciudad-${direccion.id}`}
                            >
                              Ciudad
                            </FieldLabel>
                            <Input
                              id={`direccion-ciudad-${direccion.id}`}
                              value={direccion.ciudad}
                              onChange={(event) =>
                                updateDireccion(
                                  direccion.id,
                                  "ciudad",
                                  event.target.value,
                                )
                              }
                              placeholder="Ciudad"
                            />
                          </Field>
                        </FieldGroup>
                      </CardContent>
                    </Card>
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </fieldset>

      {mode !== "create" ? (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HistoryIcon />
              Actividad reciente
            </CardTitle>
            <CardDescription>
              Historial de altas, cambios y estados del proveedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proveedor.eventos.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {proveedor.eventos.map((evento) => (
                  <li
                    key={evento.id}
                    className="flex flex-col gap-1 border-b border-border/70 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {evento.tipo === "creado"
                          ? "Creado"
                          : evento.tipo === "editado"
                            ? "Editado"
                            : evento.tipo === "habilitado"
                              ? "Habilitado"
                              : "Inhabilitado"}
                      </Badge>
                      <span className="text-sm">{evento.actorNombre}</span>
                    </div>
                    <time className="text-sm text-muted-foreground">
                      {fechaHora(evento.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay actividad registrada.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
