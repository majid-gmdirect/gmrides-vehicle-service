import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UploadOwnershipService } from './upload-ownership.service';

@Module({
  imports: [HttpModule],
  providers: [UploadOwnershipService],
  exports: [UploadOwnershipService],
})
export class UploadOwnershipModule {}
