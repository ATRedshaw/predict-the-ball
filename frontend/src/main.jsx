import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout.jsx'
import App    from './App.jsx'
import Login  from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'
import Home   from './pages/Home.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"       element={<App />}    />
          <Route path="/login"  element={<Login />}  />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home"   element={<Home />}   />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
