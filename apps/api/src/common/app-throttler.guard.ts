import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Límite por IP resuelta por Express, antes de autenticar.
 * Authorization todavía es un dato no confiable: usar su hash como cubeta
 * permitiría reiniciar el límite enviando un token distinto en cada pedido.
 * Las cuotas por credencial deben añadirse DESPUÉS de validar la identidad,
 * sin reemplazar esta protección previa (también aplica al acceso MCP).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {}
