import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones. Mapea errores conocidos de Prisma a códigos
 * HTTP semánticos, loguea con contexto y NUNCA filtra stack traces ni detalles
 * internos de Prisma al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
    }

    const where = `${req.method} ${req.url}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // 5xx: error real, logueamos con stack para diagnóstico.
      this.logger.error(
        `${where} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // 4xx: esperado (validación/negocio), log liviano.
      const text = Array.isArray(message) ? message.join(', ') : message;
      this.logger.warn(`${where} → ${status}: ${text}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
    });
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (error.code) {
      case 'P2002': // unique constraint
        return {
          status: HttpStatus.CONFLICT,
          message: 'Ya existe un registro con esos datos.',
        };
      case 'P2025': // record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'El registro solicitado no existe.',
        };
      case 'P2003': // foreign key constraint
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referencia inválida: el registro relacionado no existe.',
        };
      case 'P2000': // value too long
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Uno de los valores excede el largo permitido.',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'No se pudo completar la operación.',
        };
    }
  }
}
