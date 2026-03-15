import { plainToInstance } from 'class-transformer';

export function mapToDto<T, V>(dtoClass: new () => T, data: V): T {
  return plainToInstance(dtoClass, data, {
    excludeExtraneousValues: true, // Only include fields defined in the DTO
  });
}
