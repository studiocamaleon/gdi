"use client";

import { useCapacidad } from "@/components/navigation/capacidades-provider";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  MailIcon,
  ContactRoundIcon,
  Building2Icon,
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

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import {
  Card,
  Chip,
  Input,
  Label as FieldLabel,
  Description as FieldDescription,
  Tabs,
} from "@heroui/react";
import { Field, FieldGroup } from "@/components/ui/field";

import { SelectField } from "@/components/design-system/select-field";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import brand from "@/components/crm/contactos-workspace.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./clientes.module.css";
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
  aceptaWhatsapp: boolean | null
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
    (contacto) => !contacto.nombre
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
      !direccion.ciudad
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
      message: `Completá descripción, país, dirección y ciudad en la dirección ${
        direccionInvalida + 1
      }.`,
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
  const conFidelizacion = useCapacidad("fidelizacion");
  const conCuentasCobrar = useCapacidad("cuentas_cobrar");
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const puedeAjustarPuntos = usePuede("crm.configurar_fidelizacion");
  const puedeConsultarPuntos = usePuede("crm.ver");
  const router = useRouter();
  const { fechaHora } = useFecha();
  const [isSaving, startSaving] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [aceptaWhatsapp, setAceptaWhatsapp] = React.useState<boolean | null>(
    cliente.aceptaWhatsapp
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
    cliente.contactos[0]?.id ?? ""
  );
  const [activeDireccionId, setActiveDireccionId] = React.useState(
    cliente.direcciones[0]?.id ?? ""
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
    datosGenerales.telefonoNumero
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
      (contacto) => contacto.id === contactoId
    );
    setContactos((current) => {
      const nextContactos = current.filter(
        (contacto) => contacto.id !== contactoId
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
    value: string | boolean
  ) => {
    setContactos((current) =>
      current.map((contacto) =>
        contacto.id === contactoId ? { ...contacto, [field]: value } : contacto
      )
    );
  };

  const setPrimaryContacto = (contactoId: string) => {
    setContactos((current) =>
      current.map((contacto) => ({
        ...contacto,
        principal: contacto.id === contactoId,
      }))
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
      (direccion) => direccion.id === direccionId
    );
    const removedIndex = direcciones.findIndex(
      (direccion) => direccion.id === direccionId
    );
    setDirecciones((current) => {
      const nextDirecciones = current.filter(
        (direccion) => direccion.id !== direccionId
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
    value: string | boolean
  ) => {
    setDirecciones((current) =>
      current.map((direccion) =>
        direccion.id === direccionId
          ? { ...direccion, [field]: value }
          : direccion
      )
    );
  };

  const setPrimaryDireccion = (direccionId: string) => {
    setDirecciones((current) =>
      current.map((direccion) => ({
        ...direccion,
        principal: direccion.id === direccionId,
      }))
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
      aceptaWhatsapp
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
        | keyof FieldErrors
        | undefined;
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
          validation.focusId?.endsWith(item.id)
        );
        const direccion = direcciones.find((item) =>
          validation.focusId?.endsWith(item.id)
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
      data-visual="brand"
      {...scope}
      className={`${theme} ${listPage.page} ${brand.workspace} ${styles.ficha}`}
      onSubmit={handleSave}
      noValidate
    >
      <div className={`${listPage.header} ${styles.fichaHeader}`}>
        <div className={brand.fichaHeading}>
          <ActionLink
            href="/crm/clientes"
            onNavigate={confirmNavigation}
            variant="ghost"
            className={styles.backLink}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a clientes
          </ActionLink>
          <div className="flex flex-col gap-2">
            <p className={brand.eyebrow}>CRM · Ficha de cliente</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1>
                {mode === "create" ? "Nuevo cliente" : cliente.nombre}
                <span className={brand.titleDot}>.</span>
              </h1>
              {!cliente.activo && mode !== "create" ? (
                <Chip size="sm" variant="soft">
                  Inhabilitado
                </Chip>
              ) : null}
            </div>
            <p className={listPage.subtitle}>
              Información comercial, condiciones de venta y contactos en una
              sola ficha.
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

        <div className={brand.headerActions}>
          {mode !== "create" ? (
            <ActionLink
              href={`/comercial/campanas?clienteId=${cliente.id}`}
              onNavigate={confirmNavigation}
              variant="outline"
            >
              <FolderIcon data-icon="inline-start" />
              Campañas
            </ActionLink>
          ) : null}
          {mode !== "create" && conCuentasCobrar ? (
            <ActionLink
              href={`/crm/clientes/${cliente.id}/cuenta-corriente`}
              onNavigate={confirmNavigation}
              variant="outline"
            >
              <ReceiptTextIcon data-icon="inline-start" />
              Cuenta corriente
            </ActionLink>
          ) : null}
          {!readOnly ? (
            <Button
              variant="primary"
              type="submit"
              isDisabled={isSaving || !isDirty}
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

      {mode !== "create" && (
        <div className={brand.recordSummary} aria-label="Resumen del cliente">
          <div>
            <Building2Icon aria-hidden />
            <dl>
              <dt>Razón social</dt>
              <dd>{cliente.razonSocial || "Sin razón social cargada"}</dd>
            </dl>
          </div>
          <div>
            <MailIcon aria-hidden />
            <dl>
              <dt>Email principal</dt>
              <dd>{cliente.email || "Sin email cargado"}</dd>
            </dl>
          </div>
          <div>
            <ContactRoundIcon aria-hidden />
            <dl>
              <dt>Red de contacto</dt>
              <dd>
                {cliente.contactos.length}{" "}
                {cliente.contactos.length === 1 ? "contacto" : "contactos"} ·{" "}
                {cliente.direcciones.length}{" "}
                {cliente.direcciones.length === 1 ? "dirección" : "direcciones"}
              </dd>
            </dl>
          </div>
        </div>
      )}

      <Tabs
        selectedKey={mode === "create" ? "ficha" : activeSection}
        onSelectionChange={(value) => {
          if (
            value === "ficha" ||
            value === "fidelizacion" ||
            value === "historial"
          ) {
            setActiveSection(value);
          }
        }}
        className={styles.tabsRoot}
      >
        {mode !== "create" ? (
          <NavigationTabList
            label="Secciones del cliente"
            className={brand.mainTabs}
            variant="detailed"
            tone="graphite"
            items={[
              {
                id: "ficha",
                label: "Ficha de cliente",
                description: "Datos y contactos",
                icon: <UserRoundIcon />,
              },
              ...(puedeConsultarPuntos ? [{
                id: "fidelizacion",
                label: conFidelizacion ? "Fidelización" : "Historial de puntos",
                description: "Puntos y movimientos",
                icon: <StarIcon />,
              }] : []),
              {
                id: "historial",
                label: "Historial",
                description: "Actividad del cliente",
                icon: <HistoryIcon />,
              },
            ]}
          />
        ) : (
          <Tabs.List aria-label="Nuevo cliente" className="hidden">
            <Tabs.Tab id="ficha">Ficha de cliente</Tabs.Tab>
          </Tabs.List>
        )}

        <Tabs.Panel id="ficha" shouldForceMount className={styles.tabPanel}>
          <fieldset disabled={readOnly} className={brand.detailSections}>
            <Card className={styles.sectionCard}>
              <Card.Header className={styles.sectionHeader}>
                <Card.Title className={styles.sectionTitle}>
                  <ContactRoundIcon aria-hidden /> Datos generales
                </Card.Title>
                <Card.Description>
                  Identificación, información fiscal y canales de contacto.
                </Card.Description>
              </Card.Header>
              <Card.Content className={styles.sectionBody}>
                <div className={brand.dataSections}>
                  <section>
                    <div className={styles.groupHeading}>
                      <h3>
                        <span className={brand.sectionNumber}>01</span>
                        Identificación
                      </h3>
                      <p>Nombre comercial y ubicación del cliente.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <Field data-invalid={Boolean(fieldErrors.nombre)}>
                        <FieldLabel htmlFor="cliente-nombre">
                          Nombre del cliente
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
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
                          <FieldDescription>
                            {fieldErrors.nombre}
                          </FieldDescription>
                        ) : null}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="cliente-razon-social">
                          Razón social
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
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
                        <FieldLabel htmlFor="cliente-pais">País</FieldLabel>
                        <SelectField
                          options={countryItems}
                          value={datosGenerales.pais}
                          onChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setDatosGenerales((current) => ({
                              ...current,
                              pais: value,
                            }));
                          }}
                          id="cliente-pais"
                          aria-label="País"
                          disabled={readOnly}
                        />
                      </Field>
                    </div>
                  </section>
                  <section>
                    <div className={styles.groupHeading}>
                      <h3>
                        <span className={brand.sectionNumber}>02</span>
                        Facturación y cuenta corriente
                      </h3>
                      <p>Información fiscal y condiciones de pago.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <Field>
                        <FieldLabel htmlFor="cliente-condicion-fiscal">
                          Condición fiscal
                        </FieldLabel>
                        <SelectField
                          options={condicionFiscalItems}
                          value={datosGenerales.condicionFiscal}
                          onChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setDatosGenerales((current) => ({
                              ...current,
                              condicionFiscal: value as CondicionFiscal,
                            }));
                          }}
                          id="cliente-condicion-fiscal"
                          aria-label="Condición fiscal"
                          disabled={readOnly}
                        />
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
                          className={focus.singleBorder}
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
                      <Field
                        data-invalid={Boolean(fieldErrors.documentoNumero)}
                      >
                        <FieldLabel htmlFor="cliente-documento">
                          DNI (opcional)
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
                          id="cliente-documento"
                          aria-invalid={Boolean(fieldErrors.documentoNumero)}
                          inputMode="numeric"
                          value={datosGenerales.documentoNumero}
                          onChange={(event) =>
                            setDatosGenerales((current) => ({
                              ...current,
                              documentoNumero: event.target.value.replace(
                                /\D/g,
                                ""
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
                        data-invalid={Boolean(
                          fieldErrors.plazoCuentaCorrienteDias
                        )}
                      >
                        <FieldLabel htmlFor="cliente-condicion-pago">
                          Plazo de cuenta corriente (días)
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
                          id="cliente-condicion-pago"
                          inputMode="numeric"
                          aria-invalid={Boolean(
                            fieldErrors.plazoCuentaCorrienteDias
                          )}
                          value={datosGenerales.plazoCuentaCorrienteDias}
                          onChange={(event) =>
                            setDatosGenerales((current) => ({
                              ...current,
                              plazoCuentaCorrienteDias:
                                event.target.value.replace(/\D/g, ""),
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
                          className={focus.singleBorder}
                          id="cliente-limite-credito"
                          disabled={
                            datosGenerales.plazoCuentaCorrienteDias.trim() ===
                            ""
                          }
                          inputMode="decimal"
                          aria-invalid={Boolean(fieldErrors.limiteCredito)}
                          value={datosGenerales.limiteCredito}
                          onChange={(event) =>
                            setDatosGenerales((current) => ({
                              ...current,
                              limiteCredito: event.target.value.replace(
                                ",",
                                "."
                              ),
                            }))
                          }
                          placeholder="Sin límite"
                        />
                        <FieldDescription>
                          {fieldErrors.limiteCredito ??
                            (datosGenerales.plazoCuentaCorrienteDias.trim() ===
                            ""
                              ? "Se habilita al configurar un plazo de cuenta corriente."
                              : "Tope de deuda. Vacío = cuenta corriente sin límite.")}
                        </FieldDescription>
                      </Field>
                    </div>
                  </section>
                  <section>
                    <div className={styles.groupHeading}>
                      <h3>
                        <span className={brand.sectionNumber}>03</span>Contacto
                        principal
                      </h3>
                      <p>Canales de contacto y preferencias de comunicación.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <Field data-invalid={Boolean(fieldErrors.email)}>
                        <FieldLabel htmlFor="cliente-email">
                          Correo electrónico principal (opcional)
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
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
                          <FieldDescription>
                            {fieldErrors.email}
                          </FieldDescription>
                        ) : null}
                      </Field>
                      <FieldGroup className={styles.phoneGrid}>
                        <Field>
                          <FieldLabel htmlFor="telefono-codigo">
                            Código de país
                          </FieldLabel>
                          <SelectField
                            options={phoneCodeItems}
                            value={datosGenerales.telefonoCodigo}
                            onChange={(value) => {
                              if (!value) {
                                return;
                              }

                              setDatosGenerales((current) => ({
                                ...current,
                                telefonoCodigo: value,
                              }));
                            }}
                            id="telefono-codigo"
                            aria-label="Código de país"
                            disabled={readOnly}
                          />
                        </Field>

                        <Field
                          data-invalid={Boolean(fieldErrors.telefonoNumero)}
                        >
                          <FieldLabel htmlFor="telefono-numero">
                            Teléfono principal (opcional)
                          </FieldLabel>
                          <Input
                            className={focus.singleBorder}
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
                              `Se guardará como: ${
                                telefonoWhatsapp || "Sin definir"
                              }`}
                          </FieldDescription>
                        </Field>
                      </FieldGroup>
                      <Field className={styles.wideField}>
                        <FieldLabel htmlFor="cliente-whatsapp-consentimiento">
                          Consentimiento para WhatsApp
                        </FieldLabel>
                        <SelectField
                          options={whatsappConsentItems}
                          value={
                            aceptaWhatsapp === null
                              ? "sin_definir"
                              : aceptaWhatsapp
                              ? "si"
                              : "no"
                          }
                          onChange={(value) =>
                            setAceptaWhatsapp(
                              value === "sin_definir" ? null : value === "si"
                            )
                          }
                          id="cliente-whatsapp-consentimiento"
                          aria-label="Consentimiento para WhatsApp"
                          disabled={readOnly}
                        />
                        <FieldDescription>
                          Sin consentimiento explícito solo se permiten avisos
                          transaccionales; si dice que no, no se envía ningún
                          mensaje.
                        </FieldDescription>
                      </Field>
                    </div>
                  </section>
                </div>
              </Card.Content>
            </Card>

            <Card className={styles.sectionCard}>
              <Card.Header className={styles.sectionHeader}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Card.Title className={styles.sectionTitle}>
                      <ContactRoundIcon aria-hidden /> Contactos
                    </Card.Title>
                    <Card.Description>
                      Podés registrar uno o más contactos y definir cuál será el
                      principal para la relación comercial.
                    </Card.Description>
                  </div>
                  {!readOnly ? (
                    <Button
                      isDisabled={readOnly}
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onPress={addContacto}
                    >
                      <UserRoundPlusIcon data-icon="inline-start" />
                      Agregar contacto
                    </Button>
                  ) : null}
                </div>
              </Card.Header>
              <Card.Content className={styles.sectionBody}>
                {contactos.length === 0 ? (
                  <Empty className={brand.empty}>
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
                    selectedKey={activeContactoId}
                    onSelectionChange={(value) => {
                      if (value) {
                        setActiveContactoId(String(value));
                      }
                    }}
                  >
                    <NavigationTabList
                      label="Contactos del cliente"
                      items={contactos.map((contacto, index) => ({
                        id: contacto.id,
                        label: contacto.nombre || `Contacto ${index + 1}`,
                        icon: contacto.principal ? (
                          <StarIcon className={styles.primaryStar} />
                        ) : (
                          <UserRoundIcon />
                        ),
                      }))}
                    />

                    {contactos.map((contacto, index) => (
                      <Tabs.Panel key={contacto.id} id={contacto.id}>
                        {activeContactoId === contacto.id ? (
                          <Card className={styles.resourceCard}>
                            <Card.Header className={styles.sectionHeader}>
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center gap-2">
                                  <Card.Title className={styles.sectionTitle}>
                                    {contacto.nombre || `Contacto ${index + 1}`}
                                  </Card.Title>
                                  {contacto.principal ? (
                                    <Chip
                                      size="sm"
                                      color="accent"
                                      variant="soft"
                                    >
                                      <StarIcon
                                        data-icon="inline-start"
                                        className={styles.primaryStar}
                                      />
                                      Principal
                                    </Chip>
                                  ) : null}
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  {!contacto.principal ? (
                                    <Button
                                      isDisabled={readOnly}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onPress={() =>
                                        setPrimaryContacto(contacto.id)
                                      }
                                    >
                                      Definir principal
                                    </Button>
                                  ) : null}
                                  <Button
                                    isDisabled={readOnly}
                                    type="button"
                                    variant="danger-soft"
                                    size="sm"
                                    onPress={() => removeContacto(contacto.id)}
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
                                    htmlFor={`contacto-nombre-${contacto.id}`}
                                  >
                                    Nombre completo
                                  </FieldLabel>
                                  <Input
                                    className={focus.singleBorder}
                                    id={`contacto-nombre-${contacto.id}`}
                                    value={contacto.nombre}
                                    onChange={(event) =>
                                      updateContacto(
                                        contacto.id,
                                        "nombre",
                                        event.target.value
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
                                    className={focus.singleBorder}
                                    id={`contacto-cargo-${contacto.id}`}
                                    value={contacto.cargo}
                                    onChange={(event) =>
                                      updateContacto(
                                        contacto.id,
                                        "cargo",
                                        event.target.value
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
                                    className={focus.singleBorder}
                                    id={`contacto-email-${contacto.id}`}
                                    type="email"
                                    value={contacto.email}
                                    onChange={(event) =>
                                      updateContacto(
                                        contacto.id,
                                        "email",
                                        event.target.value
                                      )
                                    }
                                    placeholder="mail@empresa.com"
                                  />
                                </Field>

                                <FieldGroup className={styles.phoneGrid}>
                                  <Field>
                                    <FieldLabel
                                      htmlFor={`contacto-codigo-${contacto.id}`}
                                    >
                                      Código de país
                                    </FieldLabel>
                                    <SelectField
                                      options={phoneCodeItems}
                                      value={contacto.telefonoCodigo}
                                      onChange={(value) => {
                                        if (!value) {
                                          return;
                                        }

                                        updateContacto(
                                          contacto.id,
                                          "telefonoCodigo",
                                          value
                                        );
                                      }}
                                      id={`contacto-codigo-${contacto.id}`}
                                      aria-label="Código de país"
                                      disabled={readOnly}
                                    />
                                  </Field>

                                  <Field>
                                    <FieldLabel
                                      htmlFor={`contacto-telefono-${contacto.id}`}
                                    >
                                      Teléfono
                                    </FieldLabel>
                                    <Input
                                      className={focus.singleBorder}
                                      id={`contacto-telefono-${contacto.id}`}
                                      inputMode="tel"
                                      value={contacto.telefonoNumero}
                                      onChange={(event) =>
                                        updateContacto(
                                          contacto.id,
                                          "telefonoNumero",
                                          event.target.value
                                        )
                                      }
                                      placeholder="Número del contacto"
                                    />
                                    <FieldDescription>
                                      WhatsApp:{" "}
                                      {formatWhatsappPhone(
                                        contacto.telefonoCodigo,
                                        contacto.telefonoNumero
                                      ) || "Sin definir"}
                                    </FieldDescription>
                                  </Field>
                                </FieldGroup>
                              </FieldGroup>
                            </Card.Content>
                          </Card>
                        ) : null}
                      </Tabs.Panel>
                    ))}
                  </Tabs>
                )}
              </Card.Content>
            </Card>

            <Card className={styles.sectionCard}>
              <Card.Header className={styles.sectionHeader}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Card.Title className={styles.sectionTitle}>
                      <MapPinHouseIcon aria-hidden /> Direcciones
                    </Card.Title>
                    <Card.Description>
                      Registrá múltiples direcciones y marcá una como principal
                      para uso operativo.
                    </Card.Description>
                  </div>
                  {!readOnly ? (
                    <Button
                      isDisabled={readOnly}
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onPress={addDireccion}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Agregar dirección
                    </Button>
                  ) : null}
                </div>
              </Card.Header>
              <Card.Content className={styles.sectionBody}>
                {direcciones.length === 0 ? (
                  <Empty className={brand.empty}>
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
                    selectedKey={activeDireccionId}
                    onSelectionChange={(value) => {
                      if (value) {
                        setActiveDireccionId(String(value));
                      }
                    }}
                  >
                    <NavigationTabList
                      label="Direcciones del cliente"
                      items={direcciones.map((direccion, index) => ({
                        id: direccion.id,
                        label:
                          direccion.descripcion || `Dirección ${index + 1}`,
                        icon: direccion.principal ? (
                          <StarIcon className={styles.primaryStar} />
                        ) : (
                          <MapPinHouseIcon />
                        ),
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
                                    <Chip
                                      size="sm"
                                      color="accent"
                                      variant="soft"
                                    >
                                      <StarIcon
                                        data-icon="inline-start"
                                        className={styles.primaryStar}
                                      />
                                      Principal
                                    </Chip>
                                  ) : null}
                                  <Chip size="sm" variant="soft">
                                    <MapPinHouseIcon data-icon="inline-start" />
                                    {
                                      addressTypeItems.find(
                                        (item) => item.value === direccion.tipo
                                      )?.label
                                    }
                                  </Chip>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  {!direccion.principal ? (
                                    <Button
                                      isDisabled={readOnly}
                                      type="button"
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
                                    type="button"
                                    variant="danger-soft"
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
                                    Descripcion
                                  </FieldLabel>
                                  <Input
                                    className={focus.singleBorder}
                                    id={`direccion-descripcion-${direccion.id}`}
                                    value={direccion.descripcion}
                                    onChange={(event) =>
                                      updateDireccion(
                                        direccion.id,
                                        "descripcion",
                                        event.target.value
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
                                        value
                                      );
                                    }}
                                    id={`direccion-tipo-${direccion.id}`}
                                    aria-label="Tipo"
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
                                        value
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
                                        event.target.value
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
                                        event.target.value
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
                                        event.target.value
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
                                        event.target.value
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
                )}
              </Card.Content>
            </Card>
          </fieldset>
        </Tabs.Panel>

        {mode !== "create" && puedeConsultarPuntos ? (
          <Tabs.Panel id="fidelizacion" className={styles.tabPanel}>
            <ClienteFidelizacionCard
              clienteId={cliente.id}
              puedeAjustar={puedeAjustarPuntos && conFidelizacion}
            />
          </Tabs.Panel>
        ) : null}

        {mode !== "create" ? (
          <Tabs.Panel id="historial" className={styles.tabPanel}>
            <Card className={styles.sectionCard}>
              <Card.Header className={styles.sectionHeader}>
                <Card.Title className={styles.sectionTitle}>
                  Actividad de la ficha
                </Card.Title>
                <Card.Description>
                  Últimos cambios registrados con fecha y responsable.
                </Card.Description>
              </Card.Header>
              <Card.Content className={styles.sectionBody}>
                {cliente.eventos.length === 0 ? (
                  <Empty className={brand.empty}>
                    <EmptyHeader>
                      <EmptyTitle>Sin actividad registrada</EmptyTitle>
                      <EmptyDescription>
                        Los próximos cambios quedarán visibles en esta sección.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ul className={`${styles.historyList} ${brand.historyList}`}>
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
              </Card.Content>
            </Card>
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </form>
  );
}
