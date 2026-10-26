import React, { useState } from 'react'
import { BookOpen, Sparkles, CheckCircle2, Flame, Zap, Activity } from 'lucide-react'
import { FITNESS_GLOSSARY } from '../data/initialData'

interface FitnessGuideProps {
  highlightedTopicId?: string | null
}

type CardioMachineId = 'treadmill' | 'elliptical' | 'stairmaster' | 'bike'
type CardioMomentId = 'warmup' | 'post_weights' | 'session_e'

interface CardioBlockRow {
  phase: string
  minutes: string
  speedLabel: string
  inclineOrLevel: string
  cue: string
}

const CARDIO_MACHINES: { id: CardioMachineId; name: string; iconLabel: string; paramTitle: string }[] = [
  {
    id: 'treadmill',
    name: 'Caminadora (Treadmill)',
    iconLabel: '🏃 Caminadora',
    paramTitle: 'Inclinación (%)'
  },
  {
    id: 'elliptical',
    name: 'Elíptica (Cero Impacto)',
    iconLabel: '⚡ Elíptica',
    paramTitle: 'Resistencia / Rampa'
  },
  {
    id: 'stairmaster',
    name: 'Escaladora (StairMaster)',
    iconLabel: '🪜 Escaladora',
    paramTitle: 'Nivel / Escalones'
  },
  {
    id: 'bike',
    name: 'Bicicleta Estática',
    iconLabel: '🚴 Bicicleta',
    paramTitle: 'Resistencia (Nivel)'
  }
]

const CARDIO_MOMENTS: {
  id: CardioMomentId
  badge: string
  title: string
  duration: string
  recommendation: string
}[] = [
  {
    id: 'warmup',
    badge: '🔥 Al Inicio',
    title: 'Calentamiento Articular (5–8 min)',
    duration: '5–8 min',
    recommendation:
      'Sube la temperatura corporal y lubrica rodillas/caderas sin gastar el glucógeno que necesitas para levantar pesado.'
  },
  {
    id: 'post_weights',
    badge: '⚡ Al Final de las Pesas (Recomendado)',
    title: 'Recomposición & Oxidación de Grasa (15–20 min)',
    duration: '15–20 min',
    recommendation:
      'El momento ideal: tras las pesas tus reservas de glucógeno están bajas y el cardio con inclinación prioriza la oxidación de grasa.'
  },
  {
    id: 'session_e',
    badge: '🏃 Día Específico',
    title: 'Acondicionamiento Completo (25–30 min)',
    duration: '25–30 min',
    recommendation:
      'Para la Sesión E o días enfocados en resistencia cardiovascular y salud metabólica.'
  }
]

