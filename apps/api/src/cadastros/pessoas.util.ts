import { type Disponibilidade } from '@filas/contracts';
import { type DiaSemana, type Turno } from '@prisma/client';

import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';

const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** "Maria Aparecida da Silva" vira "M. A. S." (ADR-003: a abreviação é feita no servidor). */
export function iniciais(nomeCompleto: string): string {
  return nomeCompleto
    .trim()
    .split(/\s+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .map((parte) => `${parte[0]!.toLocaleUpperCase('pt-BR')}.`)
    .join(' ');
}

/** Espaços repetidos não diferenciam nomes na verificação de duplicidade. */
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

const DIAS: DiaSemana[] = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'];

/** O contrato usa 0 (domingo) a 6 (sábado); o banco, o enum DiaSemana. */
export function paraBanco(disponibilidade: Disponibilidade): {
  diaSemana: DiaSemana;
  turno: Turno;
} {
  return { diaSemana: DIAS[disponibilidade.diaSemana]!, turno: disponibilidade.turno };
}

export function doBanco(registro: { diaSemana: DiaSemana; turno: Turno }): Disponibilidade {
  return { diaSemana: DIAS.indexOf(registro.diaSemana), turno: registro.turno };
}

/** Data de calendário (`@db.Date`) como AAAA-MM-DD, sem efeito de fuso. */
export function dataIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const pessoaNaoEncontrada = (rotulo: string) =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    `${rotulo} não encontrado`,
    'O registro não existe ou foi removido.',
  );

export const pessoaDuplicada = (rotulo: string, recursoExistenteId: string, criterio: string) =>
  new ErroDominio(
    'DUPLICIDADE',
    409,
    `${rotulo} já cadastrado`,
    `Já existe ${rotulo.toLowerCase()} com ${criterio}. Abra o cadastro existente.`,
    { recursoExistenteId },
  );

export const pessoaComVinculo = (rotulo: string) =>
  new ErroDominio(
    'VINCULO_ATIVO',
    409,
    'Registro com vínculo ativo',
    `O ${rotulo.toLowerCase()} tem vínculo com triagem, fila, alocação ou atendimento e não pode ser excluído. Você pode inativá-lo: ele deixa de aparecer para novas operações e o histórico é mantido.`,
  );

export const idsInexistentes = (campo: string, rotulo: string) =>
  new ErroValidacao([{ campo, mensagem: `Um ou mais ${rotulo} selecionados não existem.` }]);
