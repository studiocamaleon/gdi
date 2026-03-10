/* eslint-disable @typescript-eslint/no-require-imports */
const {
  PrismaClient,
  RolSistema,
  SexoEmpleado,
  TipoComision,
  TipoDireccion,
} = require("@prisma/client");

const prisma = new PrismaClient();

const clientes = [
  {
    nombre: "Cafe del Centro",
    razonSocial: "Cafe del Centro SRL",
    emailPrincipal: "compras@cafedelcentro.com",
    telefonoCodigo: "54",
    telefonoNumero: "2966123456",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Mariana Lopez",
        cargo: "Compras",
        email: "compras@cafedelcentro.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966112233",
        principal: true,
      },
      {
        nombre: "Javier Duarte",
        cargo: "Marketing",
        email: "marketing@cafedelcentro.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966445566",
        principal: false,
      },
    ],
    direcciones: [
      {
        descripcion: "Domicilio principal",
        paisCodigo: "AR",
        codigoPostal: "9400",
        direccion: "Av. San Martin",
        numero: "1250",
        ciudad: "Rio Gallegos",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
      {
        descripcion: "Administracion",
        paisCodigo: "AR",
        codigoPostal: "9400",
        direccion: "Alberdi",
        numero: "842",
        ciudad: "Rio Gallegos",
        tipo: TipoDireccion.FACTURACION,
        principal: false,
      },
    ],
  },
  {
    nombre: "Patagonia Packaging",
    razonSocial: "Patagonia Packaging SA",
    emailPrincipal: "sergio@patpack.com.ar",
    telefonoCodigo: "54",
    telefonoNumero: "2974120034",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Sergio Diaz",
        cargo: "Gerencia comercial",
        email: "sergio@patpack.com.ar",
        telefonoCodigo: "54",
        telefonoNumero: "2974120034",
        principal: true,
      },
    ],
    direcciones: [
      {
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
  {
    nombre: "Bodega Ladera",
    razonSocial: "Bodega Ladera SAS",
    emailPrincipal: "lucia@bodegaladera.com",
    telefonoCodigo: "54",
    telefonoNumero: "2966022244",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Lucia Mendez",
        cargo: "Administracion",
        email: "lucia@bodegaladera.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966022244",
        principal: true,
      },
      {
        nombre: "Rocio Vargas",
        cargo: "Produccion",
        email: "rocio@bodegaladera.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966022255",
        principal: false,
      },
    ],
    direcciones: [
      {
        descripcion: "Casa central",
        paisCodigo: "AR",
        codigoPostal: "9405",
        direccion: "Libertador",
        numero: "432",
        ciudad: "El Calafate",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
      {
        descripcion: "Deposito",
        paisCodigo: "AR",
        codigoPostal: "9405",
        direccion: "Ruta 40",
        numero: "1890",
        ciudad: "El Calafate",
        tipo: TipoDireccion.ENTREGA,
        principal: false,
      },
    ],
  },
  {
    nombre: "Marea Sur",
    razonSocial: "Marea Sur SRL",
    emailPrincipal: "pablo@mareasur.com",
    telefonoCodigo: "54",
    telefonoNumero: "2804568899",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Pablo Ruiz",
        cargo: "Compras",
        email: "pablo@mareasur.com",
        telefonoCodigo: "54",
        telefonoNumero: "2804568899",
        principal: true,
      },
    ],
    direcciones: [
      {
        descripcion: "Oficina comercial",
        paisCodigo: "AR",
        codigoPostal: "9120",
        direccion: "Belgrano",
        numero: "701",
        ciudad: "Puerto Madryn",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
    ],
  },
  {
    nombre: "Lumen Studio",
    razonSocial: "Lumen Studio SAS",
    emailPrincipal: "ana@lumenstudio.com",
    telefonoCodigo: "54",
    telefonoNumero: "2974019922",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Ana Torres",
        cargo: "Direccion",
        email: "ana@lumenstudio.com",
        telefonoCodigo: "54",
        telefonoNumero: "2974019922",
        principal: true,
      },
    ],
    direcciones: [
      {
        descripcion: "Oficina central",
        paisCodigo: "AR",
        codigoPostal: "9000",
        direccion: "Rivadavia",
        numero: "522",
        ciudad: "Comodoro Rivadavia",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
    ],
  },
];

