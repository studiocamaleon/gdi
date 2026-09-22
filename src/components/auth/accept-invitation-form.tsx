"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { acceptInvitation, type InvitationState } from "@/lib/auth";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { setSessionToken } from "@/lib/session";
import { ActionButton } from "@/components/design-system/action-button";
import styles from "@/components/plataforma/seguridad-backoffice.module.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type AcceptInvitationFormProps = {
  invitation: InvitationState;
  token: string;
};

export function AcceptInvitationForm({
  invitation,
  token,
}: AcceptInvitationFormProps) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, startSubmitting] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    startSubmitting(async () => {
      try {
        const response = await acceptInvitation(
          token,
          invitation.requiresPasswordSetup ? password : undefined,
        );

        if ("requiereLogin" in response) {
          router.replace("/login");
          return;
        }

        if (response.accessToken) {
          await setSessionToken(response.accessToken);
        }

        router.replace("/");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo aceptar la invitacion.",
        );
      }
    });
  };

  return (
    <>
      <header className={styles.intro}>
        <span>TU INVITACIÓN</span>
        <h1>
          Activá tu acceso<span>.</span>
        </h1>
        <p>
          Vas a ingresar a <strong>{invitation.tenantNombre}</strong> con el rol{" "}
          <strong>{invitation.rol}</strong>.
        </p>
      </header>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invitation-email">Correo</FieldLabel>
            <Input id="invitation-email" value={invitation.email} disabled />
          </Field>

          {invitation.requiresPasswordSetup ? (
            <Field>
              <FieldLabel htmlFor="invitation-password">
                Clave inicial
              </FieldLabel>
              <Input
                id="invitation-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Definí tu clave"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <FieldDescription>
                Usá al menos 8 caracteres. Esta clave queda asociada a tu cuenta
                de Grafo.
              </FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel>Usuario existente</FieldLabel>
              <FieldDescription>
                Tu usuario ya tiene clave. Al continuar se agrega esta empresa a
                tu cuenta, sin cambiar tu contraseña.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo activar el acceso</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <ActionButton
          type="submit"
          className="w-full"
          isDisabled={isSubmitting}
        >
          {isSubmitting ? (
            <GdiSpinner className="size-4" />
          ) : (
            <CheckCircle2Icon data-icon="inline-start" />
          )}
          {isSubmitting ? "Activando…" : "Aceptar invitación"}
        </ActionButton>
      </form>
    </>
  );
}
