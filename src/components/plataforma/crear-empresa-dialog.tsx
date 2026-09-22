"use client";

import { useRef, useState } from "react";
import { Input } from "@heroui/react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  crearTenantPlataforma,
  type PlanCatalogo,
  type ResultadoInvitacionEmpresa,
} from "@/lib/plataforma-api";
import { InvitacionEmpresaPanel } from "./invitacion-empresa-panel";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import platform from "./plataforma.module.css";
import styles from "./invitacion-empresa.module.css";

export function CrearEmpresaDialog({
  planes,
  onCerrar,
}: {
  planes: PlanCatalogo[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoInvitacionEmpresa>();
  const enviando = useRef(false);
  const valido =
    nombre.trim().length >= 2 &&
    /^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) &&
    /.+@.+\..+/.test(email) &&
    !!planId;
  const crear = async () => {
    if (!valido || enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError("");
    try {
      const r = await crearTenantPlataforma({
        nombre: nombre.trim(),
        slug,
        planId,
        adminEmail: email.trim(),
      });
      setResultado(r);
      if (r.invitacion.correoEstado === "enviado")
        toast.success("Empresa creada e invitación enviada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la empresa.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  };
  return (
    <FormDialog
      isOpen
      title={resultado ? "Empresa creada" : "Nueva empresa"}
      description={
        resultado
          ? "El acceso del administrador se activa desde la invitación."
          : "Elegí el plan y el correo del administrador. Al crear la empresa, Grafo le envía una invitación que vence en 7 días."
      }
      onOpenChange={(open) => {
        if (!open && !ocupado) onCerrar();
      }}
      isDismissable={!ocupado}
      className={`${theme.theme} ${platform.theme} ${platform.dialog}`}
    >
      <div className={`${styles.body} ${styles.stack}`}>
        {resultado ? (
          <InvitacionEmpresaPanel
            tenantId={resultado.tenantId}
            invitacion={resultado.invitacion}
            enlace={resultado.invitacionUrl}
            puedeEnviar
            onCambio={setResultado}
          />
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="empresa-nombre">
                Nombre de la imprenta
              </FieldLabel>
              <Input
                id="empresa-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="empresa-slug">
                Identificador de la empresa
              </FieldLabel>
              <Input
                id="empresa-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="grafica-del-sur"
                maxLength={41}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="empresa-email">
                Correo del administrador
              </FieldLabel>
              <Input
                id="empresa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="empresa-plan">Plan</FieldLabel>
              <SelectField
                id="empresa-plan"
                aria-label="Plan"
                value={planId}
                onChange={setPlanId}
                options={[
                  { value: "", label: "Elegí un plan…", disabled: true },
                  ...planes.map((p) => ({ value: p.id, label: p.nombre })),
                ]}
              />
            </Field>
          </FieldGroup>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo completar el alta</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className={styles.footer}>
        <ActionButton variant="outline" isDisabled={ocupado} onPress={onCerrar}>
          {resultado ? "Cerrar" : "Cancelar"}
        </ActionButton>
        {!resultado && (
          <ActionButton
            isDisabled={!valido || ocupado}
            onPress={() => void crear()}
          >
            <Mail data-icon="inline-start" />
            {ocupado ? "Creando y enviando…" : "Crear y enviar invitación"}
          </ActionButton>
        )}
      </div>
    </FormDialog>
  );
}
