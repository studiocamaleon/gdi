import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/app-throttler.guard';
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
import { McpModule } from './mcp/mcp.module';
import { WebhooksWhatsappModule } from './webhooks-whatsapp/webhooks-whatsapp.module';
import { OrdenesTrabajoModule } from './ordenes-trabajo/ordenes-trabajo.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { CuponesModule } from './cupones/cupones.module';
import { AdministracionModule } from './administracion/administracion.module';
import { EgresosModule } from './egresos/egresos.module';
import { ReportesModule } from './reportes/reportes.module';
import { EtaModule } from './eta/eta.module';
import { ArchivosModule } from './archivos/archivos.module';
import { IntegracionesModule } from './integraciones/integraciones.module';
import { CobroModule } from './cobro/cobro.module';
import { SuscripcionesModule } from './suscripciones/suscripciones.module';
import { CentroCopiadoModule } from './centro-copiado/centro-copiado.module';
import { PanelGeneralModule } from './panel-general/panel-general.module';
import { FidelizacionModule } from './fidelizacion/fidelizacion.module';
import { RecorridosVectorialesModule } from './recorridos-vectoriales/recorridos-vectoriales.module';
import { SuscripcionAccesoGuard } from './suscripciones/suscripcion-acceso.guard';
import { ProvisionamientoModule } from './provisionamiento/provisionamiento.module';
import { RegistroModule } from './registro/registro.module';
import { CampanasModule } from './campanas/campanas.module';
import { DesarrolloDocumentalModule } from './desarrollo-documental/desarrollo-documental.module';
import { EventosSistemaModule } from './eventos-sistema/eventos-sistema.module';
import { GeometriaJobsModule } from './workers/geometria/geometria-jobs.module';

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
    EventosSistemaModule,
    AuthModule,
    TenantsModule,
    PlataformaModule,
    CobroModule,
    SuscripcionesModule,
    ClientesModule,
    CampanasModule,
    DesarrolloDocumentalModule,
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
    McpModule,
    WebhooksWhatsappModule,
    OrdenesTrabajoModule,
    PresupuestosModule,
    CuponesModule,
    AdministracionModule,
    EgresosModule,
    ReportesModule,
    EtaModule,
    ArchivosModule,
    IntegracionesModule,
    CentroCopiadoModule,
    PanelGeneralModule,
    FidelizacionModule,
    RecorridosVectorialesModule,
    ProvisionamientoModule,
    RegistroModule,
    GeometriaJobsModule,
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
      // Tracker por credencial MCP (una cubeta por token) o IP (default).
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
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
      useClass: SuscripcionAccesoGuard,
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
