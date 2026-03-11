"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, LogInIcon } from "lucide-react";

import { login } from "@/lib/auth";
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

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, startSubmitting] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    startSubmitting(async () => {
      try {
        const response = await login(email.trim(), password);

        if (response.accessToken) {
          setSessionToken(response.accessToken);
        }

        router.replace("/");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo iniciar sesion.",
        );
      }
    });
  };

  return (
    <Card className="w-full max-w-md rounded-3xl border-border/70 shadow-xl">
      <CardHeader className="gap-2">
        <CardTitle className="text-2xl">Ingresar al ERP</CardTitle>
        <CardDescription>
          Usa tu correo de acceso y la clave definida para la empresa que te
          invito.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="login-email">Correo</FieldLabel>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="login-password">Clave</FieldLabel>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 8 caracteres"
                autoComplete="current-password"
              />
              <FieldDescription>
                Si todavia no definiste clave, usa la invitacion recibida.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}

          <Button type="submit" variant="brand" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircleIcon className="animate-spin" /> : <LogInIcon />}
            Ingresar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
