import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Home() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout', {})
    } catch {
      // Token may already be invalid — clear it regardless
    }

    localStorage.removeItem('access_token')
    navigate('/')
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <button
        onClick={handleLogout}
        className="border border-white/20 text-white text-sm px-8 py-3 rounded-xl hover:bg-white/10 transition-colors"
      >
        Log out
      </button>
    </div>
  )
}
