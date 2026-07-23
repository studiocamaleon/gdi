import { SetMetadata } from '@nestjs/common';

export const SIN_TENANT_KEY = 'sinContextoTenant';

/**
 * Marca un controller (o handler) para que el TenantContextInterceptor NO
 * establezca el contexto de tenant de la sesión: el handler lee A TRAVÉS de
 * los tenants. Espejo de @Public() para el AuthGuard.
 *
 * Es EXCLUSIVO del control plane (docs/control-plane-diseno.md): en una ruta
 * de negocio normal, quitarle el contexto significa quitarle la red de
 * aislamiento. Cualquier uso nuevo fuera de `plataforma/` es sospechoso.
 */
export const SinTenant = () => SetMetadata(SIN_TENANT_KEY, true);
