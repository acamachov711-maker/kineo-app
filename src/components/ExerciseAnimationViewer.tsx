import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, Activity } from 'lucide-react'
import { ExerciseVariant } from '../types'
import { getLocalExerciseVideoUrl } from '../data/initialData'

interface ExerciseAnimationViewerProps {
  variant: ExerciseVariant
  accentColor?: string
  onClose?: () => void
}

export const ExerciseAnimationViewer: React.FC<ExerciseAnimationViewerProps> = ({
  variant,
  accentColor = '#FF5500'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [videoError, setVideoError] = useState<boolean>(false)

  const videoUrl = variant.localVideoUrl || getLocalExerciseVideoUrl(variant.id)

  useEffect(() => {
    setVideoError(false)
    setIsPlaying(true)
    const v = videoRef.current
    if (v) {
      v.playbackRate = 1.0
      v.currentTime = 0
      v.play().catch(() => {
        // Ignore autoplay restriction if any
      })
    }
  }, [variant.id, videoUrl])

  const handleTogglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.playbackRate = 1.0
      v.play().catch(() => {})
      setIsPlaying(true)
    } else {
      v.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div className="relative w-full h-[295px] rounded-[10px] bg-[#0B090E] overflow-hidden flex items-center justify-center select-none">
      {!videoError ? (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = 1.0
          }}
          onError={() => setVideoError(true)}
          onClick={handleTogglePlay}
          className="w-full h-full object-contain kineo-blend-video cursor-pointer"
        />
      ) : (
        <div className="p-4 text-center space-y-1">
          <p className="font-mono text-[11px] font-bold uppercase theme-text">
            {variant.name}
          </p>
          <p className="text-xs text-[#A09BA8]">
            {variant.muscleGroup} • {variant.equipment}
          </p>
        </div>
      )}

      {/* Subtle status badge top-left */}
      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-[#0B090E]/80 backdrop-blur-sm border border-[#2A2533]/80 font-mono text-[9px] font-bold uppercase flex items-center gap-1.5 pointer-events-none">
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: accentColor }}
        />
        <Activity className="w-3 h-3 theme-text" />
        <span className="text-[#E2DFEA]">{variant.muscleGroup}</span>
      </div>

      {/* Subtle Tempo & Play/Pause bottom bar */}
      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <span className="px-2 py-0.5 rounded bg-[#0B090E]/80 backdrop-blur-sm border border-[#2A2533]/80 font-mono text-[9px] text-[#C7C3D1]">
          ⏱️ {variant.tempo || '2s bajar • 1s pausa • 1s subir'}
        </span>

        <button
          type="button"
          onClick={handleTogglePlay}
          className="p-1.5 rounded-md bg-[#14111A]/90 hover:bg-[#1C1826] text-white border border-[#2A2533] pointer-events-auto"
          title={isPlaying ? 'Pausar demostración' : 'Reproducir demostración'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
