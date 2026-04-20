import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { authAPI } from '@/services/api'
import { Ear, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authAPI.login(email, password)
      setAuth(data.user, data.access_token)
      navigate('/dashboard')
    } catch {
      setError('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Ear className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">AudioAssist Pro</h1>
          <p className="text-brand-200 mt-1">Plateforme IA pour audioprothésistes</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@centre.fr"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Connexion…</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-brand-300 text-xs mt-6">
          Données de santé — Hébergement HDS conforme RGPD
        </p>
      </div>
    </div>
  )
}
