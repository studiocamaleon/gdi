"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@heroui/react";
import {
  ArrowLeftRight,
  Building2,
  Check,
  Camera,
  KeyRound,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { switchTenant, type CurrentUser } from "@/lib/auth";
import {
  editarPerfil,
  prepararFotoPerfil,
  quitarFotoPerfil,
  subirFotoPerfil,
} from "@/lib/perfil-api";
import { setSessionToken } from "@/lib/session";
import { PerfilMfa } from "./perfil-mfa";
import { UsuarioAvatar } from "./usuario-avatar";
import s from "./perfil-usuario-modal.module.css";

const pestañas = [
  { id: "perfil", label: "Perfil", icon: <UserRound /> },
  { id: "seguridad", label: "Seguridad", icon: <ShieldCheck /> },
  { id: "empresas", label: "Empresas", icon: <Building2 /> },
] as const;

export function PerfilUsuarioModal({
  currentUser,
  onClose,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState("perfil");
  const [nombre, setNombre] = React.useState(currentUser.nombreCompleto ?? "");
  const [nombreGuardado, setNombreGuardado] = React.useState(nombre);
  const [version, setVersion] = React.useState(currentUser.fotoPerfilVersion);
  const [foto, setFoto] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mfaBloquea, setMfaBloquea] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const enviando = React.useRef(false);
  const archivo = React.useRef<HTMLInputElement>(null);
  const impersonando = !!currentUser.impersonacion;
  const cambios =
    Number(nombre.trim() !== nombreGuardado) + Number(foto !== null);
  const bloqueado = busy || mfaBloquea;
  const nombreVisible = nombreGuardado || currentUser.email;

  const elegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegida = e.target.files?.[0];
    e.target.value = "";
    if (!elegida) return;
    setBusy(true);
    setError(null);
    try {
      setFoto(await prepararFotoPerfil(elegida));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo preparar la foto.",
      );
    } finally {
      setBusy(false);
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando.current || !cambios) return;
    enviando.current = true;
    setBusy(true);
    setError(null);
    try {
      if (nombre.trim() !== nombreGuardado) {
        const r = await editarPerfil(nombre.trim());
        setNombreGuardado(r.nombreCompleto);
        setNombre(r.nombreCompleto);
      }
      if (foto !== null) {
        const r =
          foto === "quitar"
            ? await quitarFotoPerfil()
            : await subirFotoPerfil(foto);
        setVersion(r.fotoPerfilVersion);
        setFoto(null);
      }
      toast.success("Tu perfil se actualizó.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el perfil.",
      );
    } finally {
      router.refresh();
      enviando.current = false;
      setBusy(false);
    }
  };

  const cambiarEmpresa = async (tenantId: string) => {
    if (enviando.current || tenantId === currentUser.tenantActual.id) return;
    enviando.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await switchTenant(tenantId);
      if (res.accessToken) await setSessionToken(res.accessToken);
      router.refresh();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cambiar de empresa.",
      );
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  };

  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FormDialog
        isOpen
        onOpenChange={(open) => {
          if (!open && !bloqueado) onClose();
        }}
        title="Tu perfil"
        description="Tu identidad y la protección de tu cuenta en Grafo."
        className={s.modal}
        isDismissable={!bloqueado}
      >
        <div className={s.body}>
          <div className={s.identidad}>
            <UsuarioAvatar nombre={nombreVisible} version={version} grande />
            <div>
              <strong>{nombreVisible}</strong>
              <span>{currentUser.email}</span>
            </div>
          </div>
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => {
              if (!bloqueado) {
                setTab(String(key));
                setError(null);
              }
            }}
            disabledKeys={
              bloqueado
                ? pestañas.filter((p) => p.id !== tab).map((p) => p.id)
                : []
            }
          >
            <NavigationTabList
              className={s.tabs}
              items={pestañas}
              label="Secciones del perfil"
              variant="detailed"
              tone="graphite"
            />
            <Tabs.Panel id="perfil" className={s.panel}>
              <form onSubmit={guardar} className={s.form} aria-busy={busy}>
                {impersonando && (
                  <p className={s.note}>
                    Volvé a tu sesión personal para editar tu perfil.
                  </p>
                )}
                <div className={s.fotoEditor}>
                  <UsuarioAvatar
                    nombre={nombre.trim() || nombreVisible}
                    version={foto === "quitar" ? null : version}
                    preview={
                      foto && foto !== "quitar"
                        ? `data:image/jpeg;base64,${foto}`
                        : null
                    }
                    grande
                  />
                  <div className={s.fotoAcciones}>
                    <div className={s.actions}>
                      <ActionButton
                        variant="outline"
                        isDisabled={busy || impersonando}
                        onPress={() => archivo.current?.click()}
                      >
                        <Camera size={15} />
                        Cambiar foto
                      </ActionButton>
                      {((foto && foto !== "quitar") ||
                        (version && foto !== "quitar")) && (
                        <ActionButton
                          variant="ghost"
                          isIconOnly
                          title="Quitar foto"
                          aria-label="Quitar foto"
                          isDisabled={busy || impersonando}
                          onPress={() => setFoto(version ? "quitar" : null)}
                        >
                          <Trash2 size={15} />
                        </ActionButton>
                      )}
                    </div>
                    <p className={s.note}>JPG, PNG o WEBP. Hasta 10 MB.</p>
                  </div>
                  <input
                    ref={archivo}
                    className={s.hidden}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Elegir foto de perfil"
                    onChange={(e) => void elegirFoto(e)}
                    disabled={busy || impersonando}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="perfil-nombre">Nombre y apellido</label>
                  <input
                    id="perfil-nombre"
                    autoComplete="name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={120}
                    required
                    disabled={busy || impersonando}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="perfil-email">Correo electrónico</label>
                  <input
                    id="perfil-email"
                    type="email"
                    value={currentUser.email}
                    readOnly
                    className={s.readonly}
                  />
                  <p className={s.note}>
                    Es el correo con el que iniciás sesión.
                  </p>
                </div>
                <div className={s.footer}>
                  <ActionButton
                    type="submit"
                    variant="primary"
                    isDisabled={
                      busy || impersonando || !cambios || !nombre.trim()
                    }
                  >
                    <Save size={15} />
                    {busy ? "Guardando…" : "Guardar cambios"}
                    {cambios > 0 && (
                      <span
                        className={s.count}
                        aria-label={`${cambios} ${cambios === 1 ? "cambio" : "cambios"}`}
                      >
                        {cambios}
                      </span>
                    )}
                  </ActionButton>
                </div>
              </form>
            </Tabs.Panel>
            <Tabs.Panel id="seguridad" className={s.panel}>
              {impersonando ? (
                <p className={s.note}>
                  Volvé a tu sesión personal para administrar la seguridad.
                </p>
              ) : (
                <>
                  <div className={s.securityRow}>
                    <div>
                      <h2>Contraseña</h2>
                      <p>Actualizá tu clave de acceso.</p>
                    </div>
                    <ActionButton
                      variant="outline"
                      isDisabled={mfaBloquea}
                      onPress={() => {
                        onClose();
                        router.push("/cambiar-clave");
                      }}
                    >
                      <KeyRound size={15} />
                      Cambiar contraseña
                    </ActionButton>
                  </div>
                  <PerfilMfa onBloqueoChange={setMfaBloquea} />
                </>
              )}
            </Tabs.Panel>
            <Tabs.Panel id="empresas" className={s.panel}>
              <p className={s.note}>
                Tu nombre, foto y protección MFA se mantienen al cambiar de
                empresa.
              </p>
              <div className={s.tenants}>
                {currentUser.tenants.map((tenant) => {
                  const activo = tenant.id === currentUser.tenantActual.id;
                  return (
                    <button
                      key={tenant.id}
                      type="button"
                      className={`${s.tenant} ${activo ? s.tenantOn : ""}`}
                      disabled={busy || activo || impersonando}
                      onClick={() => void cambiarEmpresa(tenant.id)}
                    >
                      <Building2 size={19} />
                      <span className={s.tenantIdentidad}>
                        <strong>{tenant.nombre}</strong>
                        <span>{tenant.rolNombre || tenant.rol}</span>
                      </span>
                      {activo ? (
                        <Check size={17} aria-label="Empresa actual" />
                      ) : (
                        <ArrowLeftRight size={17} />
                      )}
                    </button>
                  );
                })}
              </div>
            </Tabs.Panel>
          </Tabs>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </FormDialog>
    </DesignSystemProvider>
  );
}
