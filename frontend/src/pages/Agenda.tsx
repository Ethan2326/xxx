import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appointmentsAPI } from '@/services/api'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

const TYPE_LABELS: Record<string, string> = {
  premier_appareillage: 'Premier appareillage',
  essai: 'Essai',
  adaptation: 'Adaptation',
  suivi: 'Suivi',
  controle: 'Contrôle',
  sav: 'SAV',
  bilan: 'Bilan',
  renouvellement: 'Renouvellement',
}

const TYPE_COLORS: Record<string, string> = {
  premier_appareillage: 'bg-purple-100 text-purple-700 border-purple-200',
  essai: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  adaptation: 'bg-blue-100 text-blue-700 border-blue-200',
  suivi: 'bg-green-100 text-green-700 border-green-200',
  controle: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  sav: 'bg-red-100 text-red-700 border-red-200',
  bilan: 'bg-orange-100 text-orange-700 border-orange-200',
  renouvellement: 'bg-teal-100 text-teal-700 border-teal-200',
}

export default function AgendaPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const { data: appointments } = useQuery({
    queryKey: ['appointments', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: () => appointmentsAPI.list({
      date_debut: format(weekStart, 'yyyy-MM-dd'),
      date_fin: format(weekEnd, 'yyyy-MM-dd'),
    }).then(r => r.data),
  })

  const getApptForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return (appointments ?? []).filter(a =>
      a.debut.startsWith(dayStr)
    ).sort((a, b) => a.debut.localeCompare(b.debut))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-500 mt-1">
            Semaine du {format(weekStart, 'd MMMM', { locale: fr })} au {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary py-2 px-3" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="btn-secondary" onClick={() => setCurrentWeek(new Date())}>
            Aujourd'hui
          </button>
          <button className="btn-secondary py-2 px-3" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grille semaine */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((day) => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={day.toISOString()} className={`p-3 text-center border-r border-gray-100 last:border-0 ${isToday ? 'bg-brand-50' : ''}`}>
                <div className="text-xs text-gray-500 uppercase">{format(day, 'EEE', { locale: fr })}</div>
                <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-brand-600' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </div>
                <div className="text-xs text-gray-400">{getApptForDay(day).length} RDV</div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDays.map((day) => {
            const dayAppts = getApptForDay(day)
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={day.toISOString()} className={`border-r border-gray-100 last:border-0 p-2 space-y-1 ${isToday ? 'bg-brand-50/30' : ''}`}>
                {dayAppts.map(a => (
                  <div
                    key={a.id}
                    className={`p-2 rounded-lg border text-xs cursor-pointer hover:opacity-80 ${TYPE_COLORS[a.type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    <div className="font-semibold">{format(new Date(a.debut), 'HH:mm')}</div>
                    <div className="mt-0.5 line-clamp-1">{TYPE_LABELS[a.type] ?? a.type}</div>
                    {a.salle && <div className="text-xs opacity-70">{a.salle}</div>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className={`badge ${TYPE_COLORS[key]}`}>{label}</span>
        ))}
      </div>
    </div>
  )
}
