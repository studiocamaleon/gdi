import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class ConectarWatiDto {
  /**
   * `https://live-mt-server.wati.io`. Se acepta con o sin el tenant id
   * pegado al final (el dashboard lo muestra así) — el cliente lo normaliza.
   */
  @IsString()
  @MaxLength(200)
  @Matches(/^https?:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/, {
    message: 'El endpoint tiene que ser una URL.',
  })
  // El `http` se acepta acá y se rechaza más abajo (ver `exigirHttps`): la
  // única razón para permitirlo es apuntar a un Wati simulado en localhost
  // durante el desarrollo. Mandar un Bearer token en claro por la red es
  // exactamente lo que no queremos, así que la regla vive en un solo lugar y
  // no depende de que esta expresión regular esté bien escrita.
  endpoint!: string;

  /** El "Client ID" del dashboard de Wati. */
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^\d+$/, { message: 'El Tenant ID de Wati es numérico.' })
  tenantId!: string;

  /** Bearer token, SIN el prefijo "Bearer ". */
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  token!: string;
}
