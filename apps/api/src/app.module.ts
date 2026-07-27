import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { ImpersonacionGuard } from './auth/impersonacion.guard';
import { RolesGuard } from './auth/roles.guard';
import { PermisosGuard } from './auth/permisos.guard';
import { MargenesInterceptor } from './auth/margenes.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { CostosModule } from './costos/costos.module';
import { GastosFijosModule } from './gastos-fijos/gastos-fijos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MaquinariaModule } from './maquinaria/maquinaria.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { TenantsModule } from './tenants/tenants.module';
import { PlataformaModule } from './plataforma/plataforma.module';
import { InventarioModule } from './inventario/inventario.module';
import { ProduccionModule } from './produccion/produccion.module';
import { ProductosServiciosModule } from './productos-servicios/productos-servicios.module';
import { MotorUniversalModule } from './motor-universal/motor.module';
import { OrdenesTrabajoModule } from './ordenes-trabajo/ordenes-trabajo.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { AdministracionModule } from './administracion/administracion.module';
import { EgresosModule } from './egresos/egresos.module';
import { ReportesModule } from './reportes/reportes.module';
import { EtaModule } from './eta/eta.module';
import { ArchivosModule } from './archivos/archivos.module';
import { IntegracionesModule } from './integraciones/integraciones.module';
import { CobroModule } from './cobro/cobro.module';
import { SuscripcionesModule } from './suscripciones/suscripciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ??
          (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              },
        // No filtrar tokens/cookies a los logs.
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id =
            (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    TenantsModule,
    PlataformaModule,
    CobroModule,
    SuscripcionesModule,
    ClientesModule,
    EmpleadosModule,
    UsuariosModule,
    ProveedoresModule,
    CostosModule,
    GastosFijosModule,
    MaquinariaModule,
    InventarioModule,
    ProduccionModule,
    ProductosServiciosModule,
    MotorUniversalModule,
    OrdenesTrabajoModule,
    PresupuestosModule,
    AdministracionModule,
    EgresosModule,
    ReportesModule,
    EtaModule,
    ArchivosModule,
    IntegracionesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    // Poda la plata de las respuestas marcadas con @OcultaMargenes cuando el
    // usuario no puede verla. Ver auth/margenes.ts.
    {
      provide: APP_INTERCEPTOR,
      useClass: MargenesInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ImpersonacionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Último: cuando corre, `auth.permisos` ya está resuelto. Deniega por
    // defecto — ver permisos.guard.ts.
    {
      provide: APP_GUARD,
      useClass: PermisosGuard,
    },
  ],
})
export class AppModule {}
