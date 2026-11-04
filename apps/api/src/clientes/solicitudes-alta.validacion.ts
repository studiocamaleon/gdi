import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { normalizarTelefonoCliente } from '../common/telefono-cliente';
import { normalizarRut } from '../common/rut';
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
export function validarSolicitud(dto: SolicitudAltaDto, pais = 'AR') {
  const chileno = pais === 'CL';
  if (chileno !== (dto.documentoTipo === 'RUT')) {
    throw new BadRequestException(
      chileno ? 'Ingresá tu RUT.' : 'Ingresá DNI o CUIT/CUIL.',
    );
  }
  const documentoNumero = chileno
    ? normalizarRut(dto.documentoNumero)
    : dto.documentoNumero.replace(/\D/g, '');
  if (!documentoNumero) {
    throw new BadRequestException(
      chileno
        ? 'Revisá el RUT y su dígito verificador.'
        : 'Revisá el DNI o CUIT/CUIL ingresado.',
    );
  }
  if (!chileno) {
    if (
      /[kK]/.test(dto.documentoNumero) ||
      (dto.documentoTipo === 'CUIT'
        ? !/^(20|23|24|27|30|33|34)\d{9}$/.test(documentoNumero) ||
          !cuitValido(documentoNumero)
        : !/^[1-9]\d{6,8}$/.test(documentoNumero))
    ) {
      throw new BadRequestException('Revisá el DNI o CUIT/CUIL ingresado.');
    }
    if (
      !dto.condicionFiscal ||
      (dto.documentoTipo === 'DNI' &&
        dto.condicionFiscal !== 'consumidor_final')
    ) {
      throw new BadRequestException(
        'Revisá la condición fiscal y el documento ingresado.',
      );
    }
  } else if (
    dto.condicionFiscal &&
    dto.condicionFiscal !== 'consumidor_final'
  ) {
    throw new BadRequestException(
      'La condición fiscal argentina no corresponde a esta solicitud.',
    );
  }
  const telefono = normalizarTelefonoCliente('', dto.telefono, pais);
  if (!telefono.ok || !telefono.telefonoNumero)
    throw new BadRequestException(
      'Ingresá un teléfono válido con código de área.',
    );
  return {
    nombre: dto.nombre,
    documentoTipo: dto.documentoTipo,
    documentoNumero,
    condicionFiscal: dto.condicionFiscal ?? 'consumidor_final',
    telefono: `+${telefono.telefonoCodigo}${telefono.telefonoNumero}`,
    direccion: dto.direccion,
    ciudad: dto.ciudad,
  };
}
