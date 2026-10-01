import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecretosService,
  type SecretoCifrado,
} from '../integraciones/cripto/secretos.service';
import { validarCertificadoArca } from './certificado-arca';

export type AmbienteArca = 'dev' | 'prod';
export type MaterialArca = {
  cert: string;
  key: string;
  revision: string;
  cuit: string;
};
export const ambienteArca = (): AmbienteArca =>
  process.env.AFIPSDK_ENVIRONMENT === 'prod' ? 'prod' : 'dev';

const metadataSelect = {
  ambiente: true,
  cuit: true,
  huella: true,
  validoDesde: true,
  validoHasta: true,
  revision: true,
  actualizadoEl: true,
} as const;

@Injectable()
export class CredencialesArcaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretos: SecretosService,
  ) {}

  async estado() {
    const ambiente = ambienteArca();
    const certificado = await this.prisma.credencialFiscalPlataforma.findUnique(
      { where: { ambiente }, select: metadataSelect },
    );
    return {
      ambiente,
      proveedorConfigurado: !!process.env.AFIPSDK_ACCESS_TOKEN?.trim(),
      cifradoDisponible: this.secretos.disponible,
      certificado,
      vigente:
        !!certificado &&
        certificado.validoDesde.getTime() <= Date.now() &&
        certificado.validoHasta.getTime() > Date.now(),
    };
  }

  async representanteCuit(): Promise<string | null> {
    const fila = await this.prisma.credencialFiscalPlataforma.findUnique({
      where: { ambiente: ambienteArca() },
      select: { cuit: true },
    });
    return (
      fila?.cuit ??
      (ambienteArca() === 'dev'
        ? process.env.AFIP_REPRESENTANTE_CUIT?.trim() || null
        : null)
    );
  }

  async guardar(
    staffUserId: string,
    entrada: {
      ambiente: AmbienteArca;
      certificado: string;
      clavePrivada: string;
      revisionAnterior: string | null;
    },
  ) {
    if (entrada.ambiente !== ambienteArca())
      throw new ConflictException(
        'El ambiente fiscal cambió. Volvé a cargar la pantalla.',
      );
    if (!this.secretos.disponible)
      throw new ServiceUnavailableException(
        'Primero hay que configurar el cifrado de integraciones.',
      );
    const validado = validarCertificadoArca(
      entrada.certificado,
      entrada.clavePrivada,
    );
    const revision = randomUUID();
    const datos = {
      cuit: validado.cuit,
      huella: validado.huella,
      validoDesde: validado.desde,
      validoHasta: validado.hasta,
      revision,
      materialCifrado: this.secretos.cifrar(
        JSON.stringify({
          cert: entrada.certificado,
          key: entrada.clavePrivada,
        }),
        this.contexto(entrada.ambiente, revision),
      ) as unknown as Prisma.InputJsonValue,
    };
    try {
      await this.prisma.$transaction(async (tx) => {
        if (entrada.revisionAnterior) {
          const cambio = await tx.credencialFiscalPlataforma.updateMany({
            where: {
              ambiente: entrada.ambiente,
              revision: entrada.revisionAnterior,
            },
            data: datos,
          });
          if (cambio.count !== 1)
            throw new ConflictException(
              'Otro administrador cambió el certificado. Recargá antes de reemplazarlo.',
            );
        } else {
          await tx.credencialFiscalPlataforma.create({
            data: { ambiente: entrada.ambiente, ...datos },
          });
        }
        await tx.plataformaEvento.create({
          data: {
            staffUserId,
            tipo: 'certificado_arca_actualizado',
            descripcion: `Certificado ARCA ${entrada.ambiente} actualizado.`,
            datosJson: {
              ambiente: entrada.ambiente,
              revision,
              huella: validado.huella,
              validoHasta: validado.hasta.toISOString(),
            },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Ya hay un certificado cargado. Recargá antes de reemplazarlo.',
        );
      throw error;
    }
    return this.estado();
  }

  /** Sólo para el adaptador del proveedor. Ningún controller devuelve este resultado. */
  async material(ambiente: AmbienteArca): Promise<MaterialArca | null> {
    const fila = await this.prisma.credencialFiscalPlataforma.findUnique({
      where: { ambiente },
    });
    if (!fila) {
      if (ambiente === 'prod')
        throw new ServiceUnavailableException(
          'Cargá el certificado de producción en Plataforma antes de facturar.',
        );
      return null;
    }
    try {
      const par = JSON.parse(
        this.secretos.descifrar(
          fila.materialCifrado as SecretoCifrado,
          this.contexto(ambiente, fila.revision),
        ),
      ) as { cert: string; key: string };
      const validado = validarCertificadoArca(par.cert, par.key);
      if (validado.cuit !== fila.cuit || validado.huella !== fila.huella)
        throw new Error('Metadatos inválidos');
      return { ...par, cuit: fila.cuit, revision: fila.revision };
    } catch {
      throw new ServiceUnavailableException(
        'El certificado ARCA está vencido o no se puede utilizar. Revisalo en Plataforma.',
      );
    }
  }

  private contexto(ambiente: string, revision: string) {
    return `grafo:arca:plataforma:${ambiente}:${revision}`;
  }
}
