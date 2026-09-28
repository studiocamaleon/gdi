/** Contrato cerrado compartido con la vista previa. Nunca contiene tokens ni ejemplos de Meta. */
export type VariablePlantilla = {
  componente: 'header' | 'body';
  nombre: string;
};
export type PlantillaInbox = {
  id: string;
  nombre: string;
  idioma: string;
  categoria: string;
  estado: string;
  formato: 'NAMED' | 'POSITIONAL';
  encabezado: string;
  archivo?: 'image' | 'document' | null;
  cuerpo: string;
  pie: string;
  botones: { texto: string; destino: string }[];
  variables: VariablePlantilla[];
  motivo: string | null;
  version: string;
  pagina: string | null;
};
export type ComponenteEnvioPlantilla =
  | {
      type: 'header' | 'body';
      parameters: { type: 'text'; text: string; parameter_name?: string }[];
    }
  | {
      type: 'header';
      parameters: (
        | { type: 'image'; image: { id: string } }
        | { type: 'document'; document: { id: string; filename: string } }
      )[];
    };
export type ArchivoPlantillaInbox = {
  origen?: 'CLIENTE' | 'PRESUPUESTO' | 'COMPROBANTE';
  referencia?: string;
  id: string;
  version: string;
  nombre: string;
  mimeType: string;
  bytes: number;
};
export function vistaPlantilla(p: PlantillaInbox, valores: string[]) {
  const reemplazar = (
    texto: string,
    componente: VariablePlantilla['componente'],
  ) =>
    texto.replace(/\{\{([a-z_]+|\d+)\}\}/g, (original, nombre: string) => {
      const indice = p.variables.findIndex(
        (v) => v.componente === componente && v.nombre === nombre,
      );
      return valores[indice]?.trim() || original;
    });
  return {
    encabezado: reemplazar(p.encabezado, 'header'),
    cuerpo: reemplazar(p.cuerpo, 'body'),
    pie: p.pie,
  };
}
export function validarValoresPlantilla(
  p: PlantillaInbox,
  valores: string[],
): string | null {
  if (p.motivo || p.estado !== 'APPROVED')
    return p.motivo || 'Esta plantilla ya no está aprobada.';
  if (
    valores.length !== p.variables.length ||
    valores.some((v) => typeof v !== 'string' || !v.trim())
  )
    return 'Completá todos los datos de la plantilla.';
  if (valores.some((v) => v.length > 1024 || /[\r\n\t]| {4}|\{\{|\}\}/.test(v)))
    return 'Usá valores de una sola línea, sin variables ni espacios repetidos.';
  const vista = vistaPlantilla(p, valores);
  if (vista.encabezado.length > 60 || vista.cuerpo.length > 1024)
    return 'El mensaje es demasiado largo: reducí los datos ingresados.';
  return null;
}
export function componentesPlantilla(
  p: PlantillaInbox,
  valores: string[],
): ComponenteEnvioPlantilla[] {
  return (['header', 'body'] as const).flatMap((type) => {
    const parameters = p.variables.flatMap((v, i) =>
      v.componente === type
        ? [
            {
              type: 'text' as const,
              text: valores[i].trim(),
              ...(p.formato === 'NAMED' ? { parameter_name: v.nombre } : {}),
            },
          ]
        : [],
    );
    return parameters.length ? [{ type, parameters }] : [];
  });
}
export function textoPlantilla(p: PlantillaInbox, valores: string[]) {
  const v = vistaPlantilla(p, valores);
  return [
    v.encabezado,
    v.cuerpo,
    v.pie,
    ...p.botones.map((b) => `${b.texto}${b.destino ? `: ${b.destino}` : ''}`),
  ]
    .filter(Boolean)
    .join('\n\n');
}
