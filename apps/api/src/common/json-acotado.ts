/** Serialización conservadora con presupuesto previo. Evita materializar todo
 * un JSON grande sólo para medirlo. No redondea ni compacta referencias. */
export function serializarJsonAcotado(
  valor: unknown,
  limiteBytes: number,
): string | null {
  let restante = limiteBytes;
  const limite = new Error('JSON fuera de presupuesto.');
  try {
    return (
      JSON.stringify(valor, (clave, dato: unknown) => {
        restante -= clave.length * 6 + 4;
        if (typeof dato === 'string') {
          if (dato.length > restante) throw limite;
          restante -= Buffer.byteLength(JSON.stringify(dato), 'utf8');
        } else if (dato === null || typeof dato !== 'object') restante -= 24;
        else restante -= 2;
        if (restante < 0) throw limite;
        return dato;
      }) ?? null
    );
  } catch (error) {
    if (error === limite) return null;
    throw error;
  }
}
