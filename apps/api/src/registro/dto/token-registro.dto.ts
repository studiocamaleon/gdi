import { IsString, MinLength } from 'class-validator';

export class TokenRegistroDto {
  @IsString()
  @MinLength(32)
  token!: string;
}
