"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  MapPinHouseIcon,
  PercentIcon,
  PlusIcon,
  SaveIcon,
  ShieldCheckIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { NavLink } from "@/components/navigation/nav-link";
import {
  createEmpleado,
  inviteEmpleadoAccess,
  updateEmpleado,
} from "@/lib/empleados-api";
import {
  comisionTypeItems,
  createEmptyComision,
  createEmptyDireccion,
  EmpleadoComision,
  EmpleadoDetalle,
  EmpleadoDireccion,
  EmpleadoPayload,
  rolItems,
  RolSistema,
  sexoItems,
  SexoEmpleado,
  TipoComision,
  TipoDireccion,
  latamCountries,
} from "@/lib/empleados";
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
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type EmpleadoFichaProps = {
  empleado: EmpleadoDetalle;
  mode: "create" | "edit";
};

type DatosPrincipalesState = {
  nombreCompleto: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  email: string;
  sector: string;
  usuarioSistema: boolean;
};

type InformacionGeneralState = {
  ocupacion: string;
  sexo: SexoEmpleado | "";
  fechaIngreso: string;
  fechaNacimiento: string;
};

type UsuarioSistemaState = {
  emailAcceso: string;
  rolSistema: RolSistema | "";
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
  datosPrincipales: DatosPrincipalesState,
  informacionGeneral: InformacionGeneralState,
  usuarioSistema: UsuarioSistemaState,
  direcciones: EmpleadoDireccion[],
  comisionesHabilitadas: boolean,
  comisiones: EmpleadoComision[],
): EmpleadoPayload {
  return {
    nombreCompleto: datosPrincipales.nombreCompleto.trim(),
    email: datosPrincipales.email.trim(),
    telefonoCodigo: datosPrincipales.telefonoCodigo.trim(),
    telefonoNumero: datosPrincipales.telefonoNumero.trim(),
    sector: datosPrincipales.sector.trim(),
    ocupacion: informacionGeneral.ocupacion.trim() || undefined,
    sexo: informacionGeneral.sexo || undefined,
    fechaIngreso: informacionGeneral.fechaIngreso,
    fechaNacimiento: informacionGeneral.fechaNacimiento || undefined,
    usuarioSistema: datosPrincipales.usuarioSistema,
    emailAcceso: usuarioSistema.emailAcceso.trim() || undefined,
    rolSistema: usuarioSistema.rolSistema || undefined,
    comisionesHabilitadas,
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
    comisiones: comisiones.map((comision) => ({
      descripcion: comision.descripcion.trim(),
      tipo: comision.tipo,
      valor: comision.valor.trim(),
    })),
  };
}

