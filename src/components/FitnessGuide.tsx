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
      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-md bg-[#0B090E] border border-[#2A2533] flex items-center justify-center theme-text shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-white">
              Guía del Gym: Mesociclos, Pirámides, Superseries y Dropsets
            </h2>
            <p className="text-xs text-[#C7C3D1] mt-1 leading-relaxed">
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
                ? 'theme-bg theme-border'
                : 'bg-[#0B090E] text-[#C7C3D1] border-[#2A2533] hover:border-[#3A3345]'
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
              className={`rounded-[10px] p-4 sm:p-5 border transition-all ${
                isHighlighted
                  ? 'bg-[#14111A] theme-border'
                  : 'bg-[#14111A] border-[#2A2533]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] theme-text">
                  {item.category}
                </span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]">
                  {item.shortBadge}
                </span>
              </div>

              <h3 className="text-base sm:font-display text-2xl text-white mb-2">{item.title}</h3>
              <p className="text-xs sm:text-sm text-[#C7C3D1] leading-relaxed mb-3">
                {item.summary}
              </p>

              <div className="bg-[#0B090E] border border-[#2A2533] rounded-md p-3.5 space-y-2 mb-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8]">Paso a paso en el gym:</p>
                {item.howToApply.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#C7C3D1]">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 text-xs text-[#E2DFEA] bg-[#0B090E] border border-[#2A2533] border-l-[3px] theme-border rounded-md p-3">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 theme-text" />
                <span>
                  <strong className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text">Consejo Kineo:</strong> {item.proTip}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
