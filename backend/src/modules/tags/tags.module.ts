import { Module } from '@nestjs/common';
import { TagsRepository } from './repositories/tags.repository';
import { TagsService } from './services/tags.service';
import { TagsController } from './tags.controller';

@Module({
  controllers: [TagsController],
  providers: [TagsRepository, TagsService],
  exports: [TagsService],
})
export class TagsModule {}
