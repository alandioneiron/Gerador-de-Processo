// Rótulos exatos do docx (ordem = ordem de leitura linha a linha das grades).
import type {
  ConfiguracaoChave,
  ParticularidadeChave,
  TesteCconChave,
  TesteTecnicoChave,
} from '../api/types';

export const PARTICULARIDADES_ROTULOS: Record<ParticularidadeChave, string> = {
  animais: 'Animais',
  portaria_24h: 'Portaria 24h',
  gerador: 'Gerador',
  nobreak: 'Nobreak',
  internet: 'Internet disponível',
  rede_cabeada: 'Rede cabeada',
  wifi: 'Wi-Fi',
  cftv: 'CFTV',
  controle_acesso: 'Controle de acesso',
  cerca_eletrica: 'Cerca elétrica',
  automacao: 'Automação',
  botao_panico: 'Botão de pânico',
  neoguard_imagens: 'Neoguard Imagens',
  outros_sistemas: 'Outros sistemas de segurança',
};

export const CONFIGURACOES_ROTULOS: Record<ConfiguracaoChave, string> = {
  temporizacoes: 'Temporizações de entrada/saída ajustadas',
  identificacao_zonas: 'Identificação de zonas configurada',
  autoativacao: 'Autoativação configurada (se solicitada)',
  identificacao_usuarios: 'Identificação de usuários configurada',
  pgm_automacao: 'PGM / automação configurada (se contratado)',
  notificacoes_app: 'Notificações do aplicativo configuradas',
  panico: 'Pânico configurado (se contratado)',
  outro: 'Outro:',
};

export const TESTES_TECNICOS_ROTULOS: Record<TesteTecnicoChave, string> = {
  central_energizada: 'Central energizada corretamente',
  arme: 'Arme testado',
  bateria: 'Bateria instalada e testada',
  desarme: 'Desarme testado',
  sirene: 'Sirene testada',
  aplicativo: 'Aplicativo testado',
  sensores: 'Sensores testados',
  comunicacao_principal: 'Comunicação principal testada',
  todas_zonas: 'Todas as zonas testadas',
  comunicacao_contingencia: 'Comunicação de contingência testada (se aplicável)',
  identificacao_zonas: 'Identificação das zonas conferida',
  particoes: 'Partições testadas',
};

export const TESTES_CCON_ROTULOS: Record<TesteCconChave, string> = {
  evento_arme: 'Evento de arme recebido',
  falha_energia: 'Falha de energia recebida/validada',
  evento_desarme: 'Evento de desarme recebido',
  restabelecimento: 'Restabelecimento recebido/validado',
  disparo: 'Disparo recebido',
  comunicacao_principal: 'Comunicação principal validada',
  zona_correta: 'Zona correta identificada',
  comunicacao_contingencia: 'Comunicação de contingência validada',
  usuario_identificado: 'Usuário identificado corretamente',
  lista_contatos: 'Lista de contatos cadastrada',
  ordem_contatos: 'Ordem de contatos conferida',
  regras_operacionais: 'Regras operacionais cadastradas',
  aplicativo: 'Aplicativo validado (se aplicável)',
};

export const ROTULO_PERMISSAO: Record<string, string> = {
  arma_desarma: 'Arma/Desarma',
  so_arma: 'Só arma',
  '': '',
};

export const ROTULO_SIM_NAO: Record<string, string> = { sim: 'Sim', nao: 'Não', '': '' };
