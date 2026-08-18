import { SetMetadata } from '@nestjs/common';

export const OCULTA_MARGENES_KEY = 'ocultaMargenes';

/**
 * Marca un endpoint (o un controller) cuya respuesta lleva costos, márgenes o
 * contribución: quien no tenga `finanzas.ver_margenes` los recibe SIN eso.
 *
 * Se pone donde la plata viaja de arrastre —el cotizador devuelve el desglose
 * entero, la orden trae el costeo de cada paso— y no en el módulo Costos, donde
 * el costo ES el contenido y el permiso del módulo ya decide quién entra.
 */
export const OcultaMargenes = (ocultar = true) =>
  SetMetadata(OCULTA_MARGENES_KEY, ocultar);
