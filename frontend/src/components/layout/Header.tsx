import { useAuthStore } from '@/store'
import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span className="font-medium">
              {user.first_name} {user.last_name}
            </span>
            {user.centre && (
              <span className="text-gray-400">— {user.centre}</span>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
