import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Manutencoes from './pages/Manutencoes'
import Situacao from './pages/Situacao'
import Deposito from './pages/Deposito'
import Admin from './pages/Admin'
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
          <Route path="/deposito" element={<Deposito />} />
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}
