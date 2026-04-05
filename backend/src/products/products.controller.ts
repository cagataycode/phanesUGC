import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  createProductSchema,
  type CreateProductDto,
} from './dto/create-product.dto';
import {
  updateProductSchema,
  type UpdateProductDto,
} from './dto/update-product.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('v1/businesses/:businessId/products')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto,
    @GetUser() user: DecodedIdToken,
  ) {
    const id = await this.productsService.create(businessId, user.uid, dto);
    return { id };
  }

  @Get()
  async findAll(@Param('businessId') businessId: string) {
    return this.productsService.findAll(businessId);
  }

  @Get(':productId')
  async findOne(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.findOne(businessId, productId);
  }

  @Patch(':productId')
  async update(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    await this.productsService.update(businessId, productId, dto);
    return { success: true };
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
  ) {
    await this.productsService.softDelete(businessId, productId);
  }
}
