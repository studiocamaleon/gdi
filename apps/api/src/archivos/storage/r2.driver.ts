import { Injectable, Logger } from '@nestjs/common';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { calcularTamanioParte } from './multipart';
import type {
  MultipartIniciado,
  ObjetoMeta,
  ParteSubida,
  StorageDriver,
  UrlFirmada,
} from './storage.driver';

const SUBIDA_SEGUNDOS = 15 * 60;
/**
 * 60 s. Alcanza de sobra para que el navegador siga el 302 y empiece la
 * descarga, y hace que una URL copiada de la barra de direcciones ya no sirva
 * cuando alguien la pega en otro lado.
 */
const DESCARGA_SEGUNDOS = 60;

/**
 * Cloudflare R2 vía la API S3. R2 no cobra egress, así que servir por redirect
 * a una URL firmada no tiene costo de banda; lo que ahorra es CPU y RAM del
 * único proceso Nest.
 */
@Injectable()
export class R2Driver implements StorageDriver {
  readonly nombre = 'r2' as const;
  private readonly logger = new Logger(R2Driver.name);
  private readonly cliente: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET!;
    this.cliente = new S3Client({
      region: 'auto',
      endpoint:
        process.env.R2_ENDPOINT ??
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async firmarSubida(
    key: string,
    opciones: { contentType: string; expiraSegundos?: number },
  ): Promise<UrlFirmada> {
    // NO se firma ContentLength a propósito: si el navegador o un proxy
    // intermedio mandara un largo distinto al declarado, R2 devolvería un 403
    // opaco imposible de diagnosticar desde el front. El tamaño real se
    // verifica con un HEAD en el confirmar, que es donde igual hay que creerle
    // al objeto y no al cliente. Ver docs/archivos-r2-diseno.md §D1.
    const comando = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opciones.contentType,
    });
    const expiraEn = opciones.expiraSegundos ?? SUBIDA_SEGUNDOS;
    const url = await getSignedUrl(this.cliente, comando, {
      expiresIn: expiraEn,
    });
    return { url, headers: { 'Content-Type': opciones.contentType }, expiraEn };
  }

  firmarDescarga(
    key: string,
    opciones: {
      disposition: string;
      contentType?: string;
      expiraSegundos?: number;
    },
  ): Promise<string> {
    const comando = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: opciones.disposition,
      ResponseContentType: opciones.contentType,
    });
    return getSignedUrl(this.cliente, comando, {
      expiresIn: opciones.expiraSegundos ?? DESCARGA_SEGUNDOS,
    });
  }

  async subir(
    key: string,
    contenido: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: contenido,
        ContentType: contentType,
        ContentLength: contenido.length,
      }),
    );
  }

  async iniciarMultipart(
    key: string,
    opciones: { contentType: string; bytes: number },
  ): Promise<MultipartIniciado> {
    const { UploadId: uploadId } = await this.cliente.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: opciones.contentType,
      }),
    );
    if (!uploadId) {
      throw new Error(
        'R2 no devolvió uploadId al iniciar la subida en partes.',
      );
    }

    const tamanioParte = calcularTamanioParte(opciones.bytes);
    const cantidad = Math.max(1, Math.ceil(opciones.bytes / tamanioParte));
    const partes = await Promise.all(
      Array.from({ length: cantidad }, (_, i) => i + 1).map(async (numero) => ({
        numero,
        url: await getSignedUrl(
          this.cliente,
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: numero,
          }),
          { expiresIn: SUBIDA_SEGUNDOS },
        ),
      })),
    );
    return { uploadId, partes, tamanioParte };
  }

  async completarMultipart(
    key: string,
    uploadId: string,
    partes: ParteSubida[],
  ): Promise<void> {
    await this.cliente.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          // S3 exige las partes ordenadas por número.
          Parts: [...partes]
            .sort((a, b) => a.numero - b.numero)
            .map((p) => ({ PartNumber: p.numero, ETag: p.etag })),
        },
      }),
    );
  }

  async abortarMultipart(key: string, uploadId: string): Promise<void> {
    try {
      await this.cliente.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (error) {
      if (esNoEncontrado(error)) return;
      throw error;
    }
  }

  async cabecera(key: string): Promise<ObjetoMeta | null> {
    try {
      const r = await this.cliente.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        bytes: Number(r.ContentLength ?? 0),
        contentType: r.ContentType ?? null,
      };
    } catch (error) {
      if (esNoEncontrado(error)) return null;
      throw error;
    }
  }

  async borrar(key: string): Promise<void> {
    try {
      await this.cliente.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (esNoEncontrado(error)) return;
      throw error;
    }
  }

  async leer(key: string): Promise<Buffer | null> {
    try {
      const r = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!r.Body) return null;
      return Buffer.from(await r.Body.transformToByteArray());
    } catch (error) {
      if (esNoEncontrado(error)) return null;
      this.logger.warn(
        `No pude leer ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

function esNoEncontrado(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === 'NotFound' ||
    e?.name === 'NoSuchKey' ||
    e?.$metadata?.httpStatusCode === 404
  );
}
