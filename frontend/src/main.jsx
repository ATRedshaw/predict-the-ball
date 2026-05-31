import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Layout         from './components/Layout.jsx'
import GuestRoute     from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import App            from './App.jsx'
import Login          from './pages/Login.jsx'
import SignUp         from './pages/SignUp.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Home          from './pages/Home.jsx'
import Predictions   from './pages/Predictions.jsx'
import Leagues       from './pages/Leagues.jsx'
import Settings      from './pages/Settings.jsx'
import NotFound       from './pages/NotFound.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Unauthenticated only */}
          <Route element={<GuestRoute />}>
            <Route path="/"       element={<App />}    />
            <Route path="/login"           element={<Login />}          />
            <Route path="/signup"          element={<SignUp />}         />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* Authenticated only */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home"               element={<Home />} />
            <Route path="/predictions"        element={<Predictions />} />
            <Route path="/leagues"            element={<Leagues />} />
            <Route path="/model-predictions"  element={<div />} />
            <Route path="/settings"           element={<Settings />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
