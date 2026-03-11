/* eslint-disable @typescript-eslint/no-require-imports */
const {
  PrismaClient,
  CategoriaGraficaCentroCosto,
  CategoriaComponenteCostoCentro,
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  OrigenComponenteCostoCentro,
  RolSistema,
  SexoEmpleado,
  TipoCentroCosto,
  TipoComision,
  TipoDireccion,
  TipoRecursoCentroCosto,
  UnidadBaseCentroCosto,
} = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const periodoDemo = "2026-03";

  await prisma.authSession.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.centroCostoTarifaPeriodo.deleteMany();
  await prisma.centroCostoCapacidadPeriodo.deleteMany();
  await prisma.centroCostoComponenteCostoPeriodo.deleteMany();
  await prisma.centroCostoRecurso.deleteMany();
  await prisma.centroCosto.deleteMany();
  await prisma.areaCosto.deleteMany();
  await prisma.planta.deleteMany();
  await prisma.empleadoComision.deleteMany();
  await prisma.empleadoDireccion.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.proveedorContacto.deleteMany();
  await prisma.proveedorDireccion.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.clienteContacto.deleteMany();
  await prisma.clienteDireccion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      nombre: "GDI Demo",
      slug: "gdi-demo",
      activo: true,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@gdi-demo.local",
      nombreCompleto: "Administrador Demo",
      passwordHash: bcrypt.hashSync("Admin123!", 10),
      activo: true,
    },
  });

  await prisma.membership.create({
    data: {
      userId: adminUser.id,
      tenantId: tenant.id,
      rol: RolSistema.ADMINISTRADOR,
      activa: true,
    },
  });

  const proveedores = await Promise.all([
    prisma.proveedor.create({
      data: {
        tenantId: tenant.id,
        nombre: "Papelera Austral",
        razonSocial: "Papelera Austral SRL",
        emailPrincipal: "ventas@papeleraaustral.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966458800",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Nadia Ferreyra",
              cargo: "Ventas corporativas",
              email: "nadia@papeleraaustral.com",
              telefonoCodigo: "54",
              telefonoNumero: "2966458811",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Deposito central",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Parque Industrial",
              numero: "210",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.proveedor.create({
      data: {
        tenantId: tenant.id,
        nombre: "Terminaciones Patagonicas",
        razonSocial: "Terminaciones Patagonicas SAS",
        emailPrincipal: "operaciones@terminacionespat.com",
        telefonoCodigo: "54",
        telefonoNumero: "2974500088",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Mauro Ponce",
              cargo: "Operaciones",
              email: "mauro@terminacionespat.com",
              telefonoCodigo: "54",
              telefonoNumero: "2974500089",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Planta tercerizada",
              paisCodigo: "AR",
              codigoPostal: "9011",
              direccion: "Ruta 3",
              numero: "S/N",
              ciudad: "Caleta Olivia",
              tipo: TipoDireccion.ENTREGA,
              principal: true,
            },
          ],
        },
      },
    }),
  ]);

  await Promise.all([
    prisma.cliente.create({
      data: {
        tenantId: tenant.id,
        nombre: "Cafe del Centro",
        razonSocial: "Cafe del Centro SRL",
        emailPrincipal: "compras@cafedelcentro.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966123456",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Mariana Lopez",
              cargo: "Compras",
              email: "compras@cafedelcentro.com",
              telefonoCodigo: "54",
              telefonoNumero: "2966112233",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Domicilio principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Av. San Martin",
              numero: "1250",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.cliente.create({
      data: {
        tenantId: tenant.id,
        nombre: "Patagonia Packaging",
        razonSocial: "Patagonia Packaging SA",
        emailPrincipal: "sergio@patpack.com.ar",
        telefonoCodigo: "54",
        telefonoNumero: "2974120034",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Sergio Diaz",
              cargo: "Gerencia comercial",
              email: "sergio@patpack.com.ar",
              telefonoCodigo: "54",
              telefonoNumero: "2974120034",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Planta industrial",
              paisCodigo: "AR",
              codigoPostal: "9011",
              direccion: "Ruta Provincial 12",
              numero: "S/N",
              ciudad: "Caleta Olivia",
              tipo: TipoDireccion.ENTREGA,
              principal: true,
            },
          ],
        },
      },
    }),
  ]);

  const empleados = await Promise.all([
    prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        nombreCompleto: "Lucas Gomez",
        emailPrincipal: "admin@gdi-demo.local",
        telefonoCodigo: "54",
        telefonoNumero: "2966450000",
        sector: "Direccion",
        ocupacion: "Administrador general",
        sexo: SexoEmpleado.MASCULINO,
        fechaIngreso: new Date("2024-01-10"),
        fechaNacimiento: new Date("1990-07-22"),
        comisionesHabilitadas: false,
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Domicilio principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Pasteur",
              numero: "220",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        nombreCompleto: "Valentina Rojas",
        emailPrincipal: "valentina@gdi-demo.local",
        telefonoCodigo: "54",
        telefonoNumero: "2966451200",
        sector: "Preprensa",
        ocupacion: "Jefa de preprensa",
        sexo: SexoEmpleado.FEMENINO,
        fechaIngreso: new Date("2024-03-01"),
        fechaNacimiento: new Date("1994-11-15"),
        comisionesHabilitadas: false,
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Mitre",
              numero: "818",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        nombreCompleto: "Martin Vega",
        emailPrincipal: "martin@gdi-demo.local",
        telefonoCodigo: "54",
        telefonoNumero: "2966451300",
        sector: "Comercial",
        ocupacion: "Vendedor tecnico",
        sexo: SexoEmpleado.MASCULINO,
        fechaIngreso: new Date("2024-05-20"),
        fechaNacimiento: new Date("1992-04-04"),
        comisionesHabilitadas: true,
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Avenida Kirchner",
              numero: "1090",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
        comisiones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Comision por venta",
              tipo: TipoComision.PORCENTAJE,
              valor: "5.00",
            },
          ],
        },
      },
    }),
  ]);

  const planta = await prisma.planta.create({
    data: {
      tenantId: tenant.id,
      codigo: "PLT-001",
      nombre: "Planta principal",
      descripcion: "Sede operativa inicial",
      activa: true,
    },
  });

  const [areaPreprensa, areaImpresion, areaTerminacion] = await Promise.all([
    prisma.areaCosto.create({
      data: {
        tenantId: tenant.id,
        plantaId: planta.id,
        codigo: "PRE",
        nombre: "Preprensa",
        descripcion: "Diseño, imposicion y planchas",
        activa: true,
      },
    }),
    prisma.areaCosto.create({
      data: {
        tenantId: tenant.id,
        plantaId: planta.id,
        codigo: "IMP",
        nombre: "Impresion",
        descripcion: "Produccion en maquinas impresoras",
        activa: true,
      },
    }),
    prisma.areaCosto.create({
      data: {
        tenantId: tenant.id,
        plantaId: planta.id,
        codigo: "TER",
        nombre: "Terminacion",
        descripcion: "Corte, plegado y terminaciones especiales",
        activa: true,
      },
    }),
  ]);

  await Promise.all([
    prisma.centroCosto.create({
      data: {
        tenantId: tenant.id,
        plantaId: planta.id,
        areaCostoId: areaPreprensa.id,
        codigo: "PRE-001",
        nombre: "CTP principal",
        descripcion: "Centro productivo de salida a plancha",
        tipoCentro: TipoCentroCosto.PRODUCTIVO,
        categoriaGrafica: CategoriaGraficaCentroCosto.PREPRENSA,
        imputacionPreferida: ImputacionPreferidaCentroCosto.DIRECTA,
        unidadBaseFutura: UnidadBaseCentroCosto.HORA_HOMBRE,
        responsableEmpleadoId: empleados[1].id,
        activo: true,
      },
    }),
    prisma.centroCosto.create({
      data: {
        tenantId: tenant.id,
        plantaId: planta.id,
        areaCostoId: areaImpresion.id,
        codigo: "IMP-001",
        nombre: "Offset 4 colores",
        descripcion: "Equipo principal de impresion offset",
        tipoCentro: TipoCentroCosto.PRODUCTIVO,
        categoriaGrafica: CategoriaGraficaCentroCosto.IMPRESION,
        imputacionPreferida: ImputacionPreferidaCentroCosto.DIRECTA,
        unidadBaseFutura: UnidadBaseCentroCosto.HORA_MAQUINA,
        responsableEmpleadoId: empleados[0].id,
        activo: true,
      },
    }),
    prisma.centroCosto.create({
      data: {
        tenantId: tenant.id,
        plantaId: planta.id,
        areaCostoId: areaTerminacion.id,
        codigo: "TER-001",
        nombre: "Barniz UV tercerizado",
        descripcion: "Proveedor externo para procesos especiales",
        tipoCentro: TipoCentroCosto.TERCERIZADO,
        categoriaGrafica: CategoriaGraficaCentroCosto.TERCERIZADO,
        imputacionPreferida: ImputacionPreferidaCentroCosto.REPARTO,
        unidadBaseFutura: UnidadBaseCentroCosto.UNIDAD,
        proveedorDefaultId: proveedores[1].id,
        activo: true,
      },
    }),
  ]);

  const centroImpresion = await prisma.centroCosto.findFirstOrThrow({
    where: {
      tenantId: tenant.id,
      codigo: "IMP-001",
    },
  });

  await prisma.centroCostoRecurso.createMany({
    data: [
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
        empleadoId: empleados[0].id,
        descripcion: "Responsable principal del sector",
        porcentajeAsignacion: "70.00",
        activo: true,
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
        empleadoId: empleados[1].id,
        descripcion: "Soporte operativo de preprensa e impresión",
        porcentajeAsignacion: "30.00",
        activo: true,
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        tipoRecurso: TipoRecursoCentroCosto.MAQUINARIA,
        nombreManual: "Heidelberg SM74",
        descripcion: "Máquina principal offset 4 colores",
        activo: true,
      },
    ],
  });

  await prisma.centroCostoComponenteCostoPeriodo.createMany({
    data: [
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        categoria: CategoriaComponenteCostoCentro.SUELDOS,
        nombre: "Sueldos del equipo",
        origen: OrigenComponenteCostoCentro.SUGERIDO,
        importeMensual: "1200000.00",
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        categoria: CategoriaComponenteCostoCentro.CARGAS,
        nombre: "Cargas y aportes",
        origen: OrigenComponenteCostoCentro.SUGERIDO,
        importeMensual: "800000.00",
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        categoria: CategoriaComponenteCostoCentro.AMORTIZACION,
        nombre: "Amortización de máquina",
        origen: OrigenComponenteCostoCentro.SUGERIDO,
        importeMensual: "900000.00",
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        categoria: CategoriaComponenteCostoCentro.ENERGIA,
        nombre: "Energía",
        origen: OrigenComponenteCostoCentro.SUGERIDO,
        importeMensual: "300000.00",
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        categoria: CategoriaComponenteCostoCentro.MANTENIMIENTO,
        nombre: "Mantenimiento",
        origen: OrigenComponenteCostoCentro.SUGERIDO,
        importeMensual: "200000.00",
      },
    ],
  });

  await prisma.centroCostoCapacidadPeriodo.create({
    data: {
      tenantId: tenant.id,
      centroCostoId: centroImpresion.id,
      periodo: periodoDemo,
      unidadBase: UnidadBaseCentroCosto.HORA_MAQUINA,
      diasPorMes: "22.00",
      horasPorDia: "8.00",
      porcentajeNoProductivo: "15.00",
      capacidadTeorica: "176.00",
      capacidadPractica: "149.60",
    },
  });

  const resumenTarifa = {
    periodo: periodoDemo,
    centroCodigo: "IMP-001",
    centroNombre: "Offset 4 colores",
    unidadBase: "hora_maquina",
    costoMensualTotal: 3400000,
    capacidadPractica: 149.6,
    tarifaCalculada: 22727.27,
    advertencias: [],
  };

  await prisma.centroCostoTarifaPeriodo.createMany({
    data: [
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        costoMensualTotal: "3400000.00",
        capacidadPractica: "149.60",
        tarifaCalculada: "22727.27",
        estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        resumenJson: resumenTarifa,
      },
      {
        tenantId: tenant.id,
        centroCostoId: centroImpresion.id,
        periodo: periodoDemo,
        costoMensualTotal: "3400000.00",
        capacidadPractica: "149.60",
        tarifaCalculada: "22727.27",
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        resumenJson: resumenTarifa,
      },
    ],
  });

  console.info("Seed completado.");
  console.info("Tenant demo: GDI Demo");
  console.info("Usuario admin: admin@gdi-demo.local");
  console.info("Clave admin: Admin123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
