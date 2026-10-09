import type { ThemeConfig } from 'antd';

// Paleta da ficha (docx): marinho #1B2A4A + dourado #B8963E. Barra do portal: dourado #C9A24B / grafite #161616.
export const COR = {
  marinho: '#1B2A4A',
  dourado: '#B8963E',
  douradoPortal: '#C9A24B',
  grafite: '#161616',
  laranja: '#E16B01',
  texto: '#1A1712',
  ok: '#54B45F',
  erro: '#E5533B',
} as const;

export const tema: ThemeConfig = {
  token: {
    colorPrimary: COR.marinho,
    colorInfo: COR.marinho,
    colorSuccess: COR.ok,
    colorError: COR.erro,
    colorWarning: COR.laranja,
    colorLink: COR.marinho,
    colorLinkHover: COR.dourado,
    colorText: COR.texto,
    fontFamily: "Arial, 'Helvetica Neue', system-ui, -apple-system, 'Segoe UI', sans-serif",
    borderRadius: 4,
    fontSize: 14,
  },
  components: {
    Tabs: {
      itemSelectedColor: COR.marinho,
      itemHoverColor: COR.dourado,
      inkBarColor: COR.douradoPortal,
      titleFontSize: 14,
    },
    Button: {
      defaultBorderColor: '#BDBDBD',
    },
    Table: {
      headerBg: COR.marinho,
      headerColor: '#fff',
      headerSortActiveBg: '#2a3d66',
      headerSortHoverBg: '#2a3d66',
      rowHoverBg: '#F3ECDD',
    },
  },
};
