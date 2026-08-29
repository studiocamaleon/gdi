"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  FolderIcon,
  HistoryIcon,
  MapPinHouseIcon,
  PlusIcon,
  ReceiptTextIcon,
  SaveIcon,
  StarIcon,
  Trash2Icon,
  UserRoundIcon,
  UserRoundPlusIcon,
} from "lucide-react";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { ClienteFidelizacionCard } from "@/components/crm/cliente-fidelizacion-card";
import { createCliente, updateCliente } from "@/lib/clientes-api";
import {
  CONDICIONES_FISCALES,
  CONDICION_FISCAL_LABELS,
  ClienteContacto,
  ClienteDetalle,
  ClienteDireccion,
  ClientePayload,
  CondicionFiscal,
  TipoDireccion,
  latamCountries,
  requiereCuit,
} from "@/lib/clientes";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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

type ClienteFichaProps = {
  cliente: ClienteDetalle;
  mode: "create" | "edit" | "view";
};

type DatosGeneralesState = {
  nombre: string;
  razonSocial: string;
  cuit: string;
  documentoNumero: string;
  condicionFiscal: CondicionFiscal;
  plazoCuentaCorrienteDias: string;
  limiteCredito: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  email: string;
  pais: string;
};

const condicionFiscalItems = CONDICIONES_FISCALES.map((value) => ({
  label: CONDICION_FISCAL_LABELS[value],
  value,
}));

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
  { label: "Facturación", value: "facturacion" },
  { label: "Entrega", value: "entrega" },
];

