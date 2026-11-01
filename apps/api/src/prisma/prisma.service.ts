import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (erro) {
      // A API sobe mesmo sem banco: o liveness segue respondendo e o readiness acusa 503
      // (RNF-04). O Prisma reconecta sozinho na próxima consulta.
      this.logger.warn(`Banco indisponível na inicialização: ${(erro as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