const CARDIO_PROTOCOLS: Record<CardioMachineId, Record<CardioMomentId, CardioBlockRow[]>> = {
  treadmill: {
    warmup: [
      {
        phase: 'Min 0 – 3',
        minutes: '3 min',
        speedLabel: '4.5 km/h (2.8 mph)',
        inclineOrLevel: '1.5% – 2.0%',
        cue: 'Paso fluido soltando cadera y hombros.'
      },
      {
        phase: 'Min 3 – 7',
        minutes: '4 min',
        speedLabel: '5.3 km/h (3.3 mph)',
        inclineOrLevel: '3.5% – 4.0%',
        cue: 'Activa glúteo y pantorrilla sin llegar a jadear.'
      }
    ],
    post_weights: [
      {
        phase: 'Bloque 1 (Entrada)',
        minutes: '3 min',
        speedLabel: '4.8 km/h (3.0 mph)',
        inclineOrLevel: '4.0% incl.',
        cue: 'Estabiliza respiración tras las pesas.'
      },
      {
        phase: 'Bloque 2 (Zona Quema)',
        minutes: '10 min',
        speedLabel: '5.2 – 5.6 km/h (3.2–3.5 mph)',
        inclineOrLevel: '8.0% – 10.0% incl.',
        cue: 'Caminata firme en pendiente sin sujetarte del pasamanos.'
      },
      {
        phase: 'Bloque 3 (Pico Metabólico)',
        minutes: '4 min',
        speedLabel: '5.4 km/h (3.4 mph)',
        inclineOrLevel: '11.0% – 12.0% incl.',
        cue: 'Pasos cortos empujando con el talón para activar glúteo.'
      },
      {
        phase: 'Bloque 4 (Vuelta a la calma)',
        minutes: '3 min',
        speedLabel: '4.2 km/h (2.6 mph)',
        inclineOrLevel: '1.0% incl.',
        cue: 'Baja pulsaciones gradualmente antes de bajar.'
      }
    ],
    session_e: [
      {
        phase: 'Bloque 1 (Calentamiento)',
        minutes: '4 min',
        speedLabel: '5.0 km/h (3.1 mph)',
        inclineOrLevel: '3.0% incl.',
        cue: 'Ritmo cómodo progresivo.'
      },
      {
        phase: 'Bloque 2 (Pirámide de Pendiente)',
        minutes: '12 min',
        speedLabel: '5.4 km/h (3.4 mph)',
        inclineOrLevel: '6% ➔ 9% ➔ 12% incl.',
        cue: 'Sube 3% de inclinación cada 4 minutos.'
      },
      {
        phase: 'Bloque 3 (Sostenido Zona 2)',
        minutes: '9 min',
        speedLabel: '5.6 km/h (3.5 mph)',
        inclineOrLevel: '7.5% incl.',
        cue: 'Ritmo constante donde puedas hablar frases cortas.'
      },
      {
        phase: 'Bloque 4 (Enfriamiento)',
        minutes: '3 min',
        speedLabel: '4.2 km/h (2.6 mph)',
        inclineOrLevel: '1.0% incl.',
        cue: 'Recuperación completa.'
      }
    ]
  },
  elliptical: {
    warmup: [
      {
        phase: 'Min 0 – 3',
        minutes: '3 min',
        speedLabel: '115 – 125 SPM',
        inclineOrLevel: 'Nivel 3 – 4',
        cue: 'Tracción suave con brazos y piernas.'
      },
      {
        phase: 'Min 3 – 7',
        minutes: '4 min',
        speedLabel: '130 – 140 SPM',
        inclineOrLevel: 'Nivel 5 – 6',
        cue: 'Activa torso y tren inferior sin fatiga.'
      }
    ],
    post_weights: [
      {
        phase: 'Bloque 1 (Inicio)',
        minutes: '3 min',
        speedLabel: '125 SPM',
        inclineOrLevel: 'Nivel 5',
        cue: 'Encuentra una cadencia fluida.'
      },
      {
        phase: 'Bloque 2 (Empuje Firme)',
        minutes: '10 min',
        speedLabel: '135 – 145 SPM',
        inclineOrLevel: 'Nivel 8 – 10',
        cue: 'Apoya todo el talón en el pedal para reclutar glúteo.'
      },
      {
        phase: 'Bloque 3 (Intervalo Fuerte)',
        minutes: '4 min',
        speedLabel: '150 SPM',
        inclineOrLevel: 'Nivel 11 – 12',
        cue: 'Empuja y jala también con los brazos.'
      },
      {
        phase: 'Bloque 4 (Enfriamiento)',
        minutes: '3 min',
        speedLabel: '110 SPM',
        inclineOrLevel: 'Nivel 3',
        cue: 'Baja el pulso suavemente.'
      }
    ],
    session_e: [
      {
        phase: 'Bloque 1 (Entrada)',
        minutes: '5 min',
        speedLabel: '125 SPM',
        inclineOrLevel: 'Nivel 5',
        cue: 'Movilidad general.'
      },
      {
        phase: 'Bloque 2 (Olas de Resistencia)',
        minutes: '16 min',
        speedLabel: '140 SPM',
        inclineOrLevel: 'Alterna Nivel 7 y Nivel 11',
        cue: 'Cambia de resistencia cada 2 minutos.'
      },
      {
        phase: 'Bloque 3 (Cierre y Calma)',
        minutes: '5 min',
        speedLabel: '115 SPM',
        inclineOrLevel: 'Nivel 4',
        cue: 'Respiración nasal profunda.'
      }
    ]
  },
  stairmaster: {
    warmup: [
      {
        phase: 'Min 0 – 6',
        minutes: '6 min',
        speedLabel: '45 – 55 pasos/min',
        inclineOrLevel: 'Nivel 4 – 5',
        cue: 'Paso completo apoyando todo el pie sin recargarte en los brazos.'
      }
    ],
    post_weights: [
      {
        phase: 'Bloque 1 (Adaptación)',
        minutes: '3 min',
        speedLabel: '50 pasos/min',
        inclineOrLevel: 'Nivel 5',
        cue: 'Torso erguido, manos solo rozan el soporte por equilibrio.'
      },
      {
        phase: 'Bloque 2 (Escalada Glúteo)',
        minutes: '9 min',
        speedLabel: '60 – 70 pasos/min',
        inclineOrLevel: 'Nivel 7 – 8',
        cue: 'Sube pisando firme con el talón.'
      },
      {
        phase: 'Bloque 3 (Cumbre)',
        minutes: '3 min',
        speedLabel: '75 pasos/min',
        inclineOrLevel: 'Nivel 9 – 10',
        cue: 'Ritmo intenso manteniendo postura alta.'
      },
      {
        phase: 'Bloque 4 (Descenso)',
        minutes: '2 min',
        speedLabel: '45 pasos/min',
        inclineOrLevel: 'Nivel 4',
        cue: 'Recupera el aliento.'
      }
    ],
    session_e: [
      {
        phase: 'Bloque 1 (Base)',
        minutes: '5 min',
        speedLabel: '55 pasos/min',
        inclineOrLevel: 'Nivel 5',
        cue: 'Cadencia constante.'
      },
      {
        phase: 'Bloque 2 (Trabajo Principal)',
        minutes: '15 min',
        speedLabel: '65 – 75 pasos/min',
        inclineOrLevel: 'Nivel 7 – 9',
        cue: 'Puedes alternar 1 min normal y 1 min subiendo de 2 en 2 escalones.'
      },
      {
        phase: 'Bloque 3 (Enfriamiento)',
        minutes: '5 min',
        speedLabel: '45 pasos/min',
        inclineOrLevel: 'Nivel 4',
        cue: 'Baja pulsaciones.'
      }
    ]
  },
  bike: {
    warmup: [
      {
        phase: 'Min 0 – 6',
        minutes: '6 min',
        speedLabel: '75 – 85 RPM',
        inclineOrLevel: 'Nivel 4 – 5',
        cue: 'Pedaleo ágil para lubricar rodillas antes de Prensa o Sentadilla.'
      }
    ],
    post_weights: [
      {
        phase: 'Bloque 1 (Rodaje)',
        minutes: '3 min',
        speedLabel: '80 RPM',
        inclineOrLevel: 'Nivel 5',
        cue: 'Ajusta el asiento a la altura de tu cadera.'
      },
      {
        phase: 'Bloque 2 (Subida Sostenida)',
        minutes: '10 min',
        speedLabel: '75 – 85 RPM',
        inclineOrLevel: 'Nivel 8 – 11',
        cue: 'Siente resistencia firme en cuádriceps sin perder cadencia.'
      },
      {
        phase: 'Bloque 3 (Sprints Controlados)',
        minutes: '4 min',
        speedLabel: '95 – 105 RPM',
        inclineOrLevel: 'Nivel 9',
        cue: 'Alterna 30s rápidos y 30s suaves.'
      },
      {
        phase: 'Bloque 4 (Vuelta a la calma)',
        minutes: '3 min',
        speedLabel: '70 RPM',
        inclineOrLevel: 'Nivel 3',
        cue: 'Pedaleo ligero.'
      }
    ],
    session_e: [
      {
        phase: 'Bloque 1 (Entrada)',
        minutes: '5 min',
        speedLabel: '80 RPM',
        inclineOrLevel: 'Nivel 5',
        cue: 'Calentamiento progresivo.'
      },
      {
        phase: 'Bloque 2 (Fondo Zona 2)',
        minutes: '17 min',
        speedLabel: '85 – 90 RPM',
        inclineOrLevel: 'Nivel 8 – 10',
        cue: 'Cadencia continua y respiración controlada.'
      },
      {
        phase: 'Bloque 3 (Enfriamiento)',
        minutes: '3 min',
        speedLabel: '70 RPM',
        inclineOrLevel: 'Nivel 3',
        cue: 'Soltar piernas.'
      }
    ]
  }
}

