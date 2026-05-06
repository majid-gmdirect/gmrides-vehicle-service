import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as basicAuth from 'express-basic-auth';
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

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
  });
  const enableSwagger = process.env.ENABLE_SWAGGER === 'true';
  if (enableSwagger) {
    if (process.env.NODE_ENV === 'production') {
      const swaggerUser = process.env.SWAGGER_USER;
      const swaggerPassword = process.env.SWAGGER_PASSWORD;

      if (swaggerUser && swaggerPassword) {
        app.use(
          '/api/vehicles/swagger',
          basicAuth({
            challenge: true,
            users: {
              [swaggerUser]: swaggerPassword,
            },
          }),
        );
      } else {
        console.warn(
          '[vehicle-service] Swagger is enabled but NOT protected: set SWAGGER_USER/SWAGGER_PASSWORD to enable basic-auth.',
        );
      }
    }

    // canonical path
    SwaggerModule.setup('api/vehicles/swagger', app, document);
  }
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4002);
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[vehicle-service] Failed to start', err);
  process.exit(1);
});
