/** Actualiza las publicaciones existentes de una cuenta, sin tocar sus OTs. */
import { PrismaClient } from '@prisma/client';
import { RecetasProductoService } from '../src/productos-servicios/recetas-producto.service';
import { ProductosService } from '../src/productos-servicios/productos.service';
import { ProductoValidacionService } from '../src/productos-servicios/producto-validacion.service';
import { ConfigPasosService } from '../src/productos-servicios/config-pasos.service';
import { FamiliasPasosService } from '../src/productos-servicios/familias-pasos.service';
import { EventosSistemaService } from '../src/eventos-sistema/eventos-sistema.service';

const db = new PrismaClient();
async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) throw new Error('Indicá el ID de la cuenta a sincronizar.');
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { nombre: true },
  });
  const recetasExistentes = await db.productoReceta.findMany({
    where: {
      tenantId,
      activo: true,
      OR: [
        { revisionPublicadaId: { not: null } },
        { revisiones: { some: { estado: 'BORRADOR' } } },
      ],
    },
    select: { productoId: true },
  });
  const productos = new ProductosService(db as never);
  const recetas = new RecetasProductoService(
    db as never,
    productos,
    new ProductoValidacionService(productos),
    new EventosSistemaService(db as never),
    new ConfigPasosService(db as never, new FamiliasPasosService(db as never)),
  );
  const productoIds = [...new Set(recetasExistentes.map((r) => r.productoId))];
  console.log(
    JSON.stringify({ cuenta: tenant.nombre, productos: productoIds.length }),
  );
  const resultado = await recetas.sincronizarPublicaciones(
    { tenantId },
    productoIds,
  );
  console.log(JSON.stringify(resultado, null, 2));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
