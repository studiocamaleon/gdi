const HORA=3_600_000;
// Arranque inmediato; luego el siguiente cambio de hora UTC. No acumular tareas
// atrasadas ni ejecutar dos a la vez si una recuperación tardó más de lo normal.
export function demoraSiguienteCopia(inicio,fin){
  if(!Number.isSafeInteger(inicio)||!Number.isSafeInteger(fin)||fin<inicio)throw new Error('Reloj inválido.');
  return (Math.floor(fin/HORA)+1)*HORA-fin;
}
