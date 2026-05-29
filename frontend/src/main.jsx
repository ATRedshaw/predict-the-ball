import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Layout         from './components/Layout.jsx'
import GuestRoute     from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import App    from './App.jsx'
import Login  from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'
import Home   from './pages/Home.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Unauthenticated only */}
          <Route element={<GuestRoute />}>
            <Route path="/"       element={<App />}    />
            <Route path="/login"  element={<Login />}  />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          {/* Authenticated only */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Home />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
