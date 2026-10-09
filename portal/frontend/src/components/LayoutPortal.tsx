// Moldura do portal: aviso fixo, barra com logo/menu e identificação de quem preenche.
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Button, Tag } from 'antd';
import logo from '../assets/logo-neoguard.png';
import { MOCK_ATIVO } from '../api';
import { useIdentidade } from '../state/identidade';

export function LayoutPortal() {
  const { autor, trocarAutor } = useIdentidade();

  return (
    <>
      <header className="topo">
        <div className="topo-aviso" role="note">
          <b>Acesso provisório sem login</b> — use só na rede da Neoguard
        </div>
        <div className="topo-barra">
          <Link className="topo-logo" to="/fichas" aria-label="Portal Neoguard — início">
            <img src={logo} alt="Grupo Neoguard — Segurança e Serviços" />
          </Link>
          <nav className="topo-menu" aria-label="Menu principal">
            <NavLink to="/fichas" className={({ isActive }) => (isActive ? 'ativo' : '')}>
              Fichas de Implantação
            </NavLink>
            {/* Fora do SPA: o Gerador de Propostas é estático e fica em /propostas/ */}
            <a href="/propostas/">Gerador de Propostas</a>
          </nav>
          <div className="topo-identidade">
            {MOCK_ATIVO && <Tag color="orange">Dados simulados (mock)</Tag>}
            {autor ? (
              <>
                <span>
                  Preenchendo como <b>{autor.nome}</b> ({autor.email})
                </span>
                <Button size="small" onClick={() => void trocarAutor()}>
                  Trocar
                </Button>
              </>
            ) : (
              <Button size="small" onClick={() => void trocarAutor()}>
                Identificar-me
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="pagina">
        <Outlet />
      </main>
    </>
  );
}
