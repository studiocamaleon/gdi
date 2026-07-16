import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { CostosModule } from './costos/costos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { MaquinariaModule } from './maquinaria/maquinaria.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { TenantsModule } from './tenants/tenants.module';
import { InventarioModule } from './inventario/inventario.module';
import { ProduccionModule } from './produccion/produccion.module';
import { ProductosServiciosModule } from './productos-servicios/productos-servicios.module';
import { MotorUniversalModule } from './motor-universal/motor.module';
import { OrdenesTrabajoModule } from './ordenes-trabajo/ordenes-trabajo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    ClientesModule,
    EmpleadosModule,
    ProveedoresModule,
    CostosModule,
    MaquinariaModule,
    InventarioModule,
    ProduccionModule,
    ProductosServiciosModule,
    MotorUniversalModule,
    OrdenesTrabajoModule,
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
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
