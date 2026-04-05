import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SelectScenarioDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scenarioId!: number;

  @IsString()
  @IsOptional()
  businessId?: string;
}