export const FitnessGuide: React.FC<FitnessGuideProps> = ({ highlightedTopicId }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')
  const [selectedMachine, setSelectedMachine] = useState<CardioMachineId>('treadmill')
  const [selectedMoment, setSelectedMoment] = useState<CardioMomentId>('post_weights')

  const categories = [
    'Todas',
    'Cardio Guiado',
    'Planificación',
    'Técnicas Avanzadas',
    'Seguridad y Pesos',
    'Objetivos'
  ]

  const filtered = FITNESS_GLOSSARY.filter(
    (item) => selectedCategory === 'Todas' || item.category === selectedCategory
  )

  const currentMachineObj =
    CARDIO_MACHINES.find((m) => m.id === selectedMachine) || CARDIO_MACHINES[0]
  const currentMomentObj =
    CARDIO_MOMENTS.find((m) => m.id === selectedMoment) || CARDIO_MOMENTS[1]
  const currentRows = CARDIO_PROTOCOLS[selectedMachine][selectedMoment]

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-md bg-[#0B090E] border border-[#2A2533] flex items-center justify-center theme-text shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-white">
              Guía del Gym & Cardio Guiado (Velocidad + Inclinación %)
            </h2>
            <p className="text-xs text-[#C7C3D1] mt-1 leading-relaxed">
              Consulta el protocolo exacto de Cardio (cuándo hacerlo, a qué velocidad e inclinación)
              y cómo aplicar cada técnica de tu rutina.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
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

      {/* V1.6-11: MÓDULO SIMPLE DE CARDIO GUIADO CON VELOCIDAD E INCLINACIÓN (%) */}
      {(selectedCategory === 'Todas' || selectedCategory === 'Cardio Guiado') && (
        <div className="rounded-[10px] bg-[#14111A] border theme-border p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2533] pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 theme-text" />
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] theme-text block">
                  Módulo V1.6 • Cardio Inteligente Sin Impacto Muscular
                </span>
                <h3 className="font-display text-2xl text-white">
                  Guía de Cardio: Velocidad + Inclinación (%)
                </h3>
              </div>
            </div>
            <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40">
              ⚡ Óptimo: 15–20 min post-pesas
            </span>
          </div>

          {/* 1. Selector de Momento */}
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-2">
              1. ¿En qué momento de la sesión vas a hacer cardio?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CARDIO_MOMENTS.map((m) => {
                const active = selectedMoment === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMoment(m.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'theme-soft-bg theme-border text-white shadow-md'
                        : 'bg-[#0B090E] border-[#2A2533] text-[#C7C3D1]'
                    }`}
                  >
                    <span className="font-mono text-[10px] font-bold theme-text block">
                      {m.badge}
                    </span>
                    <p className="text-xs font-extrabold text-white mt-0.5">{m.title}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Selector de Máquina */}
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-2">
              2. Elige el aparato de cardio:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CARDIO_MACHINES.map((mach) => {
                const active = selectedMachine === mach.id
                return (
                  <button
                    key={mach.id}
                    type="button"
                    onClick={() => setSelectedMachine(mach.id)}
                    className={`py-2.5 px-3 rounded-xl border font-mono text-xs font-bold transition-all ${
                      active
                        ? 'theme-bg theme-border'
                        : 'bg-[#0B090E] border-[#2A2533] text-[#C7C3D1]'
                    }`}
                  >
                    {mach.iconLabel}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recomendación del momento seleccionado */}
          <div className="p-3 rounded-md bg-[#0B090E] border border-[#2A2533] flex items-start gap-2.5 text-xs text-[#E2DFEA]">
            <Zap className="w-4 h-4 theme-text shrink-0 mt-0.5" />
            <div>
              <strong className="font-mono text-[10px] uppercase theme-text block">
                Por qué elegir este bloque ({currentMomentObj.duration}):
              </strong>
              <span>{currentMomentObj.recommendation}</span>
            </div>
          </div>

          {/* Tabla de bloques con Velocidad e Inclinación (%) */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] px-2">
              <div className="col-span-3">Bloque / Tiempo</div>
              <div className="col-span-3">Velocidad / Ritmo</div>
              <div className="col-span-3">{currentMachineObj.paramTitle}</div>
              <div className="col-span-3">Enfoque Técnico</div>
            </div>

            {currentRows.map((row, rIdx) => (
              <div
                key={rIdx}
                className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-[#0B090E] border border-[#2A2533] text-xs"
              >
                <div className="col-span-3">
                  <span className="font-bold text-white block">{row.phase}</span>
                  <span className="font-mono text-[10px] theme-text font-semibold">
                    ⏱️ {row.minutes}
                  </span>
                </div>
                <div className="col-span-3 font-mono font-bold text-white">
                  {row.speedLabel}
                </div>
                <div className="col-span-3">
                  <span className="inline-block font-mono text-[11px] font-extrabold px-2 py-0.5 rounded theme-soft-bg theme-text border theme-border">
                    {row.inclineOrLevel}
                  </span>
                </div>
                <div className="col-span-3 text-[11px] text-[#C7C3D1] leading-snug">
                  {row.cue}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GLOSARIO DEL GYM */}
      {selectedCategory !== 'Cardio Guiado' && (
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
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] theme-text flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
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
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8]">
                    Paso a paso en el gym:
                  </p>
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
                    <strong className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text">
                      Consejo Kineo:
                    </strong>{' '}
                    {item.proTip}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
