"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  ContactRoundIcon,
  UserRoundIcon,
  CircleAlertIcon,
  MapPinHouseIcon,
  PercentIcon,
  PlusIcon,
  SaveIcon,
  ShieldCheckIcon,
  StarIcon,
  Trash2Icon,
  HistoryIcon,
  UserXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { createEmpleado, updateEmpleado } from "@/lib/empleados-api";
import { fechaConDia } from "@/lib/fecha";
import {
  comisionTypeItems,
  createEmptyComision,
  createEmptyDireccion,
  EmpleadoComision,
  EmpleadoDetalle,
  EmpleadoDireccion,
  EmpleadoPayload,
  sexoItems,
  SexoEmpleado,
  TipoComision,
  TipoDireccion,
  latamCountries,
} from "@/lib/empleados";
import {
  Card,
  Chip as Badge,
  Description as FieldDescription,
  Input,
  Label as FieldLabel,
  Switch,
  Tabs,
} from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SelectField } from "@/components/design-system/select-field";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { useFecha } from "@/components/navigation/config-regional-provider";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Field, FieldGroup } from "@/components/ui/field";
import brand from "@/components/crm/contactos-workspace.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./empleados.module.css";

type EmpleadoFichaProps = {
  empleado: EmpleadoDetalle;
  mode: "create" | "edit";
  canManage: boolean;
  canViewCommissions: boolean;
};

type DatosPrincipalesState = {
  nombreCompleto: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  email: string;
  sector: string;
};

