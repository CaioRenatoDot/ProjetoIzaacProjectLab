import { type ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { type Ambiente } from '../config/ambiente';
import { AUDIENCIA_TOKEN, EMISSOR_TOKEN } from './sessao.constantes';
import { type ConteudoToken, TokenAcessoService } from './token-acesso.service';

const SEGREDO = 'segredo-ficticio-de-teste-com-32-caracteres!';
const config = { get: () => SEGREDO } as unknown as ConfigService<Ambiente, true>;
const servico = new TokenAcessoService(config);

const CONTEUDO: ConteudoToken = {
  sub: '0190a000-0000-7000-8000-000000000001',
  sid: '0190a000-0000-7000-8000-000000000002',
  nome: 'Usuario',
  perfilId: 'p',
  perfilNome: 'Perfil',
  unidadeId: 'u',
  permissoes: ['fila:consultar'],
};

describe('TokenAcessoService', () => {
  it('assina e verifica o próprio token', () => {
    expect(servico.verificar(servico.assinar(CONTEUDO, 60))).toMatchObject(CONTEUDO);
  });

  it('recusa token expirado', () => {
    expect(servico.verificar(servico.assinar(CONTEUDO, -1))).toBeNull();
  });

  it('recusa token assinado com outra chave', () => {
    const outro = sign(CONTEUDO, 'outra-chave-com-mais-de-32-caracteres!!', {
      issuer: EMISSOR_TOKEN,
      audience: AUDIENCIA_TOKEN,
    });

    expect(servico.verificar(outro)).toBeNull();
  });

  it('recusa token sem assinatura (alg none)', () => {
    const semAssinatura = sign(CONTEUDO, '', {
      algorithm: 'none',
      issuer: EMISSOR_TOKEN,
      audience: AUDIENCIA_TOKEN,
    });

    expect(servico.verificar(semAssinatura)).toBeNull();
  });

  it('recusa token de outra audiência ou emissor', () => {
    expect(servico.verificar(sign(CONTEUDO, SEGREDO, { audience: 'outra' }))).toBeNull();
    expect(servico.verificar(sign(CONTEUDO, SEGREDO, { issuer: 'outro' }))).toBeNull();
  });

  it('recusa texto que não é token', () => {
    expect(servico.verificar('abc')).toBeNull();
  });
});
