import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { CostosModule } from './costos/costos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { MaquinariaModule } from './maquinaria/maquinaria.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcesosModule } from './procesos/procesos.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { TenantsModule } from './tenants/tenants.module';
import { InventarioModule } from './inventario/inventario.module';
import { ProductosServiciosModule } from './productos-servicios/productos-servicios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    ProcesosModule,
    InventarioModule,
    ProductosServiciosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
