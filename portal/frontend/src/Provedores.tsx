import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider, type ThemeConfig } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { IdentidadeProvider } from './state/identidade';
import { tema } from './theme';

dayjs.locale('pt-br');

/** Tema Neoguard, idioma pt_BR, mensagens do antd e identificação de quem preenche. */
export function Provedores({ children, semAnimacao }: { children: ReactNode; semAnimacao?: boolean }) {
  const temaFinal: ThemeConfig = semAnimacao ? { ...tema, token: { ...tema.token, motion: false } } : tema;
  return (
    <ConfigProvider locale={ptBR} theme={temaFinal}>
      <AntApp>
        <IdentidadeProvider>{children}</IdentidadeProvider>
      </AntApp>
    </ConfigProvider>
  );
}
