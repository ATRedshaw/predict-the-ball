import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom'
import './index.css'
import Layout         from './components/Layout.jsx'
import GuestRoute     from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute     from './components/AdminRoute.jsx'
import HowItWorksRoute from './components/HowItWorksRoute.jsx'
import App            from './App.jsx'
import Login          from './pages/Login.jsx'
import SignUp         from './pages/SignUp.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Home          from './pages/Home.jsx'
import Predictions   from './pages/Predictions.jsx'
import Leagues       from './pages/Leagues.jsx'
import Settings      from './pages/Settings.jsx'
import ModelPredictions from './pages/ModelPredictions.jsx'
import Standings     from './pages/Standings.jsx'
import Admin         from './pages/Admin.jsx'
import Privacy       from './pages/Privacy.jsx'
import Terms         from './pages/Terms.jsx'
import NotFound       from './pages/NotFound.jsx'

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Layout />}>
      {/* Public */}
      <Route path="/" element={<App />} />
      <Route
        path="/how-it-works"
        element={<HowItWorksRoute />}
      />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms"   element={<Terms />}   />

      {/* Unauthenticated only */}
      <Route element={<GuestRoute />}>
        <Route path="/login"           element={<Login />}          />
        <Route path="/signup"          element={<SignUp />}         />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Authenticated only */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"          element={<Home />} />
        <Route path="/predictions"        element={<Predictions />} />
        <Route path="/standings"          element={<Standings />} />
        <Route path="/leagues"            element={<Leagues />} />
        <Route path="/leagues/:leagueId"  element={<Leagues />} />
        <Route path="/model-predictions"  element={<ModelPredictions />} />
        <Route path="/settings"           element={<Settings />} />
      </Route>

      {/* Admin only */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<Admin />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
