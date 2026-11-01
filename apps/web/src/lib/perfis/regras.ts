import { type Perfil } from './tipos';

export function somenteLeitura(perfil: Pick<Perfil, 'sistema'>) {
  return perfil.sistema;
}

/** T-05: perfil sem nenhuma permissão de consulta pede confirmação antes de salvar. */
export function semPermissaoDeConsulta(permissoes: readonly string[]) {
  return !permissoes.some((p) => p.endsWith(':consultar'));
}

/** Aviso exibido antes de salvar alteração de um perfil já usado; `null` se ninguém é afetado. */
export function avisoUsuariosAfetados(usuariosVinculados: number) {
  if (usuariosVinculados <= 0) return null;
  return usuariosVinculados === 1
    ? 'Esta alteração muda as permissões de 1 usuário.'
    : `Esta alteração muda as permissões de ${usuariosVinculados} usuários.`;
}

export function validarNome(nome: string, perfis: readonly Perfil[], idAtual: string | null) {
  const limpo = nome.trim();
  if (!limpo) return 'Informe o nome do perfil.';
  const repetido = perfis.some(
    (p) =>
      p.id !== idAtual &&
      p.nome.trim().toLocaleLowerCase('pt-BR') === limpo.toLocaleLowerCase('pt-BR'),
  );
  return repetido ? 'Já existe um perfil com este nome. Escolha outro.' : null;
}

export function nomeDaCopia(nome: string, perfis: readonly Perfil[]) {
  const existentes = new Set(perfis.map((p) => p.nome));
  let candidato = `Cópia de ${nome}`;
  for (let n = 2; existentes.has(candidato); n += 1) candidato = `Cópia de ${nome} (${n})`;
  return candidato;
}
