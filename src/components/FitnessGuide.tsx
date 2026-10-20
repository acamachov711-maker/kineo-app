import React, { useState } from 'react'
import { BookOpen, Sparkles, CheckCircle2 } from 'lucide-react'
import { FITNESS_GLOSSARY } from '../data/initialData'

interface FitnessGuideProps {
  highlightedTopicId?: string | null
}

export const FitnessGuide: React.FC<FitnessGuideProps> = ({ highlightedTopicId }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

  const categories = [
    'Todas',
    'Planificación',
    'Técnicas Avanzadas',
    'Seguridad y Pesos',
    'Objetivos'
  ]

  const filtered = FITNESS_GLOSSARY.filter(
    (item) => selectedCategory === 'Todas' || item.category === selectedCategory
  )

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Guía del Gym: Mesociclos, Pirámides, Superseries y Dropsets
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Consulta qué significa cada concepto de tu rutina y cómo ejecutarlo en el gimnasio de
              forma segura.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              selectedCategory === cat
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((item) => {
          const isHighlighted = highlightedTopicId === item.id
          return (
            <div
              key={item.id}
              className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                isHighlighted
                  ? 'bg-indigo-950/30 border-indigo-400 ring-2 ring-indigo-500/30'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  {item.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                  {item.shortBadge}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                {item.summary}
              </p>

              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2 mb-3">
                <p className="text-xs font-bold text-slate-200">Paso a paso en el gym:</p>
                {item.howToApply.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/20 border border-amber-500/30 rounded-xl p-3">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Consejo Kineo:</strong> {item.proTip}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
