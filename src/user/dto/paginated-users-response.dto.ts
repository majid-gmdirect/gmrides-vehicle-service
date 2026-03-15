import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './responses/user-response.dto';
import { PaginationDto } from './pagination.dto';
export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
