import { SetMetadata } from '@nestjs/common';
import type { PermisoClave } from './permisos';

export const PERMISO_KEY = 'permisoRequerido';
export const SOLO_AUTENTICADO_KEY = 'soloAutenticado';

/**
 * Exige un permiso para entrar al endpoint (o a todo el controller).
 *
 * Se anota a nivel CONTROLLER por defecto —26 líneas cubren 301 endpoints— y se
 * baja a método sólo donde un módulo mezcla lecturas de todos con escrituras de
 * pocos. Un `@Permiso` en el método pisa al del controller.
 *
 * `gestionar` implica `ver`, así que pedir `costos.ver` deja pasar también a
 * quien puede gestionarlos. Ver docs/usuarios-roles-permisos-diseno.md
 */
export const Permiso = (permiso: PermisoClave) => SetMetadata(PERMISO_KEY, permiso);

/**
 * Declara que basta con estar autenticado: no hay permiso que aplique.
 *
 * Existe porque el guard DENIEGA por defecto. Un endpoint sin anotar es un
 * olvido, no una decisión, y la única forma de distinguirlos es que la decisión
 * se escriba. Es para lo que todo usuario tiene que poder hacer sin importar su
 * rol: leer su propia sesión, cambiar su contraseña, cerrar sesión.
 */
export const SoloAutenticado = () => SetMetadata(SOLO_AUTENTICADO_KEY, true);
