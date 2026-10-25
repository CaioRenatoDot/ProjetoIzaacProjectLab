import { Global, Injectable, Module } from '@nestjs/common';

/** "Agora" das regras que dependem de horário (turno, RN-05 e RN-07); os testes fixam. */
@Injectable()
export class Relogio {
  agora(): Date {
    return new Date();
  }
}

@Global()
@Module({ providers: [Relogio], exports: [Relogio] })
export class RelogioModule {}
