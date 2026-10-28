import { PERMISSOES } from '@filas/contracts';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner } from '@nestjs/core';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AlocacaoModule } from './alocacao/alocacao.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { AuditoriaConsultaModule } from './auditoria/auditoria-consulta.module';
import { AusenciasModule } from './ausencias/ausencias.module';
import { CadastrosModule } from './cadastros/cadastros.module';
import { CHAVE_PUBLICO } from './common/autorizacao/decorators';
import { EventosDominioModule } from './common/eventos/eventos-dominio';
import { IdempotenciaModule } from './common/idempotencia/idempotencia.service';
import { RelogioModule } from './common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from './common/testing/app-integracao';
import { type AppDeTeste } from './common/testing/criar-app-de-teste';
import { FilasModule } from './filas/filas.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { ParametrosModule } from './parametros/parametros.module';
import { PerfisModule } from './perfis/perfis.module';
import { SenhasModule } from './senhas/senhas.module';
import { TriagemModule } from './triagem/triagem.module';

/** Conteúdo clínico e nome completo nunca saem em listagem (ADR-003, P-03). */
const CHAVES_SENSIVEIS = ['motivo', 'justificativaClinica', 'observacoes', 'nomeCompleto'];

/**
 * Listagens que devolvem nome completo por desenho: o cadastro de pacientes é o objeto da tela
 * (decidido na #14, docs/07 lacuna 7 da triagem). Continua sem conteúdo clínico.
 */
const PERMITE_NOME = new Set(['/api/v1/pacientes']);

/** `bloqueio.motivo` é o motivo operacional do bloqueio da fila (RN-10), não da triagem. */
const CAMINHOS_OPERACIONAIS = /\.bloqueio\.motivo$/;

const MODULOS: Type[] = [
  EventosDominioModule,
  IdempotenciaModule,
  RelogioModule,
  ParametrosModule,
  PerfisModule,
  CadastrosModule,
  AuditoriaConsultaModule,
  TriagemModule,
  SenhasModule,
  FilasModule,
  AlocacaoModule,
  AtendimentosModule,
  AusenciasModule,
  IndicadoresModule,
];

/** Parâmetros obrigatórios de algumas listagens. */
const QUERY: Record<string, string> = {
  '/api/v1/indicadores/resumo': 'de=2020-01-01&ate=2099-12-31',
  '/api/v1/indicadores/volume-por-especialidade': 'de=2020-01-01&ate=2099-12-31',
};

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let admin: SessaoDeTeste;
const ids: Record<string, string> = {};
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;

function controllersDe(modulo: Type, vistos = new Set<Type>()): Type[] {
  if (vistos.has(modulo)) return [];
  vistos.add(modulo);
  const proprios = (Reflect.getMetadata('controllers', modulo) as Type[] | undefined) ?? [];
  const importados = (Reflect.getMetadata('imports', modulo) as Type[] | undefined) ?? [];
  return [
    ...proprios,
    ...importados.filter((i) => typeof i === 'function').flatMap((i) => controllersDe(i, vistos)),
  ];
}

/** GET autenticados que não terminam em `:id` (detalhe) nem são exportação de arquivo. */
function rotasDeListagem(): string[] {
  const scanner = new MetadataScanner();
  const vistos = new Set<Type>();
  const rotas = new Set<string>();
  for (const controller of MODULOS.flatMap((modulo) => controllersDe(modulo, vistos))) {
    const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    for (const metodo of scanner.getAllMethodNames(controller.prototype as object)) {
      const handler = (controller.prototype as Record<string, object>)[metodo]!;
      if (Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.GET) continue;
      if (
        Reflect.getMetadata(CHAVE_PUBLICO, handler) ||
        Reflect.getMetadata(CHAVE_PUBLICO, controller)
      )
        continue;
      const caminho = [base, String(Reflect.getMetadata(PATH_METADATA, handler) ?? '')]
        .filter((parte) => parte && parte !== '/')
        .join('/');
      if (/:id$/.test(caminho) || /exportacao$/.test(caminho)) continue;
      rotas.add(`/api/v1/${caminho}`);
    }
  }
  return [...rotas].sort();
}

function chavesSensiveis(valor: unknown, caminho = '$', achadas: string[] = []): string[] {
  if (Array.isArray(valor))
    valor.forEach((item, i) => chavesSensiveis(item, `${caminho}[${i}]`, achadas));
  else if (valor && typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      if (CHAVES_SENSIVEIS.includes(chave)) achadas.push(`${caminho}.${chave}`);
      chavesSensiveis(filho, `${caminho}.${chave}`, achadas);
    }
  }
  return achadas;
}

