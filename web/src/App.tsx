import { Navigate, Route, Routes } from "react-router-dom";
import { FolegoProvider } from "./ui/contexto";
import { Erro, Layout, Carregando } from "./ui/Layout";
import { Hoje } from "./paginas/Hoje";
import { Projecao } from "./paginas/Projecao";
import { Cenarios } from "./paginas/Cenarios";
import { Entenda } from "./paginas/Entenda";

export function App() {
  return (
    <FolegoProvider carregando={<Carregando />} erro={(m, t) => <Erro mensagem={m} tentar={t} />}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/hoje" replace />} />
          <Route path="/hoje" element={<Hoje />} />
          <Route path="/projecao" element={<Projecao />} />
          <Route path="/cenarios" element={<Cenarios />} />
          <Route path="/entenda" element={<Entenda />} />
          <Route path="*" element={<Navigate to="/hoje" replace />} />
        </Routes>
      </Layout>
    </FolegoProvider>
  );
}
