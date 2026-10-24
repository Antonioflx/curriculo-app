import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UuidParam } from '@/common/decorators/uuid-param.decorator';
import { TagNameDto } from './dto/input/tag-name.dto';
import { TagResponseDto } from './dto/output/tag-response.dto';
import { TagsService } from './services/tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() dto: TagNameDto): Promise<TagResponseDto> {
    return TagResponseDto.from(await this.tags.create(userId, dto.name));
  }

  @Get()
  async list(@CurrentUser('userId') userId: string): Promise<TagResponseDto[]> {
    return (await this.tags.list(userId)).map((tag) => TagResponseDto.from(tag));
  }

  @Patch(':id')
  async rename(
    @CurrentUser('userId') userId: string,
    @UuidParam() id: string,
    @Body() dto: TagNameDto,
  ): Promise<TagResponseDto> {
    return TagResponseDto.from(await this.tags.rename(userId, id, dto.name));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<void> {
    await this.tags.remove(userId, id);
  }
}
