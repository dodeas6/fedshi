import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { getInitialMuted, saveMutedPreference } from './soundPreference'

interface SoundContextValue {
  isMuted: boolean
  setMuted: (muted: boolean) => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

/**
 * يوفّر حالة كتم الصوت لكل الفيديوهات معاً من مكان واحد مشترك.
 * قبل هذا، كان كل فيديو (ReelItem) يقرأ التفضيل المحفوظ بمفرده عبر
 * useState(getInitialMuted) — وبما أن كل الفيديوهات تُحمَّل دفعة واحدة
 * مسبقاً (وليس كل واحد عند الوصول إليه)، فإن فتح الصوت على فيديو واحد
 * لا ينعكس على البقية لأن حالتهم already تم تثبيتها عند أول تحميل.
 * الآن الجميع يشترك بنفس المتغيّر، فأي تغيير ينعكس على الكل فوراً.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(getInitialMuted)

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted)
    saveMutedPreference(muted)
  }, [])

  return (
    <SoundContext.Provider value={{ isMuted, setMuted }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound يجب أن يُستخدم داخل SoundProvider')
  return ctx
}
