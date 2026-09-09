/** Una escritura activa y sólo el último candidato pendiente. Los callbacks
 * del solver no acumulan copias del plan ni escrituras concurrentes. El dueño
 * debe esperar vaciar() en su finally, también cuando cancela la búsqueda. */
export class EscritorCheckpoint<T> {
  private pendiente?: T;
  private tarea?: Promise<void>;

  constructor(
    private readonly guardar: (value: T) => Promise<void>,
    private readonly informarError: (error: unknown) => void,
  ) {}

  programar(value: T): void {
    this.pendiente = value;
    if (!this.tarea) this.tarea = this.procesar();
  }

  async vaciar(): Promise<void> {
    while (this.tarea) await this.tarea;
  }

  private async procesar(): Promise<void> {
    // Asegura que tarea ya esté asignada aun si guardar falla sincrónicamente.
    await Promise.resolve();
    try {
      while (this.pendiente !== undefined) {
        const value = this.pendiente;
        this.pendiente = undefined;
        try {
          await this.guardar(value);
        } catch (error) {
          this.informarError(error);
        }
      }
    } finally {
      this.tarea = undefined;
    }
  }
}
