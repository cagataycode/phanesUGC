import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SelectScenarioDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scenarioId!: number;

  @IsString()
  @IsOptional()
  businessId?: string;
}
