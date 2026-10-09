import { Link, Navigate, type RouteObject } from 'react-router-dom';
import { LayoutPortal } from './components/LayoutPortal';
import { FichaEditor } from './pages/FichaEditor';
import { FichaImprimir } from './pages/FichaImprimir';
import { FichasLista } from './pages/FichasLista';

function NaoEncontrada() {
  return (
    <div className="pagina">
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/fichas">Voltar às fichas de implantação</Link>
      </p>
    </div>
  );
}

/** Rotas do portal. `/fichas/:id/imprimir` fica fora da moldura (sem menu). */
export const rotas: RouteObject[] = [
  { path: '/', element: <Navigate to="/fichas" replace /> },
  {
    element: <LayoutPortal />,
    children: [
      { path: '/fichas', element: <FichasLista /> },
      { path: '/fichas/:id', element: <FichaEditor /> },
    ],
  },
  { path: '/fichas/:id/imprimir', element: <FichaImprimir /> },
  { path: '*', element: <NaoEncontrada /> },
];
