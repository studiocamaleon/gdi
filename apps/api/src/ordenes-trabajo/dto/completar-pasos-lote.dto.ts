import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class CompletarPasosLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  pasoIds: string[];
}
