import { createHash } from 'node:crypto';
import type { PlantillaInbox } from '../../../common/inbox/plantillas';
const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const cadena = (v: unknown, max = 1024) =>
  typeof v === 'string' && v.length <= max ? v : '';
/** Fallar cerrado frente a componentes nuevos: nunca omitir una parte requerida por Meta. */
export function normalizarPlantilla(
  raw: unknown,
  pagina: string | null,
): PlantillaInbox | null {
  const r = objeto(raw);
  if (
    !/^\d{1,40}$/.test(cadena(r.id)) ||
    !/^[a-z0-9_]{1,512}$/.test(cadena(r.name)) ||
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(cadena(r.language))
  )
    return null;
  const p: PlantillaInbox = {
    id: String(r.id),
    nombre: String(r.name),
    idioma: String(r.language),
    categoria: cadena(r.category, 50),
    estado: cadena(r.status, 50),
    formato: r.parameter_format === 'NAMED' ? 'NAMED' : 'POSITIONAL',
    encabezado: '',
    cuerpo: '',
    pie: '',
    botones: [],
    variables: [],
    motivo: null,
    version: '',
    pagina,
  };
  const no = (motivo: string) => {
    p.motivo ??= motivo;
  };
  if (p.estado !== 'APPROVED')
    no('Meta todavía no permite enviar esta plantilla.');
  if (!['UTILITY', 'MARKETING'].includes(p.categoria))
    no('Las plantillas de autenticación requieren un circuito específico.');
  if (
    r.parameter_format &&
    !['NAMED', 'POSITIONAL'].includes(cadena(r.parameter_format))
  )
    no('Formato de variables no compatible.');
  const vistos = new Set<string>();
  for (const rawComponent of Array.isArray(r.components) ? r.components : []) {
    const c = objeto(rawComponent),
      tipo = cadena(c.type);
    if (vistos.has(tipo))
      no('La estructura de esta plantilla requiere revisión.');
    vistos.add(tipo);
    if (tipo === 'HEADER' || tipo === 'BODY') {
      if (tipo === 'HEADER' && c.format !== 'TEXT') {
        no(
          'El envío de plantillas con archivos o ubicación estará disponible en otra etapa.',
        );
        continue;
      }
      const texto = cadena(c.text, tipo === 'HEADER' ? 60 : 1024);
      if (!texto) no('El texto de la plantilla no es compatible.');
      const componente = tipo === 'HEADER' ? 'header' : 'body';
      if (tipo === 'HEADER') p.encabezado = texto;
      else p.cuerpo = texto;
      const nombres = [
        ...new Set([...texto.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1])),
      ];
      if (
        texto.replace(/\{\{([^{}]+)\}\}/g, '').match(/[{}]/) ||
        nombres.some(
          (n) => !(p.formato === 'NAMED' ? /^[a-z_]+$/ : /^[1-9]\d*$/).test(n),
        )
      )
        no('Formato de variables no compatible.');
      if (p.formato === 'POSITIONAL') {
        nombres.sort((a, b) => Number(a) - Number(b));
        if (nombres.some((n, i) => Number(n) !== i + 1))
          no('Las variables de la plantilla no son consecutivas.');
      }
      if ((tipo === 'HEADER' && nombres.length > 1) || nombres.length > 40)
        no('Esta plantilla contiene demasiados datos variables.');
      p.variables.push(
        ...nombres.map((nombre) => ({
          componente,
          nombre,
        })),
      );
    } else if (tipo === 'FOOTER') {
      p.pie = cadena(c.text, 60);
      if (!p.pie || /[{}]/.test(p.pie))
        no('El pie de esta plantilla no es compatible.');
    } else if (tipo === 'BUTTONS') {
      if (!Array.isArray(c.buttons) || c.buttons.length > 10) {
        no('Botones no compatibles.');
        continue;
      }
      for (const rawButton of c.buttons) {
        const b = objeto(rawButton),
          texto = cadena(b.text, 25);
        const destino =
          b.type === 'URL'
            ? cadena(b.url, 2000)
            : b.type === 'PHONE_NUMBER'
              ? cadena(b.phone_number, 20)
              : '';
        if (
          !texto ||
          !['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(String(b.type))
        )
          no(
            'Esta plantilla usa botones que todavía no se pueden enviar desde Grafo.',
          );
        if (/[{}]/.test(destino))
          no(
            'Los botones con enlaces variables estarán disponibles en otra etapa.',
          );
        if (b.type === 'URL' && !/^https?:\/\//.test(destino))
          no('El enlace de la plantilla no es válido.');
        if (b.type === 'PHONE_NUMBER' && !/^\+?\d{7,20}$/.test(destino))
          no('El teléfono de la plantilla no es válido.');
        p.botones.push({ texto, destino });
      }
    } else
      no(
        'Esta plantilla usa componentes que todavía no se pueden enviar desde Grafo.',
      );
  }
  if (!p.cuerpo) no('La plantilla necesita un cuerpo de texto.');
  if (p.variables.length > 40)
    no('Esta plantilla contiene demasiados datos variables.');
  // Incluye componentes completos para detectar cambios incluso en acciones de botones.
  p.version = createHash('sha256')
    .update(
      JSON.stringify([
        r.id,
        r.name,
        r.language,
        r.category,
        r.status,
        r.parameter_format,
        r.components,
      ]),
    )
    .digest('hex');
  return p;
}
