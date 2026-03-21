"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { acceptInvitation, type InvitationState } from "@/lib/auth";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { setSessionToken } from "@/lib/session";
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

        if (response.accessToken) {
          setSessionToken(response.accessToken);
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
    <Card className="w-full max-w-lg rounded-3xl border-border/70 shadow-xl">
      <CardHeader className="gap-2">
        <CardTitle className="text-2xl">Activar acceso</CardTitle>
        <CardDescription>
          Vas a ingresar a <strong>{invitation.tenantNombre}</strong> con el rol{" "}
          <strong>{invitation.rol}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invitation-email">Correo</FieldLabel>
              <Input id="invitation-email" value={invitation.email} disabled />
            </Field>

            {invitation.requiresPasswordSetup ? (
              <Field>
                <FieldLabel htmlFor="invitation-password">Clave inicial</FieldLabel>
                <Input
                  id="invitation-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Define tu clave"
                  autoComplete="new-password"
                />
                <FieldDescription>
                  Esta clave quedara asociada a tu usuario global.
                </FieldDescription>
              </Field>
            ) : (
              <Field>
                <FieldLabel>Usuario existente</FieldLabel>
                <FieldDescription>
                  Tu usuario ya tiene clave. Al continuar se agregara esta empresa
                  a tu acceso actual.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}

          <Button type="submit" variant="brand" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <GdiSpinner className="size-4" />
            ) : (
              <CheckCircle2Icon />
            )}
            Aceptar invitacion
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
