import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Manutencoes from './pages/Manutencoes'
import Situacao from './pages/Situacao'
import HistoricoInspecoes from './pages/HistoricoInspecoes'
import Deposito from './pages/Deposito'
import Relatorios from './pages/Relatorios'
import NaoConformidades from './pages/NaoConformidades'
import Admin from './pages/Admin'
import AdminMangueiras from './pages/mangueiras/AdminMangueiras'
import VistoriaMangueiras from './pages/mangueiras/Vistoria'
import Header from './components/Header'

export default function App() {
  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inspecao" element={<Home />} />
          <Route path="/manutencoes" element={<Manutencoes />} />
          <Route path="/situacao" element={<Situacao />} />
          <Route path="/historico" element={<HistoricoInspecoes />} />
          <Route path="/deposito" element={<Deposito />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/nao-conformidades" element={<NaoConformidades />} />
          <Route path="/admin/*" element={<Admin />} />
          {/* Setor Hidrantes/Mangueiras — fora do menu principal de propósito
              (ver memória project-central-sci-mangueiras), acesso só por URL direta. */}
          <Route path="/mangueiras" element={<AdminMangueiras />} />
          <Route path="/mangueiras/vistoria" element={<VistoriaMangueiras />} />
        </Routes>
      </main>
    </div>
  )
}