type InformacionGeneralState = {
  ocupacion: string;
  sexo: SexoEmpleado | "";
  fechaIngreso: string;
  fechaNacimiento: string;
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
  { label: "Facturación", value: "facturacion" },
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
    comisionesHabilitadas,
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
    comisiones: comisiones.map((comision) => ({
      id: comision.id,
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

export function EmpleadoFicha({
  empleado,
  mode,
  canManage,
  canViewCommissions,
}: EmpleadoFichaProps) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const { fechaNumerica, hora } = useFecha();
  const readOnly = !canManage || !empleado.activo;
  const router = useRouter();
  const [isSaving, startSaving] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [datosPrincipales, setDatosPrincipales] =
    React.useState<DatosPrincipalesState>({
      nombreCompleto: empleado.nombreCompleto,
      telefonoCodigo: empleado.telefonoCodigo,
      telefonoNumero: empleado.telefonoNumero,
      email: empleado.email,
      sector: empleado.sector,
    });
  const [informacionGeneral, setInformacionGeneral] =
    React.useState<InformacionGeneralState>({
      ocupacion: empleado.ocupacion,
      sexo: empleado.sexo,
      fechaIngreso: empleado.fechaIngreso,
      fechaNacimiento: empleado.fechaNacimiento,
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

  const handleToggleComisiones = (checked: boolean) => {
    setComisionesHabilitadas(checked);

    if (checked && comisiones.length === 0) {
      setComisiones([createEmptyComision()]);
    }

    if (!checked) {
      setComisiones([]);
    }
  };

  const handleSave = () => {
    setErrorMessage(null);

    const payload = buildPayload(
      datosPrincipales,
      informacionGeneral,
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
            : await updateEmpleado(empleado.id, {
                ...payload,
                updatedAt: empleado.updatedAt,
              });

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
    <section
      {...scope}
      data-visual="brand"
      className={`${theme} ${listPage.page} ${brand.workspace} ${styles.ficha}`}
    >
      <div className={styles.sections}>
        <header className={listPage.header}>
          <div className={styles.fichaTitle}>
            <ActionLink
              href="/empleados"
              variant="ghost"
              className={styles.backLink}
            >
              <ArrowLeftIcon size={16} aria-hidden />
              Volver a empleados
            </ActionLink>
            <p className={brand.eyebrow}>Registros · Legajo del equipo</p>
            <h1>
              {mode === "create" ? "Nuevo empleado" : empleado.nombreCompleto}
              <span className={brand.titleDot}>.</span>
            </h1>
            <p className={listPage.subtitle}>
              Datos personales, información laboral y condiciones comerciales
              del equipo.
            </p>
          </div>
          {canManage && empleado.activo ? (
            <Button onPress={handleSave} isDisabled={isSaving}>
              {isSaving ? (
                <GdiSpinner />
              ) : mode === "create" ? (
                <ArrowUpRightIcon />
              ) : (
                <SaveIcon />
              )}
              {mode === "create" ? "Crear empleado" : "Guardar cambios"}
            </Button>
          ) : null}
        </header>
        {errorMessage && (
          <Card className={styles.errorBanner} role="alert">
            <CircleAlertIcon size={20} aria-hidden />
            <div>
              <strong>No se pudieron guardar los cambios</strong>
              <p>{errorMessage}</p>
            </div>
          </Card>
        )}
        {!empleado.activo ? (
          <Card className={styles.errorBanner} role="alert">
            <UserXIcon size={20} aria-hidden />
            <div>
              <strong>Empleado dado de baja</strong>
              <p>
                El legajo se conserva para el historial, pero ya no aparece en
                estaciones, usuarios ni nuevas operaciones.
                {empleado.fechaBaja ? ` Baja: ${empleado.fechaBaja}.` : ""}
                {empleado.motivoBaja ? ` Motivo: ${empleado.motivoBaja}.` : ""}
              </p>
            </div>
          </Card>
        ) : !canManage && mode === "edit" ? (
          <Card className={styles.notice}>
            <ShieldCheckIcon size={20} aria-hidden />
            <div>
              <strong>Ficha en modo lectura</strong>
              <p>
                Podés consultar el legajo, pero no tenés permiso para
                modificarlo.
              </p>
            </div>
          </Card>
        ) : null}

        <div className={styles.recordSummary} aria-label="Resumen del legajo">
          <div className={styles.recordStatus}>
            <UserRoundIcon aria-hidden="true" />
            <dl>
              <dt>Estado del legajo</dt>
              <dd>
                {mode === "create"
                  ? "Nuevo ingreso"
                  : empleado.activo
                    ? "Empleado activo"
                    : "Empleado dado de baja"}
              </dd>
            </dl>
          </div>
          <div>
            <BriefcaseBusinessIcon aria-hidden="true" />
            <dl>
              <dt>Sector</dt>
              <dd>{datosPrincipales.sector || "Por definir"}</dd>
            </dl>
          </div>
          <div>
            <CalendarDaysIcon aria-hidden="true" />
            <dl>
              <dt>Fecha de ingreso</dt>
              <dd>
                {fechaConDia(informacionGeneral.fechaIngreso) || "Por definir"}
              </dd>
            </dl>
          </div>
        </div>
        <Tabs defaultSelectedKey="legajo" className={styles.tabsRoot}>
          <NavigationTabList
            label="Secciones del empleado"
            className={styles.mainTabs}
            variant="detailed"
            tone="graphite"
            items={[
              {
                id: "legajo",
                label: "Legajo",
                description: "Datos y contacto",
                icon: <ContactRoundIcon />,
              },
              ...(canViewCommissions
                ? [
                    {
                      id: "comisiones",
                      label: "Comisiones",
                      description: "Reglas comerciales",
                      icon: <PercentIcon />,
                    },
                  ]
                : []),
              ...(mode === "edit"
                ? [
                    {
                      id: "historial",
                      label: "Historial",
                      description: "Actividad del legajo",
                      icon: <HistoryIcon />,
                      count: empleado.eventos.length,
                    },
                  ]
                : []),
            ]}
          />
          <Tabs.Panel id="legajo" shouldForceMount className={styles.tabPanel}>
            <fieldset
              disabled={!canManage || !empleado.activo}
              className={styles.legajoGrid}
            >
              <Card className={styles.sectionCard}>
                <Card.Header className={styles.sectionHeader}>
                  <Card.Title className={styles.sectionTitle}>
                    <ContactRoundIcon aria-hidden="true" /> Datos principales
                  </Card.Title>
                  <Card.Description>
                    Quién es y cómo ubicarlo. El acceso al sistema se administra
                    aparte, en Configuración → Usuarios.
                  </Card.Description>
                </Card.Header>
                <Card.Content className={styles.sectionBody}>
                  <FieldGroup className={styles.formGrid}>
                    <Field className={styles.wideField}>
                      <FieldLabel htmlFor="empleado-nombre">
                        Nombre completo
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
                        id="empleado-nombre"
                        required
                        maxLength={160}
                        value={datosPrincipales.nombreCompleto}
                        onChange={(event) =>
                          setDatosPrincipales((current) => ({
                            ...current,
                            nombreCompleto: event.target.value,
                          }))
                        }
                        placeholder="Ej. Lucía Fernández"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="empleado-email">
                        Correo electrónico principal
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
                        id="empleado-email"
                        type="email"
                        required
                        maxLength={254}
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
                        className={focus.singleBorder}
                        id="empleado-sector"
                        required
                        maxLength={120}
                        value={datosPrincipales.sector}
                        onChange={(event) =>
                          setDatosPrincipales((current) => ({
                            ...current,
                            sector: event.target.value,
                          }))
                        }
                        placeholder="Ventas, producción, administración…"
                      />
                    </Field>

                    <FieldGroup
                      className={`${styles.phoneGrid} ${styles.wideField}`}
                    >
                      <Field>
                        <FieldLabel htmlFor="empleado-telefono-codigo">
                          Código de país
                        </FieldLabel>
                        <SelectField
                          options={phoneCodeItems}
                          value={datosPrincipales.telefonoCodigo}
                          onChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setDatosPrincipales((current) => ({
                              ...current,
                              telefonoCodigo: value,
                            }));
                          }}
                          id="empleado-telefono-codigo"
                          aria-label="Código de país"
                          disabled={readOnly}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="empleado-telefono">
                          Teléfono principal
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
                          id="empleado-telefono"
                          inputMode="tel"
                          required
                          maxLength={30}
                          value={datosPrincipales.telefonoNumero}
                          onChange={(event) =>
                            setDatosPrincipales((current) => ({
                              ...current,
                              telefonoNumero: event.target.value,
                            }))
                          }
                          placeholder="Número sin código de país"
                        />
                        <FieldDescription>
                          Se guardará como: {telefonoWhatsapp || "Sin definir"}
                        </FieldDescription>
                      </Field>
                    </FieldGroup>
                  </FieldGroup>
                </Card.Content>
              </Card>

              <Card className={styles.sectionCard}>
                <Card.Header className={styles.sectionHeader}>
                  <Card.Title className={styles.sectionTitle}>
                    <BriefcaseBusinessIcon aria-hidden="true" /> Información
                    laboral
                  </Card.Title>
                  <Card.Description>
                    Puesto, ingreso y datos personales vinculados al legajo.
                  </Card.Description>
                </Card.Header>
                <Card.Content className={styles.sectionBody}>
                  <FieldGroup className={styles.formGrid}>
                    <Field>
                      <FieldLabel htmlFor="empleado-ocupacion">
                        Ocupación
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
                        id="empleado-ocupacion"
                        maxLength={160}
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
                      <SelectField
                        options={sexoItems}
                        value={informacionGeneral.sexo}
                        onChange={(value) => {
                          setInformacionGeneral((current) => ({
                            ...current,
                            sexo: (value as SexoEmpleado | "") || "",
                          }));
                        }}
                        id="empleado-sexo"
                        aria-label="Sexo"
                        disabled={readOnly}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="empleado-fecha-ingreso">
                        Fecha de ingreso
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
                        id="empleado-fecha-ingreso"
                        type="date"
                        required
                        max={new Date().toISOString().slice(0, 10)}
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
                        className={focus.singleBorder}
                        id="empleado-fecha-nacimiento"
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
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
                </Card.Content>
              </Card>

              <Card className={`${styles.sectionCard} ${styles.fullWidth}`}>
                <Card.Header className={styles.sectionHeader}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <Card.Title className={styles.sectionTitle}>
                        <MapPinHouseIcon aria-hidden="true" /> Direcciones
                      </Card.Title>
                      <Card.Description>
                        Registrá una o más direcciones y marcá una como
                        principal.
                      </Card.Description>
                    </div>
                    <Button
                      isDisabled={readOnly}
                      variant="outline"
                      className="w-full sm:w-auto"
                      onPress={addDireccion}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Agregar dirección
                    </Button>
                  </div>
                </Card.Header>
                <Card.Content className={styles.sectionBody}>
                  {direcciones.length === 0 && (
                    <Empty className={brand.empty}>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <MapPinHouseIcon />
                        </EmptyMedia>
                        <EmptyTitle>Sin direcciones registradas</EmptyTitle>
                        <EmptyDescription>
                          Agregá un domicilio para completar el legajo.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  <Tabs
                    selectedKey={activeDireccionId}
                    onSelectionChange={(value) => {
                      if (value) {
                        setActiveDireccionId(String(value));
                      }
                    }}
                  >
                    <NavigationTabList
                      label="Direcciones del empleado"
                      items={direcciones.map((direccion, index) => ({
                        id: direccion.id,
                        label:
                          direccion.descripcion || `Dirección ${index + 1}`,
                        icon: direccion.principal ? (
                          <StarIcon className={styles.primaryStar} />
                        ) : undefined,
                      }))}
                    />

                    {direcciones.map((direccion, index) => (
                      <Tabs.Panel key={direccion.id} id={direccion.id}>
                        {activeDireccionId === direccion.id ? (
                          <Card className={styles.resourceCard}>
                            <Card.Header className={styles.sectionHeader}>
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Card.Title className={styles.sectionTitle}>
                                    {direccion.descripcion ||
                                      `Dirección ${index + 1}`}
                                  </Card.Title>
                                  {direccion.principal ? (
                                    <Badge size="sm" variant="secondary">
                                      <StarIcon
                                        data-icon="inline-start"
                                        className={styles.primaryStar}
                                      />
                                      Principal
                                    </Badge>
                                  ) : null}
                                  <Badge size="sm" variant="secondary">
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
                                      isDisabled={readOnly}
                                      variant="outline"
                                      size="sm"
                                      onPress={() =>
                                        setPrimaryDireccion(direccion.id)
                                      }
                                    >
                                      Definir principal
                                    </Button>
                                  ) : null}
                                  <Button
                                    isDisabled={readOnly}
                                    variant="outline"
                                    size="sm"
                                    onPress={() =>
                                      removeDireccion(direccion.id)
                                    }
                                  >
                                    <Trash2Icon data-icon="inline-start" />
                                    Quitar
                                  </Button>
                                </div>
                              </div>
                            </Card.Header>
                            <Card.Content className={styles.sectionBody}>
                              <FieldGroup className={styles.formGrid}>
                                <Field>
                                  <FieldLabel
                                    htmlFor={`direccion-descripcion-${direccion.id}`}
                                  >
                                    Descripción
                                  </FieldLabel>
                                  <Input
                                    className={focus.singleBorder}
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
                                  <SelectField
                                    options={addressTypeItems}
                                    value={direccion.tipo}
                                    onChange={(value) => {
                                      if (!value) {
                                        return;
                                      }

                                      updateDireccion(
                                        direccion.id,
                                        "tipo",
                                        value as TipoDireccion,
                                      );
                                    }}
                                    id={`direccion-tipo-${direccion.id}`}
                                    aria-label="Tipo de dirección"
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field>
                                  <FieldLabel
                                    htmlFor={`direccion-pais-${direccion.id}`}
                                  >
                                    País
                                  </FieldLabel>
                                  <SelectField
                                    options={countryItems}
                                    value={direccion.pais}
                                    onChange={(value) => {
                                      if (!value) {
                                        return;
                                      }

                                      updateDireccion(
                                        direccion.id,
                                        "pais",
                                        value,
                                      );
                                    }}
                                    id={`direccion-pais-${direccion.id}`}
                                    aria-label="País"
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field>
                                  <FieldLabel
                                    htmlFor={`direccion-cp-${direccion.id}`}
                                  >
                                    Código postal
                                  </FieldLabel>
                                  <Input
                                    className={focus.singleBorder}
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
                                    className={focus.singleBorder}
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
                                    className={focus.singleBorder}
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

                                <Field className={styles.wideField}>
                                  <FieldLabel
                                    htmlFor={`direccion-ciudad-${direccion.id}`}
                                  >
                                    Ciudad
                                  </FieldLabel>
                                  <Input
                                    className={focus.singleBorder}
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
                            </Card.Content>
                          </Card>
                        ) : null}
                      </Tabs.Panel>
                    ))}
                  </Tabs>
                </Card.Content>
              </Card>

              {/* Espejo del acceso, sólo lectura. El alta, el rol y la baja viven en
          Configuración → Usuarios: un usuario NO es un empleado —el contador
          externo entra sin legajo y casi todo el taller tiene legajo y no
          entra—, y tener dos formularios que creaban la misma cuenta terminaba
          en dos verdades sobre quién puede qué. Peor: el de acá creaba la
          membresía con el rol viejo del enum y sin `rolId`, así que la persona
          nacía esquivando el editor de roles.
          Ver docs/usuarios-roles-permisos-diseno.md */}
              {mode === "edit" ? (
                <Card
                  className={`${styles.sectionCard} ${styles.accessCard} ${styles.fullWidth}`}
                >
                  <Card.Header className={styles.sectionHeader}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <Card.Title className={styles.sectionTitle}>
                          <ShieldCheckIcon aria-hidden="true" /> Acceso al
                          sistema
                        </Card.Title>
                        <Card.Description>
                          {empleado?.usuarioSistema ? (
                            <>
                              Entra al sistema como{" "}
                              <b className="text-foreground">
                                {empleado.emailAcceso}
                              </b>
                              . El rol y la baja se administran en{" "}
                              <Link
                                href="/configuracion/usuarios"
                                className="font-medium underline underline-offset-4"
                              >
                                Configuración → Usuarios
                              </Link>
                              .
                            </>
                          ) : (
                            <>
                              Este legajo no tiene una cuenta vinculada. Si la
                              persona necesita ingresar a Grafo, creá su cuenta
                              en{" "}
                              <Link
                                href="/configuracion/usuarios"
                                className="font-medium underline underline-offset-4"
                              >
                                Configuración → Usuarios
                              </Link>{" "}
                              y se la vincula a este legajo.
                            </>
                          )}
                        </Card.Description>
                      </div>
                      {/* Con router y no con un <Link> envolviendo al Button: un <a>
                  con un <button> adentro es HTML inválido. */}
                      <Button
                        isDisabled={readOnly}
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onPress={() => router.push("/configuracion/usuarios")}
                      >
                        <ShieldCheckIcon />
                        {empleado?.usuarioSistema
                          ? "Administrar acceso"
                          : "Dar acceso"}
                      </Button>
                    </div>
                  </Card.Header>
                </Card>
              ) : null}
            </fieldset>
          </Tabs.Panel>
          {canViewCommissions && (
            <Tabs.Panel
              id="comisiones"
              shouldForceMount
              className={styles.tabPanel}
            >
              <fieldset disabled={readOnly} className={styles.sections}>
                <Card className={styles.sectionCard}>
                  <Card.Header className={styles.sectionHeader}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <Card.Title className={styles.sectionTitle}>
                          <PercentIcon aria-hidden="true" /> Comisiones
                        </Card.Title>
                        <Card.Description>
                          Estimación usada en Reportes → Equipo: el porcentaje
                          se aplica sobre la venta neta emitida y el monto fijo
                          una vez por orden. No reemplaza una liquidación de
                          haberes.
                        </Card.Description>
                      </div>
                      <Switch
                        isSelected={comisionesHabilitadas}
                        onChange={handleToggleComisiones}
                        isDisabled={readOnly}
                        className={styles.commissionSwitch}
                        size="sm"
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <FieldLabel>Habilitar comisiones</FieldLabel>
                        </Switch.Content>
                      </Switch>
                    </div>
                  </Card.Header>
                  {comisionesHabilitadas ? (
                    <Card.Content className={styles.sectionBody}>
                      <div className="flex justify-end">
                        <Button
                          isDisabled={readOnly}
                          variant="outline"
                          size="sm"
                          onPress={addComision}
                        >
                          <PlusIcon data-icon="inline-start" />
                          Agregar comisión
                        </Button>
                      </div>

                      {comisiones.map((comision, index) => (
                        <Card
                          key={comision.id}
                          className={styles.commissionCard}
                        >
                          <Card.Header className={styles.sectionHeader}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <Card.Title className={styles.sectionTitle}>
                                  Comisión {index + 1}
                                </Card.Title>
                                <Badge size="sm" variant="secondary">
                                  <PercentIcon data-icon="inline-start" />
                                  {comision.tipo === "porcentaje"
                                    ? "Porcentaje"
                                    : "Monto fijo"}
                                </Badge>
                              </div>
                              <Button
                                isDisabled={readOnly}
                                variant="outline"
                                size="sm"
                                onPress={() => removeComision(comision.id)}
                              >
                                <Trash2Icon data-icon="inline-start" />
                                Quitar
                              </Button>
                            </div>
                          </Card.Header>
                          <Card.Content className={styles.sectionBody}>
                            <FieldGroup className={styles.commissionGrid}>
                              <Field>
                                <FieldLabel
                                  htmlFor={`comision-descripcion-${comision.id}`}
                                >
                                  Descripción
                                </FieldLabel>
                                <Input
                                  className={focus.singleBorder}
                                  id={`comision-descripcion-${comision.id}`}
                                  value={comision.descripcion}
                                  onChange={(event) =>
                                    updateComision(
                                      comision.id,
                                      "descripcion",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ej. 5% de la venta"
                                />
                              </Field>

                              <Field>
                                <FieldLabel
                                  htmlFor={`comision-tipo-${comision.id}`}
                                >
                                  Tipo
                                </FieldLabel>
                                <SelectField
                                  options={comisionTypeItems}
                                  value={comision.tipo}
                                  onChange={(value) => {
                                    if (!value) {
                                      return;
                                    }

                                    updateComision(
                                      comision.id,
                                      "tipo",
                                      value as TipoComision,
                                    );
                                  }}
                                  id={`comision-tipo-${comision.id}`}
                                  aria-label="Tipo de comisión"
                                  disabled={readOnly}
                                />
                              </Field>

                              <Field>
                                <FieldLabel
                                  htmlFor={`comision-valor-${comision.id}`}
                                >
                                  Valor
                                </FieldLabel>
                                <Input
                                  className={focus.singleBorder}
                                  id={`comision-valor-${comision.id}`}
                                  inputMode="decimal"
                                  type="number"
                                  min="0.01"
                                  max={
                                    comision.tipo === "porcentaje"
                                      ? "100"
                                      : "99999999.99"
                                  }
                                  step="0.01"
                                  value={comision.valor}
                                  onChange={(event) =>
                                    updateComision(
                                      comision.id,
                                      "valor",
                                      event.target.value,
                                    )
                                  }
                                  placeholder={
                                    comision.tipo === "porcentaje"
                                      ? "5"
                                      : "10000"
                                  }
                                />
                              </Field>
                            </FieldGroup>
                          </Card.Content>
                        </Card>
                      ))}
                    </Card.Content>
                  ) : (
                    <Card.Content>
                      <Empty className={brand.empty}>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <PercentIcon />
                          </EmptyMedia>
                          <EmptyTitle>Comisiones desactivadas</EmptyTitle>
                          <EmptyDescription>
                            Habilitá las comisiones para definir un porcentaje o
                            un monto fijo por orden.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </Card.Content>
                  )}
                </Card>
              </fieldset>
            </Tabs.Panel>
          )}
          {mode === "edit" && (
            <Tabs.Panel id="historial" className={styles.tabPanel}>
              <Card className={styles.sectionCard}>
                <Card.Header className={styles.sectionHeader}>
                  <Card.Title className={styles.sectionTitle}>
                    <HistoryIcon aria-hidden="true" /> Historial del legajo
                  </Card.Title>
                  <Card.Description>
                    Últimos cambios de datos y estado, con su responsable.
                  </Card.Description>
                </Card.Header>
                <Card.Content className={styles.sectionBody}>
                  {empleado.eventos.length === 0 && (
                    <Empty className={brand.empty}>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HistoryIcon />
                        </EmptyMedia>
                        <EmptyTitle>El historial empieza acá</EmptyTitle>
                        <EmptyDescription>
                          Los próximos cambios del legajo aparecerán con su
                          fecha y responsable.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  {empleado.eventos.map((evento) => (
                    <div key={evento.id} className={styles.historyItem}>
                      <span className={styles.historyIcon} aria-hidden="true">
                        <HistoryIcon />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {evento.tipo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {evento.actorNombre} ·{" "}
                          <time dateTime={evento.createdAt}>
                            {fechaNumerica(evento.createdAt)} ·{" "}
                            {hora(evento.createdAt)}
                          </time>
                        </p>
                      </div>
                    </div>
                  ))}
                </Card.Content>
              </Card>
            </Tabs.Panel>
          )}
        </Tabs>
      </div>
    </section>
  );
}