const proveedores = [
  {
    nombre: "Papelera Austral",
    razonSocial: "Papelera Austral SRL",
    emailPrincipal: "ventas@papeleraaustral.com",
    telefonoCodigo: "54",
    telefonoNumero: "2966458800",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Nadia Ferreyra",
        cargo: "Ventas corporativas",
        email: "nadia@papeleraaustral.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966458811",
        principal: true,
      },
    ],
    direcciones: [
      {
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
  {
    nombre: "Tintas del Sur",
    razonSocial: "Tintas del Sur SAS",
    emailPrincipal: "comercial@tintasdelsur.com",
    telefonoCodigo: "54",
    telefonoNumero: "2995012200",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Martin Peralta",
        cargo: "Asesor tecnico",
        email: "martin@tintasdelsur.com",
        telefonoCodigo: "54",
        telefonoNumero: "2995012211",
        principal: true,
      },
      {
        nombre: "Carla Sosa",
        cargo: "Administracion",
        email: "carla@tintasdelsur.com",
        telefonoCodigo: "54",
        telefonoNumero: "2995012212",
        principal: false,
      },
    ],
    direcciones: [
      {
        descripcion: "Casa central",
        paisCodigo: "AR",
        codigoPostal: "8300",
        direccion: "Perticone",
        numero: "455",
        ciudad: "Neuquen",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
      {
        descripcion: "Facturacion",
        paisCodigo: "AR",
        codigoPostal: "8300",
        direccion: "Mitre",
        numero: "1120",
        ciudad: "Neuquen",
        tipo: TipoDireccion.FACTURACION,
        principal: false,
      },
    ],
  },
  {
    nombre: "Bobinas Patagonicas",
    razonSocial: "Bobinas Patagonicas SA",
    emailPrincipal: "pedidos@bobinaspatagonicas.com",
    telefonoCodigo: "54",
    telefonoNumero: "2974559900",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "German Alvarez",
        cargo: "Cuenta mayorista",
        email: "german@bobinaspatagonicas.com",
        telefonoCodigo: "54",
        telefonoNumero: "2974559911",
        principal: true,
      },
    ],
    direcciones: [
      {
        descripcion: "Planta",
        paisCodigo: "AR",
        codigoPostal: "9000",
        direccion: "Ruta 3",
        numero: "1580",
        ciudad: "Comodoro Rivadavia",
        tipo: TipoDireccion.ENTREGA,
        principal: true,
      },
    ],
  },
  {
    nombre: "Display Andino",
    razonSocial: "Display Andino SAS",
    emailPrincipal: "hola@displayandino.com",
    telefonoCodigo: "54",
    telefonoNumero: "2614883000",
    paisCodigo: "AR",
    contactos: [
      {
        nombre: "Luciana Prado",
        cargo: "Ejecutiva comercial",
        email: "luciana@displayandino.com",
        telefonoCodigo: "54",
        telefonoNumero: "2614883010",
        principal: true,
      },
    ],
    direcciones: [
      {
        descripcion: "Showroom",
        paisCodigo: "AR",
        codigoPostal: "5500",
        direccion: "San Martin",
        numero: "980",
        ciudad: "Mendoza",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
    ],
  },
];