describe('listagens sem dado sensível (ADR-003, #30)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: MODULOS });
    admin = await entrarComPermissoes(contexto, [...PERMISSOES]);
    const paciente = await contexto.prisma.paciente.create({
      data: {
        nomeCompleto: unico('Helena Martins Costa'),
        documento: `${Date.now()}${++seq}`.slice(-11),
        dataNascimento: new Date('1955-01-01'),
        vinculo: 'EXTERNO',
        unidadeId: UNIDADE_PADRAO,
      },
    });
    const especialidade = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Sensivel'),
        unidadeId: UNIDADE_PADRAO,
        filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'S', letraSenha: 'S' } },
      },
      include: { filas: true },
    });
    const triagem = await contexto.prisma.triagem.create({
      data: {
        pacienteId: paciente.id,
        profissionalId: admin.usuarioId,
        especialidadeDestinoId: especialidade.id,
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        prioridade: 'URGENTE',
        motivo: 'Motivo clinico sigiloso',
        justificativaClinica: 'Justificativa clinica sigilosa',
        observacoes: 'Observacao clinica sigilosa',
      },
    });
    const senha = await contexto.prisma.senha.create({
      data: {
        numero: 'S001',
        filaId: especialidade.filas[0]!.id,
        triagemId: triagem.id,
        pacienteId: paciente.id,
        prioridade: 'URGENTE',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        status: 'EM_ATENDIMENTO',
      },
    });
    const alocacao = await contexto.prisma.alocacao.create({
      data: {
        senhaId: senha.id,
        estudanteId: (
          await contexto.prisma.estudante.create({
            data: {
              nome: unico('Estudante'),
              especialidadeId: especialidade.id,
              nivelFormacao: '9º',
            },
          })
        ).id,
        salaId: (
          await contexto.prisma.sala.create({
            data: { identificacao: unico('Sala'), unidadeId: UNIDADE_PADRAO },
          })
        ).id,
        confirmadaPor: admin.usuarioId,
      },
    });
    await contexto.prisma.atendimento.create({
      data: {
        senhaId: senha.id,
        alocacaoId: alocacao.id,
        validacaoExigida: false,
        observacoes: 'Observacao do atendimento sigilosa',
      },
    });
    ids.filas = especialidade.filas[0]!.id;
    ids.senhas = senha.id;
    const triagemSugestoes = await contexto.prisma.triagem.create({
      data: {
        pacienteId: paciente.id,
        profissionalId: admin.usuarioId,
        especialidadeDestinoId: especialidade.id,
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        prioridade: 'NORMAL',
        motivo: 'Motivo clinico sigiloso',
        observacoes: 'Observacao sigilosa',
      },
    });
    ids.sugestoes = (
      await contexto.prisma.senha.create({
        data: {
          numero: 'S002',
          filaId: especialidade.filas[0]!.id,
          triagemId: triagemSugestoes.id,
          pacienteId: paciente.id,
          prioridade: 'NORMAL',
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
          status: 'CHAMADA',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('descobre as listagens a partir dos controllers', () => {
    expect(rotasDeListagem()).toEqual(
      expect.arrayContaining([
        '/api/v1/triagens',
        '/api/v1/atendimentos',
        '/api/v1/filas/:id/senhas',
        '/api/v1/senhas/:id/alocacao/sugestoes',
      ]),
    );
  });

  it('nenhuma listagem devolve motivo, justificativaClinica, observacoes ou nomeCompleto', async () => {
    const violacoes: string[] = [];
    const falhas: string[] = [];
    for (const rota of rotasDeListagem()) {
      const recurso = rota.split('/')[3]!;
      const id = rota.endsWith('/alocacao/sugestoes') ? ids.sugestoes : ids[recurso];
      const url = rota.replace(':id', id ?? '');
      const resposta = await request(contexto.servidor)
        .get(QUERY[rota] ? `${url}?${QUERY[rota]}` : url)
        .set('Authorization', `Bearer ${admin.token}`);
      if (resposta.status !== 200) {
        falhas.push(`${rota}: ${resposta.status}`);
        continue;
      }
      const achadas = chavesSensiveis(resposta.body).filter(
        (achada) =>
          !CAMINHOS_OPERACIONAIS.test(achada) &&
          !(PERMITE_NOME.has(rota) && achada.endsWith('.nomeCompleto')),
      );
      violacoes.push(...achadas.map((achada) => `${rota} ${achada}`));
      expect(resposta.text).not.toMatch(/sigilos[ao]/);
    }

    expect(falhas).toEqual([]);
    expect(violacoes).toEqual([]);
  });
});
