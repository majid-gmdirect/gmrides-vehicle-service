import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CarApiService } from '../car-api.service';
import {
  CarAutocompleteQueryDto,
  CarModelAutocompleteQueryDto,
} from '../dto/car-autocomplete-query.dto';
import { formatResponse } from '../../common/format-response.util';

@ApiTags('Vehicle Meta')
@Controller()
export class VehicleMetaController {
  constructor(private readonly carApi: CarApiService) {}

  @Get('meta/makes')
  async autocompleteMakes(@Query() query: CarAutocompleteQueryDto) {
    const q = (query.query ?? '').trim();
    const limit = query.limit ?? 10;
    const data = await this.carApi.autocompleteMakes(q, limit);
    return formatResponse({
      success: true,
      data,
      message: 'Makes fetched successfully',
    });
  }

  @Get('meta/models')
  async autocompleteModels(@Query() query: CarModelAutocompleteQueryDto) {
    const q = (query.query ?? '').trim();
    const limit = query.limit ?? 10;
    const make = query.make?.trim();
    const data = await this.carApi.autocompleteModels(q, limit, make);
    return formatResponse({
      success: true,
      data,
      message: 'Models fetched successfully',
    });
  }
}

