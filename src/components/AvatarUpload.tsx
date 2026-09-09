import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadFileResumable } from '../lib/uploadHelper'
import { useAuth } from '../context/AuthContext'

interface Props {
  currentAvatar: string
  username: string
  onUploaded: (url: string) => void
}

export default function AvatarUpload({ currentAvatar, username, onUploaded }: Props) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState('')

  const avatar = currentAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${username}`

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const MAX_AVATAR_MB = 8
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

  const uploadFile = async (file: File) => {
    if (!user) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP')
      setShowPicker(false)
      return
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setError(`حجم الصورة كبير جداً. الحد الأقصى ${MAX_AVATAR_MB} ميجابايت`)
      setShowPicker(false)
      return
    }

    setError('')
    setUploading(true)
    setShowPicker(false)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await uploadFileResumable('videos', fileName, file).then(() => ({ error: null })).catch(e => ({ error: e }))
      if (uploadError) throw new Error(uploadError.message || 'فشل رفع الصورة')
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
      onUploaded(urlData.publicUrl)
    } catch (err) {
      console.error('Avatar upload error:', err)
      setError('تعذّر رفع الصورة، حاول مرة أخرى')
    }
    setUploading(false)
  }

  return (
    <div className="relative inline-block">
      <div className="relative" onClick={() => setShowPicker(!showPicker)}>
        <img
          src={avatar}
          alt={username}
          className="w-24 h-24 rounded-full border-2 border-slate-700 object-cover bg-slate-900 cursor-pointer"
        />
        {uploading ? (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        ) : (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center border-2 border-black cursor-pointer">
            <Camera className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[81] bg-brand-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl shadow-xl whitespace-nowrap">
          {error}
        </div>
      )}

      {showPicker && !uploading && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setShowPicker(false)} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[81] bg-slate-800 rounded-2xl p-2 flex gap-2 shadow-2xl border border-slate-700 animate-scaleIn">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-1.5 px-4 py-3 hover:bg-slate-700 rounded-xl transition"
            >
              <Camera className="w-6 h-6 text-cyan-400" />
              <span className="text-[10px] font-bold text-white">كاميرا</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-1.5 px-4 py-3 hover:bg-slate-700 rounded-xl transition"
            >
              <ImageIcon className="w-6 h-6 text-emerald-400" />
              <span className="text-[10px] font-bold text-white">استوديو</span>
            </button>
          </div>
        </>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }}
        className="hidden"
      />
    </div>
  )
}
