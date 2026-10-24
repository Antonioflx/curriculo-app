export class TagResponseDto {
  id: string;
  name: string;

  static from(tag: TagResponseDto): TagResponseDto {
    return { id: tag.id, name: tag.name };
  }
}
