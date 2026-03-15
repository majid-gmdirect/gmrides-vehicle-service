import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport, ClientRMQ } from '@nestjs/microservices';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_MQ_URL || 'amqp://localhost:5672'],
          queue: 'notification_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    PrismaModule,
    AuthModule,
    HttpModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    JwtStrategy,
    {
      provide: 'USER_SERVICE',
      useFactory: () => {
        return new ClientRMQ({
          urls: [process.env.RABBIT_MQ_URL || 'amqp://localhost:5672'],
          queue: 'users',
          queueOptions: { durable: true },
        });
      },
    },
  ],
})
export class UserModule {}
