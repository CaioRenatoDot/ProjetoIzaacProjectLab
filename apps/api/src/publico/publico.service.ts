import { Injectable } from '@nestjs/common';
import { ConsultaSenhaPublica, EstadoPainelPublico } from '@filas/contracts';

import { ErroDominio } from '../common/errors/erro-dominio';
import { Relogio } from '../common/relogio';
import { TempoRealRepository } from '../tempo-real/tempo-real.repository';
import { PublicoRepository } from './publico.repository';

@Injectable()
export class PublicoService {
  private readonly acessos = new Map<string, number[]>();

  constructor(
    private readonly repository: PublicoRepository,
    private readonly painel: TempoRealRepository,
    private readonly relogio: Relogio,
  ) {}

  async consultar(numero: string): Promise<ConsultaSenhaPublica> {
    const senhas = await this.repository.consultar(numero, this.relogio.agora());
    if (senhas.length !== 1) {
      throw new ErroDominio(
        'SENHA_NAO_ENCONTRADA',
        404,
        'Senha não encontrada',
        'Não localizamos essa senha para o dia de hoje. Procure a recepção.',
      );
    }
    const s = senhas[0]!;
    return ConsultaSenhaPublica.parse({
      numero: s.numero,
      especialidade: s.especialidade,
      status: s.status,
      posicao: s.posicao,
      local: s.local,
      tempoEstimadoMinutos:
        s.status === 'AGUARDANDO' && s.amostra >= 10 && s.media !== null
          ? Math.round(s.media)
          : null,
    });
  }

  async estado(unidadeId: string): Promise<EstadoPainelPublico> {
    if (!(await this.painel.unidade(unidadeId))) {
      throw new ErroDominio('NAO_ENCONTRADO', 404, 'Unidade não encontrada');
    }
    const agora = this.relogio.agora();
    const chamadas = await this.painel.chamadasPublicas(unidadeId, agora);
    return EstadoPainelPublico.parse({
      atual: chamadas[0] ?? null,
      anteriores: chamadas.slice(1),
      servidorEm: agora.toISOString(),
    });
  }

  /** Janela móvel compartilhada pelas duas rotas; devolve a espera apenas ao exceder. */
  verificarLimite(ip: string): number | null {
    const agora = this.relogio.agora().getTime();
    for (const [origem, acessos] of this.acessos) {
      const recentes = acessos.filter((em) => em > agora - 60_000);
      if (recentes.length) this.acessos.set(origem, recentes);
      else this.acessos.delete(origem);
    }
    const acessos = this.acessos.get(ip) ?? [];
    if (acessos.length >= 30) return Math.max(1, Math.ceil((acessos[0]! + 60_000 - agora) / 1000));
    acessos.push(agora);
    this.acessos.set(ip, acessos);
    return null;
  }
}
