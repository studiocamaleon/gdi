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
import {
  Card,
  Chip as Badge,
  Description as FieldDescription,
  Input,
  Label as FieldLabel,
  Tabs,
} from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SelectField } from "@/components/design-system/select-field";
import { useDesignScope } from "@/components/design-system/appearance";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./proveedores.module.css";
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
  const scope = useDesignScope();
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
    <section
      {...scope}
      className={`${theme.theme} ${listPage.page} ${styles.ficha}`}
    >
      <div className={styles.sections}>
        <header className={listPage.header}>
          <div className={styles.fichaTitle}>
            <ActionLink
              href="/proveedores"
              onNavigate={confirmNavigation}
              variant="ghost"
              className={styles.backLink}
            >
              <ArrowLeftIcon size={16} aria-hidden />
              Volver a proveedores
            </ActionLink>
            <div className={styles.actions}>
              <h1>
                {mode === "create"
                  ? "Nuevo proveedor"
                  : readOnly
                    ? "Proveedor"
                    : "Ficha de proveedor"}
              </h1>
              {!proveedor.activo ? (
                <Badge size="sm" variant="secondary">
                  Inhabilitado
                </Badge>
              ) : null}
              {readOnly ? (
                <Badge size="sm" variant="secondary">
                  Solo lectura
                </Badge>
              ) : null}
            </div>
            <p className={listPage.subtitle}>
              Consolidá los datos principales del proveedor, sus contactos y sus
              direcciones operativas en una sola vista de trabajo.
            </p>
          </div>
          {!readOnly ? (
            <Button onPress={handleSave} isDisabled={isSaving}>
              {isSaving ? <GdiSpinner /> : <SaveIcon size={16} aria-hidden />}
              {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
            </Button>
          ) : null}
        </header>
        {errorMessage ? (
          <Card className={styles.errorBanner} role="alert">
            <CircleAlertIcon size={20} aria-hidden />
            <div>
              <strong>No se pudieron guardar los cambios</strong>
              <p>{errorMessage}</p>
            </div>
          </Card>
        ) : null}

        <fieldset disabled={readOnly} className={styles.sections}>
          <Card className={styles.sectionCard}>
            <Card.Header className={styles.sectionHeader}>
              <Card.Title className={styles.sectionTitle}>
                Datos generales
              </Card.Title>
              <Card.Description>
                Definí la información base del proveedor y el teléfono principal
                en formato compatible con WhatsApp.
              </Card.Description>
            </Card.Header>
            <Card.Content className={styles.sectionBody}>
              <div className={styles.dataSections}>
                <section>
                  <h3 className={styles.groupHeading}>Identificación</h3>
                  <FieldGroup className={styles.formGrid}>
                    <Field data-invalid={Boolean(fieldErrors.nombre)}>
                      <FieldLabel htmlFor="proveedor-nombre">
                        Nombre del proveedor
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
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
                        className={focus.singleBorder}
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
                  </FieldGroup>
                </section>
                <section>
                  <h3 className={styles.groupHeading}>
                    Datos fiscales y de pago
                  </h3>
                  <FieldGroup className={styles.formGrid}>
                    {/* Datos para PAGARLE. Sin esto, el proveedor sirve para
                referenciar materiales pero no para cargar su factura ni
                emitirle un pago. Ver docs/egresos-y-cuentas-por-pagar-diseno.md */}
                    <Field data-invalid={Boolean(fieldErrors.cuit)}>
                      <FieldLabel htmlFor="proveedor-cuit">CUIT</FieldLabel>
                      <Input
                        className={focus.singleBorder}
                        id="proveedor-cuit"
                        value={datosGenerales.cuit}
                        onChange={(event) =>
                          setDatosGenerales((current) => ({
                            ...current,
                            cuit: event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 11),
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
                      <SelectField
                        options={CONDICIONES_IVA}
                        value={datosGenerales.condicionIva}
                        onChange={(value) =>
                          setDatosGenerales((current) => ({
                            ...current,
                            condicionIva: value ?? "",
                          }))
                        }
                        id="proveedor-condicion-iva"
                        aria-label="Condición frente al IVA"
                        disabled={readOnly}
                      />
                    </Field>

                    <Field
                      data-invalid={Boolean(fieldErrors.condicionPagoDias)}
                    >
                      <FieldLabel htmlFor="proveedor-plazo">
                        Condicion de pago (dias)
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
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
                      <FieldLabel htmlFor="proveedor-cbu">
                        CBU o alias
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
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
                  </FieldGroup>
                </section>
                <section>
                  <h3 className={styles.groupHeading}>Contacto principal</h3>
                  <FieldGroup className={styles.formGrid}>
                    <Field data-invalid={Boolean(fieldErrors.email)}>
                      <FieldLabel htmlFor="proveedor-email">
                        Correo electronico principal
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
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
                        id="proveedor-pais"
                        aria-label="País"
                        disabled={readOnly}
                      />
                    </Field>

                    <FieldGroup
                      className={`${styles.phoneGrid} ${styles.wideField}`}
                    >
                      <Field data-invalid={Boolean(fieldErrors.telefono)}>
                        <FieldLabel htmlFor="telefono-codigo">
                          Codigo pais
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

                      <Field data-invalid={Boolean(fieldErrors.telefono)}>
                        <FieldLabel htmlFor="telefono-numero">
                          Telefono principal
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
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
                </section>
              </div>
            </Card.Content>
          </Card>

          <Card className={styles.sectionCard}>
            <Card.Header className={styles.sectionHeader}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Card.Title className={styles.sectionTitle}>
                    Contactos
                  </Card.Title>
                  <Card.Description>
                    Puedes registrar uno o mas contactos y definir cual sera el
                    principal para la relacion comercial.
                  </Card.Description>
                </div>
                <Button
                  isDisabled={readOnly}
                  variant="outline"
                  className="w-full sm:w-auto"
                  onPress={addContacto}
                >
                  <UserRoundPlusIcon data-icon="inline-start" />
                  Agregar contacto
                </Button>
              </div>
            </Card.Header>
            <Card.Content className={styles.sectionBody}>
              <Tabs
                selectedKey={activeContactoId}
                onSelectionChange={(value) => {
                  if (value) {
                    setActiveContactoId(String(value));
                  }
                }}
              >
                <NavigationTabList
                  label="Contactos del proveedor"
                  items={contactos.map((contacto, index) => ({
                    id: contacto.id,
                    label: contacto.nombre || `Contacto ${index + 1}`,
                    icon: contacto.principal ? (
                      <StarIcon className={styles.primaryStar} />
                    ) : undefined,
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
                                <Badge size="sm" variant="secondary">
                                  <StarIcon
                                    data-icon="inline-start"
                                    className={styles.primaryStar}
                                  />
                                  Principal
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              {!contacto.principal ? (
                                <Button
                                  isDisabled={readOnly}
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
                                variant="outline"
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
                                className={focus.singleBorder}
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
                                className={focus.singleBorder}
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
                                className={focus.singleBorder}
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

                            <FieldGroup className={styles.phoneGrid}>
                              <Field>
                                <FieldLabel
                                  htmlFor={`contacto-codigo-${contacto.id}`}
                                >
                                  Codigo pais
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
                                      value,
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
                                  Telefono
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
                        </Card.Content>
                      </Card>
                    ) : null}
                  </Tabs.Panel>
                ))}
              </Tabs>
            </Card.Content>
          </Card>

          <Card className={styles.sectionCard}>
            <Card.Header className={styles.sectionHeader}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Card.Title className={styles.sectionTitle}>
                    Direcciones
                  </Card.Title>
                  <Card.Description>
                    Registra multiples direcciones y marca una como principal
                    para uso operativo.
                  </Card.Description>
                </div>
                <Button
                  isDisabled={readOnly}
                  variant="outline"
                  className="w-full sm:w-auto"
                  onPress={addDireccion}
                >
                  <PlusIcon data-icon="inline-start" />
                  Agregar direccion
                </Button>
              </div>
            </Card.Header>
            <Card.Content className={styles.sectionBody}>
              <Tabs
                selectedKey={activeDireccionId}
                onSelectionChange={(value) => {
                  if (value) {
                    setActiveDireccionId(String(value));
                  }
                }}
              >
                <NavigationTabList
                  label="Direcciones del proveedor"
                  items={direcciones.map((direccion, index) => ({
                    id: direccion.id,
                    label: direccion.descripcion || `Direccion ${index + 1}`,
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
                                  `Direccion ${index + 1}`}
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
                              {direccion.tipo !== "principal" ? (
                                <Badge size="sm" variant="secondary">
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
                                onPress={() => removeDireccion(direccion.id)}
                              >
                                <Trash2Icon data-icon="inline-start" />
                                Quitar
                              </Button>
                            </div>
                          </div>
                        </Card.Header>
                        <Card.Content className={styles.sectionBody}>
                          <FieldGroup className={styles.formGrid}>
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
                              <SelectField
                                options={addressTypeItems}
                                value={direccion.tipo}
                                onChange={(value) => {
                                  if (!value) {
                                    return;
                                  }

                                  updateDireccion(direccion.id, "tipo", value);
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
                                Pais
                              </FieldLabel>
                              <SelectField
                                options={countryItems}
                                value={direccion.pais}
                                onChange={(value) => {
                                  if (!value) {
                                    return;
                                  }

                                  updateDireccion(direccion.id, "pais", value);
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
                                Codigo postal
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
                                Numero
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
                                placeholder="Numero o piso"
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
        </fieldset>

        {mode !== "create" ? (
          <Card className={styles.sectionCard}>
            <Card.Header className={styles.sectionHeader}>
              <Card.Title className={styles.sectionTitle}>
                <HistoryIcon />
                Actividad reciente
              </Card.Title>
              <Card.Description>
                Historial de altas, cambios y estados del proveedor.
              </Card.Description>
            </Card.Header>
            <Card.Content className={styles.sectionBody}>
              {proveedor.eventos.length > 0 ? (
                <ol className={styles.historyList}>
                  {proveedor.eventos.map((evento) => (
                    <li key={evento.id} className={styles.historyItem}>
                      <div className="flex items-center gap-2">
                        <Badge size="sm" variant="secondary">
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
            </Card.Content>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
