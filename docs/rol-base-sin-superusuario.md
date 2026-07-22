# Rol de base sin superusuario

**Fecha:** 2026-07-22
**Estado:** aplicado en dev y en la base de tests. Pendiente en producción.

---

## Por qué

Hasta acá la API se conectaba a PostgreSQL como **`postgres`**, superusuario.
Eso tiene una consecuencia que no se ve hasta que se busca: el aislamiento
entre tenants —la promesa central del producto— dependía **enteramente** de la
extensión de Prisma (`tenant-guard.extension.ts`), sin ninguna posibilidad de
red a nivel base de datos.

Y no era una posibilidad "pendiente de implementar": era **imposible**. RLS de
PostgreSQL se saltea para superusuarios por definición, así que agregar
políticas hubiera sido trabajo invisible — las políticas existirían y no se
aplicarían nunca.

Bajar el rol no agrega aislamiento por sí solo. Lo que hace es **dejar de
bloquear** la única defensa en profundidad disponible.

## Reparto de roles

| Rol | Para qué | Variable |
|---|---|---|
| `grafo_app` | runtime de la API: DML, nada de DDL | `DATABASE_URL` |
| `postgres` | migraciones: necesita DDL | `MIGRATE_DATABASE_URL` |

Prisma usa `directUrl` del datasource para todo lo que requiere conexión
directa (`migrate`, `db push`, `introspect`) y `url` para el runtime, así que
el reparto es automático: `npm run prisma:migrate` usa el rol con DDL y la app
levanta con el rol reducido, sin que nadie tenga que acordarse.

## Crear el rol (una vez por entorno)

No va en una migración: crear un rol es una operación de **cluster**, no de
base, y lleva una contraseña que no puede vivir en el repo.

```bash
docker exec -i gdi-saas-postgres psql -U postgres <<'SQL'
CREATE ROLE grafo_app LOGIN PASSWORD '<generar una>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
SQL
```

Los privilegios sí van en migración (`20260722100000_rol_app_sin_superusuario`),
que además **no hace nada si el rol no existe** — así un entorno que todavía no
lo creó no se rompe al desplegar. Incluye `ALTER DEFAULT PRIVILEGES`, o cada
tabla nueva quedaría invisible para la app hasta correr los GRANT a mano.

## Verificación

```bash
# Lee y escribe datos
psql -U grafo_app -d gdi_saas -c 'SELECT count(*) FROM "Tenant"'

# NO puede crear ni borrar tablas
psql -U grafo_app -d gdi_saas -c 'CREATE TABLE x(id int)'   # permission denied
psql -U grafo_app -d gdi_saas -c 'DROP TABLE "Archivo"'     # must be owner
```

Verificado además contra la app: login (que escribe sesión), listados,
endpoints de reportes con `$queryRaw` y el módulo de archivos, todos OK con el
rol reducido.

## Lo que esto NO resuelve

**No agrega RLS.** El aislamiento sigue dependiendo de la extensión de Prisma.
Lo que cambia es que ahora RLS *es posible*, que es el prerrequisito.

Dos huecos que la extensión no cubre y conviene tener presentes:

1. **Los 61 `$queryRaw`/`$executeRaw`** del sistema. La extensión reescribe
   operaciones de modelo, no SQL crudo. Auditados a 2026-07-22: todos filtran
   por tenant salvo el `SELECT 1` del health check. Pero no hay nada que avise
   si el próximo se olvida.
2. **El código que corre fuera del contexto de request** (los crons). Ahí el
   `AsyncLocalStorage` está vacío y la extensión no inyecta nada — es
   deliberado, porque los barridos son cross-tenant por diseño, pero significa
   que en esos caminos el guard está apagado.

La red para el punto 1 es la suite de tests de aislamiento
(`__tests__/aislamiento-tenants.spec.ts`). RLS completo queda como proyecto
aparte.
