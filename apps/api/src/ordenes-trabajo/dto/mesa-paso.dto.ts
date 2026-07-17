import { IsBoolean } from 'class-validator';

export class MesaPasoDto {
  /** true = tomar el paso a MI mesa; false = devolverlo a compartidas. */
  @IsBoolean()
  en: boolean;
}
