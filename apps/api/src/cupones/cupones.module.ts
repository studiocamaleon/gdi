import { Module } from '@nestjs/common';
import { CuponesController } from './cupones.controller';
import { CuponesService } from './cupones.service';

@Module({
  controllers: [CuponesController],
  providers: [CuponesService],
  exports: [CuponesService],
})
export class CuponesModule {}
