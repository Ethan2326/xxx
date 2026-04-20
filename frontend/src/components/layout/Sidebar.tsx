import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Settings, MessageSquare, FileText,
  ShoppingCart, Sliders, Calendar, Ear
} from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/fitting', icon: Sliders, label: 'Assistant réglage' },
  { to: '/orders', icon: ShoppingCart, label: 'Commandes EDI' },
  { to: '/chatbot', icon: MessageSquare, label: 'Chatbot Audition' },
  { to: '/reports', icon: FileText, label: 'Comptes rendus' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-brand-900 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-brand-800">
        <Ear className="w-7 h-7 text-brand-300 mr-2" />
        <div>
          <div className="text-white font-bold text-sm leading-tight">AudioAssist Pro</div>
          <div className="text-brand-400 text-xs">Audioprothésiste IA</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-white'
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-brand-800">
        <div className="text-brand-500 text-xs text-center">v1.0.0 — RGPD conforme</div>
      </div>
    </aside>
  )
}