const empleados = [
  {
    nombreCompleto: "Lucia Fernandez",
    emailPrincipal: "lucia.fernandez@gdi.local",
    telefonoCodigo: "54",
    telefonoNumero: "2966124001",
    sector: "Ventas",
    ocupacion: "Vendedora senior",
    sexo: SexoEmpleado.FEMENINO,
    fechaIngreso: "2023-05-10",
    fechaNacimiento: "1993-09-14",
    usuarioSistema: true,
    emailAcceso: "lucia.fernandez@gdi.local",
    rolSistema: RolSistema.SUPERVISOR,
    comisionesHabilitadas: true,
    direcciones: [
      {
        descripcion: "Domicilio principal",
        paisCodigo: "AR",
        codigoPostal: "9400",
        direccion: "Mariano Moreno",
        numero: "760",
        ciudad: "Rio Gallegos",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
    ],
    comisiones: [
      {
        descripcion: "5% de la venta",
        tipo: TipoComision.PORCENTAJE,
        valor: "5.00",
      },
    ],
  },
  {
    nombreCompleto: "Martin Robles",
    emailPrincipal: "martin.robles@gdi.local",
    telefonoCodigo: "54",
    telefonoNumero: "2966124002",
    sector: "Produccion",
    ocupacion: "Jefe de taller",
    sexo: SexoEmpleado.MASCULINO,
    fechaIngreso: "2021-11-02",
    fechaNacimiento: "1988-02-27",
    usuarioSistema: true,
    emailAcceso: "martin.robles@gdi.local",
    rolSistema: RolSistema.OPERADOR,
    comisionesHabilitadas: false,
    direcciones: [
      {
        descripcion: "Casa central",
        paisCodigo: "AR",
        codigoPostal: "9400",
        direccion: "Kirchner",
        numero: "1245",
        ciudad: "Rio Gallegos",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
    ],
    comisiones: [],
  },
  {
    nombreCompleto: "Carla Suarez",
    emailPrincipal: "carla.suarez@gdi.local",
    telefonoCodigo: "54",
    telefonoNumero: "2966124003",
    sector: "Administracion",
    ocupacion: "Analista administrativa",
    sexo: SexoEmpleado.FEMENINO,
    fechaIngreso: "2024-01-15",
    fechaNacimiento: "1996-06-05",
    usuarioSistema: false,
    emailAcceso: null,
    rolSistema: null,
    comisionesHabilitadas: false,
    direcciones: [
      {
        descripcion: "Domicilio",
        paisCodigo: "AR",
        codigoPostal: "9400",
        direccion: "Zapiola",
        numero: "318",
        ciudad: "Rio Gallegos",
        tipo: TipoDireccion.PRINCIPAL,
        principal: true,
      },
    ],
    comisiones: [],
  },
];

async function main() {
  await prisma.empleadoComision.deleteMany();
  await prisma.empleadoDireccion.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.proveedorDireccion.deleteMany();
  await prisma.proveedorContacto.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.clienteDireccion.deleteMany();
  await prisma.clienteContacto.deleteMany();
  await prisma.cliente.deleteMany();

  for (const cliente of clientes) {
    await prisma.cliente.create({
      data: {
        nombre: cliente.nombre,
        razonSocial: cliente.razonSocial,
        emailPrincipal: cliente.emailPrincipal,
        telefonoCodigo: cliente.telefonoCodigo,
        telefonoNumero: cliente.telefonoNumero,
        paisCodigo: cliente.paisCodigo,
        contactos: {
          create: cliente.contactos,
        },
        direcciones: {
          create: cliente.direcciones,
        },
      },
    });
  }

  for (const proveedor of proveedores) {
    await prisma.proveedor.create({
      data: {
        nombre: proveedor.nombre,
        razonSocial: proveedor.razonSocial,
        emailPrincipal: proveedor.emailPrincipal,
        telefonoCodigo: proveedor.telefonoCodigo,
        telefonoNumero: proveedor.telefonoNumero,
        paisCodigo: proveedor.paisCodigo,
        contactos: {
          create: proveedor.contactos,
        },
        direcciones: {
          create: proveedor.direcciones,
        },
      },
    });
  }

  for (const empleado of empleados) {
    await prisma.empleado.create({
      data: {
        nombreCompleto: empleado.nombreCompleto,
        emailPrincipal: empleado.emailPrincipal,
        telefonoCodigo: empleado.telefonoCodigo,
        telefonoNumero: empleado.telefonoNumero,
        sector: empleado.sector,
        ocupacion: empleado.ocupacion,
        sexo: empleado.sexo,
        fechaIngreso: new Date(empleado.fechaIngreso),
        fechaNacimiento: new Date(empleado.fechaNacimiento),
        usuarioSistema: empleado.usuarioSistema,
        emailAcceso: empleado.emailAcceso,
        rolSistema: empleado.rolSistema,
        comisionesHabilitadas: empleado.comisionesHabilitadas,
        direcciones: {
          create: empleado.direcciones,
        },
        comisiones: {
          create: empleado.comisiones,
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
