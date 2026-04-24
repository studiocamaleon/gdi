import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MotorUniversalController } from './motor.controller';
import { MotorUniversalService } from './motor.service';

@Module({
  imports: [PrismaModule],
  controllers: [MotorUniversalController],
  providers: [MotorUniversalService],
  exports: [MotorUniversalService],
})
export class MotorUniversalModule {}
