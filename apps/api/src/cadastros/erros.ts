import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';

export const naoEncontrado = (rotulo: string) =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    `${rotulo} não encontrada`,
    'O registro não existe ou foi removido.',
  );

export const duplicado = (rotulo: string, recursoExistenteId: string) =>
  new ErroDominio(
    'DUPLICIDADE',
    409,
    `${rotulo} já cadastrada`,
    `Já existe ${rotulo.toLowerCase()} com esse nome. Abra o cadastro existente ou escolha outro nome.`,
    { recursoExistenteId },
  );

/** Detail com o vínculo e a sugestão de inativar (docs/04 §4, T-03). */
export const vinculoAtivo = (rotulo: string, vinculos: string) =>
  new ErroDominio(
    'VINCULO_ATIVO',
    409,
    'Registro com vínculo ativo',
    `${rotulo} está vinculada a ${vinculos} e não pode ser excluída. Você pode inativá-la: ela deixa de aparecer para novas operações e o histórico é mantido.`,
  );

export const recursosInexistentes = (campo: string) =>
  new ErroValidacao([{ campo, mensagem: 'Um ou mais recursos selecionados não existem.' }]);