const whatsappConsentItems = [
  { label: "Sin definir", value: "sin_definir" },
  { label: "Sí, autoriza mensajes", value: "si" },
  { label: "No autoriza mensajes", value: "no" },
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

function buildPayload(
  datosGenerales: DatosGeneralesState,
  contactos: ClienteContacto[],
  direcciones: ClienteDireccion[],
  aceptaWhatsapp: boolean | null,
): ClientePayload {
  const plazoCuentaCorrienteDias =
    datosGenerales.plazoCuentaCorrienteDias.trim() === ""
      ? null
      : Number(datosGenerales.plazoCuentaCorrienteDias);
  return {
    nombre: datosGenerales.nombre.trim(),
    razonSocial: datosGenerales.razonSocial.trim() || undefined,
    cuit: datosGenerales.cuit.replace(/\D/g, "") || undefined,
    documentoNumero:
      datosGenerales.documentoNumero.replace(/\D/g, "") || undefined,
    condicionFiscal: datosGenerales.condicionFiscal,
    plazoCuentaCorrienteDias,
    limiteCredito:
      plazoCuentaCorrienteDias === null ||
      datosGenerales.limiteCredito.trim() === ""
        ? null
        : Number(datosGenerales.limiteCredito),
    email: datosGenerales.email.trim(),
    pais: datosGenerales.pais.trim(),
    telefonoCodigo: datosGenerales.telefonoCodigo.trim(),
    telefonoNumero: datosGenerales.telefonoNumero.trim(),
    aceptaWhatsapp,
    contactos: contactos.map((contacto) => ({
      id: contacto.id,
      nombre: contacto.nombre.trim(),
      cargo: contacto.cargo.trim() || undefined,
      email: contacto.email.trim() || undefined,
      telefonoCodigo: contacto.telefonoCodigo.trim() || undefined,
      telefonoNumero: contacto.telefonoNumero.trim() || undefined,
      principal: contacto.principal,
    })),
    direcciones: direcciones.map((direccion) => ({
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

type FieldErrors = Partial<
  Record<
    | "nombre"
    | "email"
    | "telefonoNumero"
    | "cuit"
    | "documentoNumero"
    | "plazoCuentaCorrienteDias"
    | "limiteCredito",
    string
  >
>;

function validatePayload(payload: ClientePayload) {
  const fields: FieldErrors = {};
  if (!payload.nombre) fields.nombre = "Ingresá el nombre del cliente.";
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    fields.email = "Ingresá un correo válido.";
  }
  if (payload.cuit && payload.cuit.replace(/\D/g, "").length !== 11) {
    fields.cuit = "El CUIT/CUIL debe tener 11 dígitos.";
  }
  if (payload.documentoNumero && !/^\d{7,9}$/.test(payload.documentoNumero)) {
    fields.documentoNumero = "El DNI debe tener entre 7 y 9 dígitos.";
  }
  if (
    payload.plazoCuentaCorrienteDias !== null &&
    payload.plazoCuentaCorrienteDias !== undefined &&
    (!Number.isInteger(payload.plazoCuentaCorrienteDias) ||
      payload.plazoCuentaCorrienteDias < 0 ||
      payload.plazoCuentaCorrienteDias > 365)
  ) {
    fields.plazoCuentaCorrienteDias = "Ingresá un plazo entre 0 y 365 días.";
  }
  if (
    payload.limiteCredito !== null &&
    payload.limiteCredito !== undefined &&
    !Number.isFinite(payload.limiteCredito)
  ) {
    fields.limiteCredito = "Ingresá un límite de crédito válido.";
  }

  const fieldMessage = Object.values(fields)[0];
  if (fieldMessage) return { message: fieldMessage, fields, focusId: null };

  const contactoInvalido = payload.contactos.findIndex(
    (contacto) => !contacto.nombre,
  );

  if (contactoInvalido !== -1) {
    return {
      message: `Completá el nombre del contacto ${contactoInvalido + 1}.`,
      fields,
      focusId: `contacto-nombre-${payload.contactos[contactoInvalido].id}`,
    };
  }

  const direccionInvalida = payload.direcciones.findIndex(
    (direccion) =>
      !direccion.descripcion ||
      !direccion.pais ||
      !direccion.direccion ||
      !direccion.ciudad,
  );

  if (direccionInvalida !== -1) {
    const direccion = payload.direcciones[direccionInvalida];
    const suffix = direccion.id;
    const missing = !direccion.descripcion
      ? "descripcion"
      : !direccion.pais
        ? "pais"
        : !direccion.direccion
          ? "calle"
          : "ciudad";
    return {
      message: `Completá descripción, país, dirección y ciudad en la dirección ${direccionInvalida + 1}.`,
      fields,
      focusId: `direccion-${missing}-${suffix}`,
    };
  }

  return { message: null, fields, focusId: null };
}

function createEmptyContacto(phoneCode: string): ClienteContacto {
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

function createEmptyDireccion(countryCode: string): ClienteDireccion {
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

export function ClienteFicha({ cliente, mode }: ClienteFichaProps) {
  const puedeAjustarPuntos = usePuede("crm.configurar_fidelizacion");
  const router = useRouter();
  const { fechaHora } = useFecha();
  const [isSaving, startSaving] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [aceptaWhatsapp, setAceptaWhatsapp] = React.useState<boolean | null>(
    cliente.aceptaWhatsapp,
  );
  const [version, setVersion] = React.useState(cliente.updatedAt);
  const [datosGenerales, setDatosGenerales] =
    React.useState<DatosGeneralesState>({
      nombre: cliente.nombre,
      razonSocial: cliente.razonSocial,
      cuit: cliente.cuit,
      documentoNumero: cliente.documentoNumero ?? "",
      condicionFiscal: cliente.condicionFiscal,
      plazoCuentaCorrienteDias:
        cliente.plazoCuentaCorrienteDias === null
          ? ""
          : String(cliente.plazoCuentaCorrienteDias),
      limiteCredito:
        cliente.limiteCredito === null ? "" : String(cliente.limiteCredito),
      telefonoCodigo: cliente.telefonoCodigo,
      telefonoNumero: cliente.telefonoNumero,
      email: cliente.email,
      pais: cliente.pais,
    });
  const [contactos, setContactos] = React.useState(cliente.contactos);
  const [direcciones, setDirecciones] = React.useState(cliente.direcciones);
  const [activeContactoId, setActiveContactoId] = React.useState(
    cliente.contactos[0]?.id ?? "",
  );
  const [activeDireccionId, setActiveDireccionId] = React.useState(
    cliente.direcciones[0]?.id ?? "",
  );
  const [activeSection, setActiveSection] = React.useState<
    "ficha" | "fidelizacion" | "historial"
  >("ficha");
  const readOnly = mode === "view";
  const snapshot = JSON.stringify({
    datosGenerales,
    contactos,
    direcciones,
    aceptaWhatsapp,
  });
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
    const removed = contactos.find((contacto) => contacto.id === contactoId);
    const removedIndex = contactos.findIndex(
      (contacto) => contacto.id === contactoId,
    );
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
    if (removed) {
      toast("Contacto quitado.", {
        action: {
          label: "Deshacer",
          onClick: () =>
            setContactos((current) => {
              const next = [...current];
              next.splice(removedIndex, 0, removed);
              return next;
            }),
        },
      });
    }
  };

  const updateContacto = (
    contactoId: string,
    field: keyof ClienteContacto,
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
    const removed = direcciones.find(
      (direccion) => direccion.id === direccionId,
    );
    const removedIndex = direcciones.findIndex(
      (direccion) => direccion.id === direccionId,
    );
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
    if (removed) {
      toast("Dirección quitada.", {
        action: {
          label: "Deshacer",
          onClick: () =>
            setDirecciones((current) => {
              const next = [...current];
              next.splice(removedIndex, 0, removed);
              return next;
            }),
        },
      });
    }
  };

  const updateDireccion = (
    direccionId: string,
    field: keyof ClienteDireccion,
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

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (readOnly) return;
    setErrorMessage(null);

    const payload = buildPayload(
      datosGenerales,
      contactos,
      direcciones,
      aceptaWhatsapp,
    );
    const validation = validatePayload(payload);
    setFieldErrors(validation.fields);

    if (validation.message) {
      setErrorMessage(validation.message);
      toast.error(validation.message);
      // Los campos editables viven en la primera pestaña. Si se intenta
      // guardar desde Fidelización o Historial, volvemos a la ficha antes de
      // enfocar el dato inválido.
      setActiveSection("ficha");
      const firstField = Object.keys(validation.fields)[0] as
        keyof FieldErrors | undefined;
      const fieldIds: Record<keyof FieldErrors, string> = {
        nombre: "cliente-nombre",
        email: "cliente-email",
        telefonoNumero: "telefono-numero",
        cuit: "cliente-cuit",
        documentoNumero: "cliente-documento",
        plazoCuentaCorrienteDias: "cliente-condicion-pago",
        limiteCredito: "cliente-limite-credito",
      };
      if (validation.focusId) {
        const contacto = contactos.find((item) =>
          validation.focusId?.endsWith(item.id),
        );
        const direccion = direcciones.find((item) =>
          validation.focusId?.endsWith(item.id),
        );
        if (contacto) setActiveContactoId(contacto.id);
        if (direccion) setActiveDireccionId(direccion.id);
      }
      const targetId = firstField ? fieldIds[firstField] : validation.focusId;
      if (targetId) {
        window.setTimeout(() => document.getElementById(targetId)?.focus());
      }
      return;
    }

    startSaving(async () => {
      try {
        const savedCliente =
          mode === "create"
            ? await createCliente(payload)
            : await updateCliente(cliente.id, payload, version);

        setSavedSnapshot(snapshot);
        setVersion(savedCliente.updatedAt);
        setFieldErrors({});

        if (mode === "create") {
          toast.success("Cliente creado correctamente.");
          router.push(`/crm/clientes/${savedCliente.id}`);
          router.refresh();
          return;
        }

        toast.success("Cambios guardados.");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo guardar el cliente.";

        setErrorMessage(message);
        toast.error(message);
      }
    });
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6 [&>*]:shrink-0"
      onSubmit={handleSave}
      noValidate
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <Link
            href="/crm/clientes"
            onNavigate={confirmNavigation}
            className={buttonVariants({
              variant: "sidebar",
              size: "sm",
              className: "w-fit",
            })}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a clientes
          </Link>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {mode === "create" ? "Nuevo cliente" : "Ficha de cliente"}
              </h1>
              {!cliente.activo && mode !== "create" ? (
                <Badge variant="outline">Inhabilitado</Badge>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Consolidá los datos principales del cliente, sus contactos y sus
              direcciones operativas en una sola vista de trabajo.
            </p>
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>No pudimos guardar</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode !== "create" ? (
            <Link
              href={`/comercial/campanas?clienteId=${cliente.id}`}
              onNavigate={confirmNavigation}
              className={buttonVariants({ variant: "outline" })}
            >
              <FolderIcon data-icon="inline-start" />
              Campañas
            </Link>
          ) : null}
          {mode !== "create" ? (
            <Link
              href={`/crm/clientes/${cliente.id}/cuenta-corriente`}
              onNavigate={confirmNavigation}
              className={buttonVariants({ variant: "outline" })}
            >
              <ReceiptTextIcon data-icon="inline-start" />
              Cuenta corriente
            </Link>
          ) : null}
          {!readOnly ? (
            <Button
              variant="brand"
              type="submit"
              disabled={isSaving || !isDirty}
            >
              {isSaving ? (
                <GdiSpinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              {mode === "create" ? "Crear cliente" : "Guardar cambios"}
            </Button>
          ) : null}
        </div>
      </div>

      {!cliente.activo && mode !== "create" ? (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Cliente inhabilitado</AlertTitle>
          <AlertDescription>
            Conserva su historial, pero no puede seleccionarse en nuevas
            operaciones comerciales.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        value={mode === "create" ? "ficha" : activeSection}
        onValueChange={(value) => {
          if (
            value === "ficha" ||
            value === "fidelizacion" ||
            value === "historial"
          ) {
            setActiveSection(value);
          }
        }}
        className="flex min-h-0 flex-col gap-6"
      >
        {mode !== "create" ? (
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="ficha" className="flex-none px-4">
              <UserRoundIcon />
              Ficha de cliente
            </TabsTrigger>
            <TabsTrigger value="fidelizacion" className="flex-none px-4">
              <StarIcon />
              Fidelización
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex-none px-4">
              <HistoryIcon />
              Historial
            </TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="ficha" keepMounted className="m-0">
          <fieldset
            disabled={readOnly}
            className="flex flex-col gap-6 [&>*]:shrink-0"
          >
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold tracking-tight">
                  Datos generales
                </CardTitle>
                <CardDescription>
                  Definí la información base del cliente y el teléfono principal
                  en formato compatible con WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid lg:grid-cols-2">
                  <Field data-invalid={Boolean(fieldErrors.nombre)}>
                    <FieldLabel htmlFor="cliente-nombre">
                      Nombre del cliente
                    </FieldLabel>
                    <Input
                      id="cliente-nombre"
                      aria-invalid={Boolean(fieldErrors.nombre)}
                      value={datosGenerales.nombre}
                      onChange={(event) =>
                        setDatosGenerales((current) => ({
                          ...current,
                          nombre: event.target.value,
                        }))
                      }
                      placeholder="Ej. Cafe del Centro"
                    />
                    {fieldErrors.nombre ? (
                      <FieldDescription>{fieldErrors.nombre}</FieldDescription>
                    ) : null}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cliente-razon-social">
                      Razón social
                    </FieldLabel>
                    <Input
                      id="cliente-razon-social"
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

                  <Field>
                    <FieldLabel htmlFor="cliente-condicion-fiscal">
                      Condición fiscal
                    </FieldLabel>
                    <Select
                      items={condicionFiscalItems}
                      value={datosGenerales.condicionFiscal}
                      onValueChange={(value) => {
                        if (!value) {
                          return;
                        }

                        setDatosGenerales((current) => ({
                          ...current,
                          condicionFiscal: value as CondicionFiscal,
                        }));
                      }}
                    >
                      <SelectTrigger
                        id="cliente-condicion-fiscal"
                        className="w-full"
                      >
                        <SelectValue placeholder="Seleccioná la condición" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {condicionFiscalItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Define la letra del comprobante al facturarle.
                    </FieldDescription>
                  </Field>

                  <Field data-invalid={Boolean(fieldErrors.cuit)}>
                    <FieldLabel htmlFor="cliente-cuit">
                      CUIT{" "}
                      {requiereCuit(datosGenerales.condicionFiscal)
                        ? ""
                        : "(opcional)"}
                    </FieldLabel>
                    <Input
                      id="cliente-cuit"
                      aria-invalid={Boolean(fieldErrors.cuit)}
                      inputMode="numeric"
                      value={datosGenerales.cuit}
                      onChange={(event) =>
                        setDatosGenerales((current) => ({
                          ...current,
                          cuit: event.target.value,
                        }))
                      }
                      placeholder="30-71234567-8"
                    />
                    <FieldDescription>
                      {fieldErrors.cuit ??
                        (requiereCuit(datosGenerales.condicionFiscal)
                          ? "Un Responsable Inscripto necesita CUIT para recibir Factura A."
                          : "Con o sin guiones. Se valida el dígito verificador.")}
                    </FieldDescription>
                  </Field>

                  {/* El DNI va aparte del CUIT y no es lo mismo: ARCA los declara
                con tipos distintos (96 vs 80). Lo llena solo el alta por
                escaneo del documento en el mostrador. */}
                  <Field data-invalid={Boolean(fieldErrors.documentoNumero)}>
                    <FieldLabel htmlFor="cliente-documento">
                      DNI (opcional)
                    </FieldLabel>
                    <Input
                      id="cliente-documento"
                      aria-invalid={Boolean(fieldErrors.documentoNumero)}
                      inputMode="numeric"
                      value={datosGenerales.documentoNumero}
                      onChange={(event) =>
                        setDatosGenerales((current) => ({
                          ...current,
                          documentoNumero: event.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        }))
                      }
                      placeholder="12345678"
                    />
                    <FieldDescription>
                      {fieldErrors.documentoNumero ??
                        "Sirve para identificar al cliente en la factura sin CUIT."}
                    </FieldDescription>
                  </Field>

                  <Field
                    data-invalid={Boolean(fieldErrors.plazoCuentaCorrienteDias)}
                  >
                    <FieldLabel htmlFor="cliente-condicion-pago">
                      Plazo de cuenta corriente (días)
                    </FieldLabel>
                    <Input
                      id="cliente-condicion-pago"
                      inputMode="numeric"
                      aria-invalid={Boolean(
                        fieldErrors.plazoCuentaCorrienteDias,
                      )}
                      value={datosGenerales.plazoCuentaCorrienteDias}
                      onChange={(event) =>
                        setDatosGenerales((current) => ({
                          ...current,
                          plazoCuentaCorrienteDias: event.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        }))
                      }
                      placeholder="Venta común"
                    />
                    <FieldDescription>
                      {fieldErrors.plazoCuentaCorrienteDias ??
                        "Vacío = vence al finalizar la orden. Ej. 30 = cuenta corriente a 30 días."}
                    </FieldDescription>
                  </Field>

                  <Field
                    data-disabled={
                      datosGenerales.plazoCuentaCorrienteDias.trim() === ""
                    }
                    data-invalid={Boolean(fieldErrors.limiteCredito)}
                  >
                    <FieldLabel htmlFor="cliente-limite-credito">
                      Límite de crédito (opcional)
                    </FieldLabel>
                    <Input
                      id="cliente-limite-credito"
                      disabled={
                        datosGenerales.plazoCuentaCorrienteDias.trim() === ""
                      }
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.limiteCredito)}
                      value={datosGenerales.limiteCredito}
                      onChange={(event) =>
                        setDatosGenerales((current) => ({
                          ...current,
                          limiteCredito: event.target.value.replace(",", "."),
                        }))
                      }
                      placeholder="Sin límite"
                    />
                    <FieldDescription>
                      {fieldErrors.limiteCredito ??
                        (datosGenerales.plazoCuentaCorrienteDias.trim() === ""
                          ? "Se habilita al configurar un plazo de cuenta corriente."
                          : "Tope de deuda. Vacío = cuenta corriente sin límite.")}
                    </FieldDescription>
                  </Field>

                  <Field data-invalid={Boolean(fieldErrors.email)}>
                    <FieldLabel htmlFor="cliente-email">
                      Correo electrónico principal (opcional)
                    </FieldLabel>
                    <Input
                      id="cliente-email"
                      type="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      value={datosGenerales.email}
                      onChange={(event) =>
                        setDatosGenerales((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="contacto@empresa.com"
                    />
                    {fieldErrors.email ? (
                      <FieldDescription>{fieldErrors.email}</FieldDescription>
                    ) : null}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cliente-pais">País</FieldLabel>
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
                      <SelectTrigger id="cliente-pais" className="w-full">
                        <SelectValue placeholder="Seleccioná un país" />
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
                    <Field>
                      <FieldLabel htmlFor="telefono-codigo">
                        Código de país
                      </FieldLabel>
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
                        <SelectTrigger id="telefono-codigo" className="w-full">
                          <SelectValue placeholder="Código" />
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

                    <Field data-invalid={Boolean(fieldErrors.telefonoNumero)}>
                      <FieldLabel htmlFor="telefono-numero">
                        Teléfono principal (opcional)
                      </FieldLabel>
                      <Input
                        id="telefono-numero"
                        inputMode="tel"
                        aria-invalid={Boolean(fieldErrors.telefonoNumero)}
                        value={datosGenerales.telefonoNumero}
                        onChange={(event) =>
                          setDatosGenerales((current) => ({
                            ...current,
                            telefonoNumero: event.target.value,
                          }))
                        }
                        placeholder="Número sin código de país"
                      />
                      <FieldDescription>
                        {fieldErrors.telefonoNumero ??
                          `Se guardará como: ${telefonoWhatsapp || "Sin definir"}`}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <Field className="lg:col-span-2">
                    <FieldLabel htmlFor="cliente-whatsapp-consentimiento">
                      Consentimiento para WhatsApp
                    </FieldLabel>
                    <Select
                      items={whatsappConsentItems}
                      value={
                        aceptaWhatsapp === null
                          ? "sin_definir"
                          : aceptaWhatsapp
                            ? "si"
                            : "no"
                      }
                      onValueChange={(value) =>
                        setAceptaWhatsapp(
                          value === "sin_definir" ? null : value === "si",
                        )
                      }
                    >
                      <SelectTrigger
                        id="cliente-whatsapp-consentimiento"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {whatsappConsentItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Sin consentimiento explícito solo se permiten avisos
                      transaccionales; si dice que no, no se envía ningún
                      mensaje.
                    </FieldDescription>
                  </Field>
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
                      Podés registrar uno o más contactos y definir cuál será el
                      principal para la relación comercial.
                    </CardDescription>
                  </div>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="brand"
                      className="w-full sm:w-auto"
                      onClick={addContacto}
                    >
                      <UserRoundPlusIcon data-icon="inline-start" />
                      Agregar contacto
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {contactos.length === 0 ? (
                  <Empty className="min-h-48">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UserRoundPlusIcon />
                      </EmptyMedia>
                      <EmptyTitle>Sin contactos adicionales</EmptyTitle>
                      <EmptyDescription>
                        El teléfono y el correo principal pueden cargarse
                        arriba. Agregá un contacto solo si necesitás identificar
                        a una persona específica.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
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
                                      type="button"
                                      variant="sidebar"
                                      size="sm"
                                      onClick={() =>
                                        setPrimaryContacto(contacto.id)
                                      }
                                    >
                                      Definir principal
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="destructive"
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
                                <Field>
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
                                  />
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
                                    Correo electrónico
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
                                      Código de país
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
                                        <SelectValue placeholder="Código" />
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
                                      Teléfono
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
                                      placeholder="Número del contacto"
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
                )}
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
                      Registrá múltiples direcciones y marcá una como principal
                      para uso operativo.
                    </CardDescription>
                  </div>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="brand"
                      className="w-full sm:w-auto"
                      onClick={addDireccion}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Agregar dirección
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {direcciones.length === 0 ? (
                  <Empty className="min-h-48">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MapPinHouseIcon />
                      </EmptyMedia>
                      <EmptyTitle>Sin direcciones cargadas</EmptyTitle>
                      <EmptyDescription>
                        Podés guardar el cliente sin dirección y completarla
                        cuando la necesites para facturación o entrega.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
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
                          {direccion.descripcion || `Dirección ${index + 1}`}
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
                                      `Dirección ${index + 1}`}
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
                                  <Badge variant="outline">
                                    <MapPinHouseIcon data-icon="inline-start" />
                                    {
                                      addressTypeItems.find(
                                        (item) => item.value === direccion.tipo,
                                      )?.label
                                    }
                                  </Badge>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  {!direccion.principal ? (
                                    <Button
                                      type="button"
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
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      removeDireccion(direccion.id)
                                    }
                                  >
                                    <Trash2Icon data-icon="inline-start" />
                                    Quitar
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <FieldGroup className="grid lg:grid-cols-2">
                                <Field>
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
                                  />
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

                                      updateDireccion(
                                        direccion.id,
                                        "tipo",
                                        value,
                                      );
                                    }}
                                  >
                                    <SelectTrigger
                                      id={`direccion-tipo-${direccion.id}`}
                                      className="w-full"
                                    >
                                      <SelectValue placeholder="Seleccioná un tipo" />
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
                                    País
                                  </FieldLabel>
                                  <Select
                                    items={countryItems}
                                    value={direccion.pais}
                                    onValueChange={(value) => {
                                      if (!value) {
                                        return;
                                      }

                                      updateDireccion(
                                        direccion.id,
                                        "pais",
                                        value,
                                      );
                                    }}
                                  >
                                    <SelectTrigger
                                      id={`direccion-pais-${direccion.id}`}
                                      className="w-full"
                                    >
                                      <SelectValue placeholder="Seleccioná un país" />
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
                                    Código postal
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
                                    placeholder="Código postal"
                                  />
                                </Field>

                                <Field>
                                  <FieldLabel
                                    htmlFor={`direccion-calle-${direccion.id}`}
                                  >
                                    Dirección
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
                                    Número
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
                                    placeholder="Número o piso"
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
                )}
              </CardContent>
            </Card>
          </fieldset>
        </TabsContent>

        {mode !== "create" ? (
          <TabsContent value="fidelizacion" className="m-0">
            <ClienteFidelizacionCard
              clienteId={cliente.id}
              puedeAjustar={puedeAjustarPuntos}
            />
          </TabsContent>
        ) : null}

        {mode !== "create" ? (
          <TabsContent value="historial" className="m-0">
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold tracking-tight">
                  Actividad de la ficha
                </CardTitle>
                <CardDescription>
                  Últimos cambios registrados con fecha y responsable.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cliente.eventos.length === 0 ? (
                  <Empty className="min-h-32">
                    <EmptyHeader>
                      <EmptyTitle>Sin actividad registrada</EmptyTitle>
                      <EmptyDescription>
                        Los próximos cambios quedarán visibles en esta sección.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {cliente.eventos.map((evento) => (
                      <li
                        key={evento.id}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span>
                          <strong className="font-medium capitalize">
                            {evento.tipo}
                          </strong>
                          {" por "}
                          {evento.actorNombre}
                        </span>
                        <time
                          dateTime={evento.createdAt}
                          className="text-sm text-muted-foreground"
                        >
                          {fechaHora(evento.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </form>
  );
}
