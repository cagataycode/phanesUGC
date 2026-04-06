import { IsString, MinLength } from 'class-validator';

export class ValidatePromoCodeDto {
  @IsString()
  @MinLength(1)
  code: string;
}
