import { IsIn } from 'class-validator';

export class AvanzarCompraDto {
  /** Nuevo estado de la compra tercerizada. */
  @IsIn(['pendiente', 'pedido', 'recibido', 'entregado'])
  estadoCompra: string;
}
