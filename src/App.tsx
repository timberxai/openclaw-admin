import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthGate from "./components/AuthGate"
import Header from "./components/layout/Header"
import TabNav from "./components/layout/TabNav"
import SkillDetailPage from "./pages/SkillDetailPage"

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <div className="min-h-screen bg-gradient-to-br from-rose-950/40 via-background to-purple-950/40">
          <Header />
          <main className="mx-auto max-w-7xl px-4 pt-4">
            <Routes>
              <Route path="/skills/:name" element={<SkillDetailPage />} />
              <Route path="/*" element={<TabNav />} />
            </Routes>
          </main>
        </div>
      </AuthGate>
    </BrowserRouter>
  )
}
