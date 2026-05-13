import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CrearPrecioEspecialClienteDto {
  @IsUUID()
  clienteId!: string;

  /**
   * Configuración del precio especial — mismo schema que Producto.precioConfigJson:
   * { metodoCalculo: MetodoPrecio, detalle: Record<string, unknown> }.
   */
  @IsObject()
  @IsNotEmpty()
  configJson!: Record<string, unknown>;
}

export class ActualizarPrecioEspecialClienteDto {
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
