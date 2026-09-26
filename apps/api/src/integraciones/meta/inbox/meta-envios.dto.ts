import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
export class EnviarTextoInboxDto {
  @IsUUID('4') clave!: string;
  @IsString()
  @Matches(
    /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i,
  )
  canalId!: string;
  @IsString() @MaxLength(4096) @Matches(/\S/u) texto!: string;
}
