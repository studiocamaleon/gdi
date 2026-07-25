import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentSession } from '../auth/current-auth.decorator';
import { Permiso } from '../auth/permiso.decorator';
import { CrearUsuarioDto, EditarUsuarioDto } from './usuarios.dto';
import { UsuariosService } from './usuarios.service';
import type { CurrentAuth } from '../auth/auth.types';

/**
 * Configuración → Usuarios: quién entra a la empresa y con qué rol.
 *
 * Leer pide `configuracion.ver` y escribir `configuracion.gestionar`: dar acceso
 * es el permiso más peligroso del sistema —quien puede crear un administrador
 * puede hacer cualquier cosa— así que va con el resto de la configuración y no
 * con los registros del personal.
 */
@Permiso('configuracion.ver')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@CurrentSession() auth: CurrentAuth) {
    return this.usuarios.listar(auth);
  }

  @Get('roles')
  async roles(@CurrentSession() auth: CurrentAuth) {
    // Antes de listar: un tenant nuevo —o uno al que Grafo le sumó un rol al
    // catálogo— los tiene sin que nadie corra un script.
    await this.usuarios.sembrarPredefinidos(auth.tenantId);
    return this.usuarios.listarRoles(auth);
  }

  /** Módulos, permisos y qué incluye el plan: lo que dibuja el editor. */
  @Get('catalogo')
  catalogo(@CurrentSession() auth: CurrentAuth) {
    return this.usuarios.catalogo(auth);
  }

  @Permiso('configuracion.gestionar')
  @Post()
  crear(@CurrentSession() auth: CurrentAuth, @Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(auth, dto);
  }

  @Permiso('configuracion.gestionar')
  @Patch(':userId')
  editar(
    @CurrentSession() auth: CurrentAuth,
    @Param('userId') userId: string,
    @Body() dto: EditarUsuarioDto,
  ) {
    return this.usuarios.editar(auth, userId, dto);
  }
}
