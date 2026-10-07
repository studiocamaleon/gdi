import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cuitValido } from '../common/cuit';
import { SolicitudAltaDto } from './dto/solicitud-alta.dto';

export function dniDeCuit(cuit: string): string | null {
  if (!/^(20|23|24|27)\d{9}$/.test(cuit)) return null;
  return cuit.slice(2, 10).replace(/^0+/, '');
}
export function nombreComparable(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
export function telefonoComparable(telefono: string) {
  return (
    parsePhoneNumberFromString(telefono, 'AR')?.number ??
    telefono.replace(/\D/g, '')
  );
}
export function validarSolicitud(dto: SolicitudAltaDto) {
  const documentoNumero = dto.documentoNumero.replace(/\D/g, '');
  if (
    dto.documentoTipo === 'CUIT'
      ? !/^(20|23|24|27|30|33|34)\d{9}$/.test(documentoNumero) ||
        !cuitValido(documentoNumero)
      : !/^[1-9]\d{6,8}$/.test(documentoNumero)
  )
    throw new BadRequestException('Revisá el DNI o CUIT/CUIL ingresado.');
  if (dto.documentoTipo === 'DNI' && dto.condicionFiscal !== 'consumidor_final')
    throw new BadRequestException(
      'Para esa condición fiscal necesitás ingresar CUIT/CUIL.',
    );
  const telefono = parsePhoneNumberFromString(dto.telefono, 'AR');
  if (!telefono?.isValid())
    throw new BadRequestException(
      'Ingresá un teléfono válido con código de área.',
    );
  return {
    nombre: dto.nombre,
    documentoTipo: dto.documentoTipo,
    documentoNumero,
    condicionFiscal: dto.condicionFiscal,
    telefono: String(telefono.number),
    direccion: dto.direccion,
    ciudad: dto.ciudad,
  };
}
