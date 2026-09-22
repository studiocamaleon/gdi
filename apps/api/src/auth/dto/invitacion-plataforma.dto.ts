import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
export class TokenInvitacionPlataformaDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token: string;
}
export class AceptarInvitacionPlataformaDto extends TokenInvitacionPlataformaDto {
  @IsString() @MinLength(1) @MaxLength(256) password: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  nombre?: string;
}
