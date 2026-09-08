import { useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
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

  const avatar = currentAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${username}`

  const uploadFile = async (file: File) => {
    if (!user) return
    setUploading(true)
    setShowPicker(false)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}/avatar-${Date.now()}.${ext}`
      await supabase.storage.from('videos').upload(fileName, file, { contentType: file.type })
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
      onUploaded(urlData.publicUrl)
    } catch (err) {
      console.error('Avatar upload error:', err)
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
