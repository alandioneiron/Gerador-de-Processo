import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Provedores } from './Provedores';
import { rotas } from './routes';

export default function App() {
  // Roteador de dados: necessário para o aviso de alterações não salvas (useBlocker).
  const roteador = useMemo(() => createBrowserRouter(rotas), []);
  return (
    <Provedores>
      <RouterProvider router={roteador} future={{ v7_startTransition: true }} />
    </Provedores>
  );
}
