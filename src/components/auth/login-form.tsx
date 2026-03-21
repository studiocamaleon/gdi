"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { login } from "@/lib/auth";
import { setSessionToken } from "@/lib/session";
import { CmykLoginTransition } from "@/components/auth/cmyk-login-transition";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [isScreenTransitionVisible, setIsScreenTransitionVisible] =
    React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, startSubmitting] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    setIsScreenTransitionVisible(true);

    startSubmitting(async () => {
      try {
        const response = await login(email.trim(), password);

        if (response.accessToken) {
          setSessionToken(response.accessToken);
        }

        router.replace("/");
        router.refresh();
      } catch (error) {
        setIsScreenTransitionVisible(false);
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo iniciar sesion.",
        );
      }
    });
  };

  return (
    <div className="w-full">
      <CmykLoginTransition active={isScreenTransitionVisible} />

      <div className="max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
          Acceso privado
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Iniciar sesion
        </h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Accede con tu correo corporativo y la clave asociada a tu usuario. El sistema
          te redirige a tu entorno activo al validar la sesion.
        </p>
      </div>

      <Separator className="my-8" />

      <form className="flex max-w-md flex-col gap-6" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={Boolean(errorMessage)}>
            <FieldLabel htmlFor="login-email">Correo</FieldLabel>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
              autoComplete="email"
              aria-invalid={Boolean(errorMessage)}
              disabled={isSubmitting}
              className="login-input h-11 border-[oklch(0.88_0.012_80)] bg-[oklch(0.995_0.004_85)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-primary"
            />
          </Field>

          <Field data-invalid={Boolean(errorMessage)}>
            <FieldLabel htmlFor="login-password">Clave</FieldLabel>
            <div className="relative">
              <Input
                id="login-password"
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu clave"
                autoComplete="current-password"
                aria-invalid={Boolean(errorMessage)}
                disabled={isSubmitting}
                className="login-input h-11 border-[oklch(0.88_0.012_80)] bg-[oklch(0.995_0.004_85)] pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-primary"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={isPasswordVisible ? "Ocultar clave" : "Mostrar clave"}
                disabled={isSubmitting}
              >
                {isPasswordVisible ? (
                  <EyeOffIcon data-icon="inline-start" />
                ) : (
                  <EyeIcon data-icon="inline-start" />
                )}
              </Button>
            </div>
            <FieldDescription>
              Si aun no activaste tu acceso, primero debes aceptar la invitacion recibida.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <FieldError>{errorMessage}</FieldError>

        <Button
          type="submit"
          variant="brand"
          className="h-11 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <GdiSpinner className="size-4" />
          ) : (
            <LogInIcon />
          )}
          {isSubmitting ? "Validando acceso..." : "Ingresar"}
        </Button>

        <p className="text-sm leading-6 text-muted-foreground">
          Acceso administrado por invitacion y asignacion de empresa.
        </p>
      </form>
    </div>
  );
}
