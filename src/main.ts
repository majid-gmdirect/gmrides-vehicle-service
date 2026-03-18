import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBIT_MQ_URL || 'amqp://localhost:5672'],
      queue: 'vehicle_queue',
      queueOptions: { durable: true },
    },
  });
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://gmrides.co.uk',
      'https://panel.gmrides.co.uk',
    ],
    credentials: true, // allow Authorization headers and cookies
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties that don't have decorators
      forbidNonWhitelisted: true, // throws error for unexpected properties
      transform: true, // auto-transform payloads to DTO instances
    }),
  );

  app.setGlobalPrefix('api/vehicles');

  // ✅ Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Vehicle Service API')
    .setDescription('API documentation for the Vehicle Service')
    .setVersion('1.0')
    .addBearerAuth() // Adds Authorization header to Swagger UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
  if (enableSwagger) {
    // canonical path
    SwaggerModule.setup('api/vehicles/swagger', app, document);
    // backwards-compatible typo path (requested)
    SwaggerModule.setup('api/hehicles/swagger', app, document);
  }
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4002);
}
bootstrap();
