import { Module } from '@nestjs/common';

import { TriagemController } from './triagem.controller';
import { TriagemRepository } from './triagem.repository';
import { TriagemService } from './triagem.service';

@Module({
  controllers: [TriagemController],
  providers: [TriagemService, TriagemRepository],
  exports: [TriagemService],
})
export class TriagemModule {}
