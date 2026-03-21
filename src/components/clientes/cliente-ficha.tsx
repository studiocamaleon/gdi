"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  MapPinHouseIcon,
  PlusIcon,
  SaveIcon,
  StarIcon,
  Trash2Icon,
  UserRoundPlusIcon,
} from "lucide-react";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { createCliente, updateCliente } from "@/lib/clientes-api";
import {
  ClienteContacto,
  ClienteDetalle,
  ClienteDireccion,
  ClientePayload,
  TipoDireccion,
  latamCountries,
} from "@/lib/clientes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

type ClienteFichaProps = {
  cliente: ClienteDetalle;
  mode: "create" | "edit";
};

type DatosGeneralesState = {
  nombre: string;
  razonSocial: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  email: string;
  pais: string;
};

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

function buildPayload(
  datosGenerales: DatosGeneralesState,
  contactos: ClienteContacto[],
  direcciones: ClienteDireccion[],
): ClientePayload {
  return {
    nombre: datosGenerales.nombre.trim(),
    razonSocial: datosGenerales.razonSocial.trim() || undefined,
    email: datosGenerales.email.trim(),
    pais: datosGenerales.pais.trim(),
    telefonoCodigo: datosGenerales.telefonoCodigo.trim(),
    telefonoNumero: datosGenerales.telefonoNumero.trim(),
    contactos: contactos.map((contacto) => ({
      nombre: contacto.nombre.trim(),
      cargo: contacto.cargo.trim() || undefined,
      email: contacto.email.trim() || undefined,
      telefonoCodigo: contacto.telefonoCodigo.trim() || undefined,
      telefonoNumero: contacto.telefonoNumero.trim() || undefined,
      principal: contacto.principal,
    })),
    direcciones: direcciones.map((direccion) => ({
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

function validatePayload(payload: ClientePayload) {
  if (!payload.nombre || !payload.email || !payload.telefonoNumero) {
    return "Completa al menos nombre, correo principal y telefono principal.";
  }

  const contactoInvalido = payload.contactos.findIndex(
    (contacto) => !contacto.nombre,
  );

  if (contactoInvalido !== -1) {
    return `Completa el nombre del contacto ${contactoInvalido + 1}.`;
  }

  const direccionInvalida = payload.direcciones.findIndex(
    (direccion) =>
      !direccion.descripcion ||
      !direccion.pais ||
      !direccion.direccion ||
      !direccion.ciudad,
  );

  if (direccionInvalida !== -1) {
    return `Completa descripcion, pais, direccion y ciudad en la direccion ${direccionInvalida + 1}.`;
  }

  return null;
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
  const router = useRouter();
  const [isSaving, startSaving] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [datosGenerales, setDatosGenerales] = React.useState<DatosGeneralesState>({
    nombre: cliente.nombre,
    razonSocial: cliente.razonSocial,
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
      const nextContactos = current.filter((contacto) => contacto.id !== contactoId);

      if (nextContactos.length > 0 && !nextContactos.some((contacto) => contacto.principal)) {
        nextContactos[0] = { ...nextContactos[0], principal: true };
      }

      return nextContactos;
    });
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

  const handleSave = () => {
    setErrorMessage(null);

    const payload = buildPayload(datosGenerales, contactos, direcciones);
    const validationError = validatePayload(payload);

    if (validationError) {
      setErrorMessage(validationError);
      toast.error(validationError);
      return;
    }

    startSaving(async () => {
      try {
        const savedCliente =
          mode === "create"
            ? await createCliente(payload)
            : await updateCliente(cliente.id, payload);

        if (mode === "create") {
          toast.success("Cliente creado correctamente.");
          router.push(`/clientes/${savedCliente.id}`);
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
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <Button
            variant="sidebar"
            nativeButton={false}
            size="sm"
            className="w-fit"
            render={<Link href="/clientes" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a clientes
          </Button>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {mode === "create" ? "Nuevo cliente" : "Ficha de cliente"}
              </h1>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Consolida los datos principales del cliente, sus contactos y sus
              direcciones operativas en una sola vista de trabajo.
            </p>
            {errorMessage ? (
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="brand" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            {mode === "create" ? "Crear cliente" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-tight">
            Datos generales
          </CardTitle>
          <CardDescription>
            Define la informacion base del cliente y el telefono principal en
            formato compatible con WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid lg:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cliente-nombre">Nombre del cliente</FieldLabel>
              <Input
                id="cliente-nombre"
                value={datosGenerales.nombre}
                onChange={(event) =>
                  setDatosGenerales((current) => ({
                    ...current,
                    nombre: event.target.value,
                  }))
                }
                placeholder="Ej. Cafe del Centro"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="cliente-razon-social">
                Razon social
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
              <FieldLabel htmlFor="cliente-email">
                Correo electronico principal
              </FieldLabel>
              <Input
                id="cliente-email"
                type="email"
                value={datosGenerales.email}
                onChange={(event) =>
                  setDatosGenerales((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="contacto@empresa.com"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="cliente-pais">Pais</FieldLabel>
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
              <Field>
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
                  <SelectTrigger id="telefono-codigo" className="w-full">
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

              <Field>
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
                />
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
            <Button variant="brand" className="w-full sm:w-auto" onClick={addContacto}>
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
                      <Field>
                        <FieldLabel htmlFor={`contacto-nombre-${contacto.id}`}>
                          Nombre completo
                        </FieldLabel>
                        <Input
                          id={`contacto-nombre-${contacto.id}`}
                          value={contacto.nombre}
                          onChange={(event) =>
                            updateContacto(contacto.id, "nombre", event.target.value)
                          }
                          placeholder="Nombre y apellido"
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`contacto-cargo-${contacto.id}`}>
                          Cargo o area
                        </FieldLabel>
                        <Input
                          id={`contacto-cargo-${contacto.id}`}
                          value={contacto.cargo}
                          onChange={(event) =>
                            updateContacto(contacto.id, "cargo", event.target.value)
                          }
                          placeholder="Compras, administracion, marketing..."
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`contacto-email-${contacto.id}`}>
                          Correo electronico
                        </FieldLabel>
                        <Input
                          id={`contacto-email-${contacto.id}`}
                          type="email"
                          value={contacto.email}
                          onChange={(event) =>
                            updateContacto(contacto.id, "email", event.target.value)
                          }
                          placeholder="mail@empresa.com"
                        />
                      </Field>

                      <FieldGroup className="grid md:grid-cols-[180px_1fr]">
                        <Field>
                          <FieldLabel htmlFor={`contacto-codigo-${contacto.id}`}>
                            Codigo pais
                          </FieldLabel>
                          <Select
                            items={phoneCodeItems}
                            value={contacto.telefonoCodigo}
                            onValueChange={(value) => {
                              if (!value) {
                                return;
                              }

                              updateContacto(contacto.id, "telefonoCodigo", value);
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
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field>
                          <FieldLabel htmlFor={`contacto-telefono-${contacto.id}`}>
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
            <Button variant="brand" className="w-full sm:w-auto" onClick={addDireccion}>
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
                <Card className="rounded-xl border-border/70 shadow-none">
                  <CardHeader className="gap-4 border-b border-border/70">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {direccion.descripcion || `Direccion ${index + 1}`}
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
                            addressTypeItems.find((item) => item.value === direccion.tipo)
                              ?.label
                          }
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {!direccion.principal ? (
                          <Button
                            variant="sidebar"
                            size="sm"
                            onClick={() => setPrimaryDireccion(direccion.id)}
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
                      <Field>
                        <FieldLabel htmlFor={`direccion-descripcion-${direccion.id}`}>
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
                        <FieldLabel htmlFor={`direccion-tipo-${direccion.id}`}>
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
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`direccion-pais-${direccion.id}`}>
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
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`direccion-cp-${direccion.id}`}>
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
                        <FieldLabel htmlFor={`direccion-calle-${direccion.id}`}>
                          Direccion
                        </FieldLabel>
                        <Input
                          id={`direccion-calle-${direccion.id}`}
                          value={direccion.direccion}
                          onChange={(event) =>
                            updateDireccion(direccion.id, "direccion", event.target.value)
                          }
                          placeholder="Calle o avenida"
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`direccion-numero-${direccion.id}`}>
                          Numero
                        </FieldLabel>
                        <Input
                          id={`direccion-numero-${direccion.id}`}
                          value={direccion.numero}
                          onChange={(event) =>
                            updateDireccion(direccion.id, "numero", event.target.value)
                          }
                          placeholder="Numero o piso"
                        />
                      </Field>

                      <Field className="lg:col-span-2">
                        <FieldLabel htmlFor={`direccion-ciudad-${direccion.id}`}>
                          Ciudad
                        </FieldLabel>
                        <Input
                          id={`direccion-ciudad-${direccion.id}`}
                          value={direccion.ciudad}
                          onChange={(event) =>
                            updateDireccion(direccion.id, "ciudad", event.target.value)
                          }
                          placeholder="Ciudad"
                        />
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
