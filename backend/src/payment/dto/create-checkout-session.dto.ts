import { IsString, IsOptional, IsUrl, IsIn } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsIn(['starter', 'pro', 'enterprise'])
  tier: 'starter' | 'pro' | 'enterprise';

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