function validatePayload(payload: EmpleadoPayload) {
  if (
    !payload.nombreCompleto ||
    !payload.email ||
    !payload.telefonoNumero ||
    !payload.sector ||
    !payload.fechaIngreso
  ) {
    return "Completa nombre, correo principal, telefono principal, sector y fecha de ingreso.";
  }

  if (payload.usuarioSistema && (!payload.emailAcceso || !payload.rolSistema)) {
    return "Completa el email de acceso y el rol del usuario del sistema.";
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

  if (payload.comisionesHabilitadas) {
    const comisionInvalida = payload.comisiones.findIndex(
      (comision) => !comision.descripcion || !comision.valor,
    );

    if (comisionInvalida !== -1) {
      return `Completa la descripcion y el valor de la comision ${comisionInvalida + 1}.`;
    }
  }

  return null;
}

export function EmpleadoFicha({ empleado, mode }: EmpleadoFichaProps) {
  const router = useRouter();
  const [isSaving, startSaving] = React.useTransition();
  const [isInviting, startInviting] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [datosPrincipales, setDatosPrincipales] =
    React.useState<DatosPrincipalesState>({
      nombreCompleto: empleado.nombreCompleto,
      telefonoCodigo: empleado.telefonoCodigo,
      telefonoNumero: empleado.telefonoNumero,
      email: empleado.email,
      sector: empleado.sector,
      usuarioSistema: empleado.usuarioSistema,
    });
  const [informacionGeneral, setInformacionGeneral] =
    React.useState<InformacionGeneralState>({
      ocupacion: empleado.ocupacion,
      sexo: empleado.sexo,
      fechaIngreso: empleado.fechaIngreso,
      fechaNacimiento: empleado.fechaNacimiento,
    });
  const [usuarioSistema, setUsuarioSistema] = React.useState<UsuarioSistemaState>({
    emailAcceso: empleado.emailAcceso,
    rolSistema: empleado.rolSistema,
  });
  const [direcciones, setDirecciones] = React.useState(empleado.direcciones);
  const [activeDireccionId, setActiveDireccionId] = React.useState(
    empleado.direcciones[0]?.id ?? "",
  );
  const [comisionesHabilitadas, setComisionesHabilitadas] = React.useState(
    empleado.comisionesHabilitadas,
  );
  const [comisiones, setComisiones] = React.useState(empleado.comisiones);

  const telefonoWhatsapp = formatWhatsappPhone(
    datosPrincipales.telefonoCodigo,
    datosPrincipales.telefonoNumero,
  );

  React.useEffect(() => {
    if (direcciones.length === 0) {
      setActiveDireccionId("");
      return;
    }

    if (!direcciones.some((direccion) => direccion.id === activeDireccionId)) {
      setActiveDireccionId(direcciones[0].id);
    }
  }, [activeDireccionId, direcciones]);

  const addDireccion = () => {
    const newDireccion = createEmptyDireccion();
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
    field: keyof EmpleadoDireccion,
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

  const addComision = () => {
    setComisiones((current) => [...current, createEmptyComision()]);
  };

  const removeComision = (comisionId: string) => {
    setComisiones((current) =>
      current.filter((comision) => comision.id !== comisionId),
    );
  };

  const updateComision = (
    comisionId: string,
    field: keyof EmpleadoComision,
    value: string | TipoComision,
  ) => {
    setComisiones((current) =>
      current.map((comision) =>
        comision.id === comisionId ? { ...comision, [field]: value } : comision,
      ),
    );
  };

  const handleToggleUsuarioSistema = (checked: boolean) => {
    setDatosPrincipales((current) => ({ ...current, usuarioSistema: checked }));

    if (!checked) {
      setUsuarioSistema({
        emailAcceso: "",
        rolSistema: "",
      });
    } else if (!usuarioSistema.emailAcceso) {
      setUsuarioSistema({
        emailAcceso: datosPrincipales.email,
        rolSistema: "",
      });
    }
  };

  const handleToggleComisiones = (checked: boolean) => {
    setComisionesHabilitadas(checked);

    if (checked && comisiones.length === 0) {
      setComisiones([createEmptyComision()]);
    }

    if (!checked) {
      setComisiones([]);
    }
  };

  const handleInviteAccess = () => {
    if (mode !== "edit" || !empleado.id) {
      return;
    }

    if (!datosPrincipales.usuarioSistema || !usuarioSistema.emailAcceso || !usuarioSistema.rolSistema) {
      setErrorMessage("Completa el email de acceso y el rol antes de enviar la invitacion.");
      return;
    }

    const rolSistema = usuarioSistema.rolSistema;

    startInviting(async () => {
      try {
        const response = await inviteEmpleadoAccess(empleado.id, {
          email: usuarioSistema.emailAcceso.trim(),
          rolSistema,
        });

        if (response.invitationUrl && navigator.clipboard) {
          await navigator.clipboard.writeText(response.invitationUrl);
          toast.success("Invitacion generada. El enlace quedo copiado al portapapeles.");
        } else {
          toast.success("Invitacion generada.");
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo generar la invitacion de acceso.",
        );
      }
    });
  };

  const handleSave = () => {
    setErrorMessage(null);

    const payload = buildPayload(
      datosPrincipales,
      informacionGeneral,
      usuarioSistema,
      direcciones,
      comisionesHabilitadas,
      comisiones,
    );
    const validationError = validatePayload(payload);

    if (validationError) {
      setErrorMessage(validationError);
      toast.error(validationError);
      return;
    }

    startSaving(async () => {
      try {
        const savedEmpleado =
          mode === "create"
            ? await createEmpleado(payload)
            : await updateEmpleado(empleado.id, payload);

        if (mode === "create") {
          toast.success("Empleado creado correctamente.");
          router.push(`/empleados/${savedEmpleado.id}`);
          router.refresh();
          return;
        }

        toast.success("Cambios guardados.");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo guardar el empleado.";

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
            render={<NavLink href="/empleados" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a empleados
          </Button>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "create" ? "Nuevo empleado" : "Ficha de empleado"}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Consolida datos personales, acceso al sistema, direccion y
              esquema de comisiones dentro de una sola ficha operativa.
            </p>
            {errorMessage ? (
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            ) : null}
          </div>
        </div>

        <Button variant="brand" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <GdiSpinner className="size-4" data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          {mode === "create" ? "Crear empleado" : "Guardar cambios"}
        </Button>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-tight">
            Datos principales
          </CardTitle>
          <CardDescription>
            Define la identidad principal del empleado y si tendra acceso al
            sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid lg:grid-cols-2">
            <Field className="lg:col-span-2">
              <FieldLabel htmlFor="empleado-nombre">Nombre completo</FieldLabel>
              <Input
                id="empleado-nombre"
                value={datosPrincipales.nombreCompleto}
                onChange={(event) =>
                  setDatosPrincipales((current) => ({
                    ...current,
                    nombreCompleto: event.target.value,
                  }))
                }
                placeholder="Ej. Lucia Fernandez"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="empleado-email">
                Correo electronico principal
              </FieldLabel>
              <Input
                id="empleado-email"
                type="email"
                value={datosPrincipales.email}
                onChange={(event) =>
                  setDatosPrincipales((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="empleado@empresa.com"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="empleado-sector">Sector</FieldLabel>
              <Input
                id="empleado-sector"
                value={datosPrincipales.sector}
                onChange={(event) =>
                  setDatosPrincipales((current) => ({
                    ...current,
                    sector: event.target.value,
                  }))
                }
                placeholder="Ventas, produccion, administracion..."
              />
            </Field>

            <FieldGroup className="grid md:grid-cols-[180px_1fr] lg:col-span-2">
              <Field>
                <FieldLabel htmlFor="empleado-telefono-codigo">
                  Codigo pais
                </FieldLabel>
                <Select
                  items={phoneCodeItems}
                  value={datosPrincipales.telefonoCodigo}
                  onValueChange={(value) => {
                    if (!value) {
                      return;
                    }

                    setDatosPrincipales((current) => ({
                      ...current,
                      telefonoCodigo: value,
                    }));
                  }}
                >
                  <SelectTrigger id="empleado-telefono-codigo" className="w-full">
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
                <FieldLabel htmlFor="empleado-telefono">
                  Telefono principal
                </FieldLabel>
                <Input
                  id="empleado-telefono"
                  inputMode="tel"
                  value={datosPrincipales.telefonoNumero}
                  onChange={(event) =>
                    setDatosPrincipales((current) => ({
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

            <Field className="lg:col-span-2">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="empleado-usuario-sistema">
                    Usuario del sistema
                  </FieldLabel>
                  <FieldDescription>
                    Habilita el acceso del empleado al ERP y la definicion de su
                    rol.
                  </FieldDescription>
                </div>
                <Switch
                  id="empleado-usuario-sistema"
                  checked={datosPrincipales.usuarioSistema}
                  onCheckedChange={handleToggleUsuarioSistema}
                />
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-tight">
            Informacion general
          </CardTitle>
          <CardDescription>
            Registra datos laborales y personales relevantes para el legajo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid lg:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="empleado-ocupacion">Ocupacion</FieldLabel>
              <Input
                id="empleado-ocupacion"
                value={informacionGeneral.ocupacion}
                onChange={(event) =>
                  setInformacionGeneral((current) => ({
                    ...current,
                    ocupacion: event.target.value,
                  }))
                }
                placeholder="Ej. Vendedor senior"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="empleado-sexo">Sexo</FieldLabel>
              <Select
                items={sexoItems}
                value={informacionGeneral.sexo}
                onValueChange={(value) => {
                  setInformacionGeneral((current) => ({
                    ...current,
                    sexo: (value as SexoEmpleado | "") || "",
                  }));
                }}
              >
                <SelectTrigger id="empleado-sexo" className="w-full">
                  <SelectValue placeholder="Selecciona una opcion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sexoItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="empleado-fecha-ingreso">
                Fecha de ingreso
              </FieldLabel>
              <Input
                id="empleado-fecha-ingreso"
                type="date"
                value={informacionGeneral.fechaIngreso}
                onChange={(event) =>
                  setInformacionGeneral((current) => ({
                    ...current,
                    fechaIngreso: event.target.value,
                  }))
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="empleado-fecha-nacimiento">
                Fecha de nacimiento
              </FieldLabel>
              <Input
                id="empleado-fecha-nacimiento"
                type="date"
                value={informacionGeneral.fechaNacimiento}
                onChange={(event) =>
                  setInformacionGeneral((current) => ({
                    ...current,
                    fechaNacimiento: event.target.value,
                  }))
                }
              />
            </Field>
          </FieldGroup>
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
                Registra una o mas direcciones y marca una como principal.
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

                            updateDireccion(
                              direccion.id,
                              "tipo",
                              value as TipoDireccion,
                            );
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

      {datosPrincipales.usuarioSistema ? (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">
                  Usuario del sistema
                </CardTitle>
                <CardDescription>
                  Define el acceso al ERP y el rol que administrara sus permisos.
                </CardDescription>
              </div>
              {mode === "edit" ? (
                <Button
                  type="button"
                  variant="sidebar"
                  className="w-full sm:w-auto"
                  disabled={isInviting}
                  onClick={handleInviteAccess}
                >
                  {isInviting ? (
                    <GdiSpinner className="size-4" />
                  ) : (
                    <ShieldCheckIcon />
                  )}
                  Reenviar invitacion
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid lg:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="empleado-email-acceso">Email de acceso</FieldLabel>
                <Input
                  id="empleado-email-acceso"
                  type="email"
                  value={usuarioSistema.emailAcceso}
                  onChange={(event) =>
                    setUsuarioSistema((current) => ({
                      ...current,
                      emailAcceso: event.target.value,
                    }))
                  }
                  placeholder="usuario@empresa.com"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="empleado-rol-sistema">Rol</FieldLabel>
                <Select
                  items={rolItems}
                  value={usuarioSistema.rolSistema}
                  onValueChange={(value) =>
                    setUsuarioSistema((current) => ({
                      ...current,
                      rolSistema: (value as RolSistema | "") || "",
                    }))
                  }
                >
                  <SelectTrigger id="empleado-rol-sistema" className="w-full">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {rolItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">
                Comisiones
              </CardTitle>
              <CardDescription>
                Define como comisiona el empleado. Por ahora se resuelve como un
                esquema editable simple y desacoplado.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-none">
                  Habilitar comisiones
                </span>
                <span className="text-xs text-muted-foreground">
                  Activa o desactiva esta seccion
                </span>
              </div>
              <Switch
                checked={comisionesHabilitadas}
                onCheckedChange={handleToggleComisiones}
              />
            </div>
          </div>
        </CardHeader>
        {comisionesHabilitadas ? (
          <CardContent className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button variant="brand" size="sm" onClick={addComision}>
                <PlusIcon data-icon="inline-start" />
                Agregar comision
              </Button>
            </div>

            {comisiones.map((comision, index) => (
              <Card key={comision.id} className="rounded-xl border-border/70 shadow-none">
                <CardHeader className="gap-4 border-b border-border/70">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        Comision {index + 1}
                      </CardTitle>
                      <Badge variant="outline">
                        <PercentIcon data-icon="inline-start" />
                        {comision.tipo === "porcentaje" ? "Porcentaje" : "Monto fijo"}
                      </Badge>
                    </div>
                    <Button
                      variant="sidebar"
                      size="sm"
                      onClick={() => removeComision(comision.id)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Quitar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="grid lg:grid-cols-[1.4fr_220px_220px]">
                    <Field>
                      <FieldLabel htmlFor={`comision-descripcion-${comision.id}`}>
                        Descripcion
                      </FieldLabel>
                      <Input
                        id={`comision-descripcion-${comision.id}`}
                        value={comision.descripcion}
                        onChange={(event) =>
                          updateComision(comision.id, "descripcion", event.target.value)
                        }
                        placeholder="Ej. 5% de la venta"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`comision-tipo-${comision.id}`}>
                        Tipo
                      </FieldLabel>
                      <Select
                        items={comisionTypeItems}
                        value={comision.tipo}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateComision(comision.id, "tipo", value as TipoComision);
                        }}
                      >
                        <SelectTrigger
                          id={`comision-tipo-${comision.id}`}
                          className="w-full"
                        >
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {comisionTypeItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`comision-valor-${comision.id}`}>
                        Valor
                      </FieldLabel>
                      <Input
                        id={`comision-valor-${comision.id}`}
                        inputMode="decimal"
                        value={comision.valor}
                        onChange={(event) =>
                          updateComision(comision.id, "valor", event.target.value)
                        }
                        placeholder={comision.tipo === "porcentaje" ? "5" : "10000"}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        ) : null}
      </Card>

      {(datosPrincipales.usuarioSistema || comisionesHabilitadas) && (
        <div className="flex flex-wrap gap-2">
          {datosPrincipales.usuarioSistema ? (
            <Badge variant="secondary">
              <ShieldCheckIcon data-icon="inline-start" />
              Usuario del sistema habilitado
            </Badge>
          ) : null}
          {comisionesHabilitadas ? (
            <Badge variant="secondary">
              <PercentIcon data-icon="inline-start" />
              Comisiones habilitadas
            </Badge>
          ) : null}
        </div>
      )}
    </div>
  );
}
