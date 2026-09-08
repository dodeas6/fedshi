import { useState, useRef, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Film, X, Check, Sparkles, Tag, DollarSign, Image as ImageIcon, SwitchCamera, Zap, Sliders, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const FILTERS = [
  { id: 'none', label: 'أصلي', css: 'none' },
  { id: 'warm', label: 'دافئ', css: 'sepia(0.3) saturate(1.4) hue-rotate(-10deg)' },
  { id: 'cool', label: 'بارد', css: 'hue-rotate(180deg) saturate(1.2) brightness(1.05)' },
  { id: 'vivid', label: 'حيوي', css: 'saturate(1.8) contrast(1.15)' },
  { id: 'mono', label: 'أبيض/أسود', css: 'grayscale(1) contrast(1.1)' },
  { id: 'vintage', label: 'كلاسيكي', css: 'sepia(0.5) contrast(0.9) brightness(1.1)' },
  { id: 'soft', label: 'ناعم', css: 'brightness(1.1) contrast(0.9) blur(0.3px)' },
  { id: 'dramatic', label: 'درامي', css: 'contrast(1.4) saturate(1.3) brightness(0.95)' },
]

const RECORDING_TIMES = [15, 30, 60]

export default function UploadPage() {
  const navigate = useNavigate()
  const { profile, user, refreshProfile } = useAuth()
  const [mode, setMode] = useState<'camera' | 'gallery' | 'details'>('camera')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [filter, setFilter] = useState('none')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [recordTime, setRecordTime] = useState(30)
  const [recSecondsLeft, setRecSecondsLeft] = useState(0)
  const [galleryFile, setGalleryFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Start camera
  useEffect(() => {
    if (mode !== 'camera' || recordedBlob) return
    let active = true

    async function startCam() {
      try {
        setCameraError('')
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        })
        if (!active) { s.getTracks().forEach(t => t.stop()); return }
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
      } catch (err: any) {
        setCameraError('تعذّر الوصول للكاميرا. يمكنك رفع فيديو من الاستوديو بدلاً من ذلك.')
      }
    }
    startCam()

    return () => {
      active = false
    }
  }, [mode, facingMode, recordedBlob])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stream])

  const startRecording = () => {
    if (!stream) return
    chunksRef.current = []
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' })
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setRecordedBlob(blob)
      setVideoUrl(URL.createObjectURL(blob))
      setMode('details')
    }
    mr.start()
    mediaRecorderRef.current = mr
    setRecording(true)
    setRecSecondsLeft(recordTime)

    timerRef.current = setInterval(() => {
      setRecSecondsLeft(prev => {
        if (prev <= 1) {
          stopRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setGalleryFile(f)
    setVideoUrl(URL.createObjectURL(f))
    setMode('details')
  }

  const retake = () => {
    setRecordedBlob(null)
    setGalleryFile(null)
    setVideoUrl('')
    setMode('camera')
  }

  const activeFilter = FILTERS.find(f => f.id === filter)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || (!recordedBlob && !galleryFile)) return
    setError('')
    setLoading(true)

    try {
      const file = galleryFile || new File([recordedBlob!], `recording-${Date.now()}.webm`, { type: 'video/webm' })
      const ext = file.name.split('.').pop() || 'mp4'
      const fileName = `${user.id}/${Date.now()}.${ext}`
      await supabase.storage.from('videos').upload(fileName, file, { contentType: file.type })
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('videos').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || title.trim(),
        price: parseInt(price) || 0,
        video_url: urlData.publicUrl,
        sound_name: 'الصوت الأصلي - فدشي',
        status: 'approved',
      })

      if (insertError) throw insertError
      navigate('/profile')
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الرفع')
    }
    setLoading(false)
  }

  if (profile && profile.role === 'viewer') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="bg-slate-900 p-8 rounded-3xl text-center max-w-sm w-full border border-slate-800">
          <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-lg font-black mb-2">النشر مخصص للتجار</h1>
          <p className="text-xs text-slate-400 mb-6">فعّل أدوات التاجر لتتمكن من نشر المنتجات والريلز.</p>
          <button
            onClick={async () => {
              if (!user) return
              await supabase.from('profiles').update({ role: 'merchant' }).eq('id', user.id)
              await refreshProfile()
            }}
            className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-accent-500 rounded-xl text-sm font-bold text-white"
          >
            تفعيل حساب التاجر
          </button>
        </div>
      </div>
    )
  }

  // Camera mode
  if (mode === 'camera' && !recordedBlob) {
    return (
      <div className="fixed inset-0 bg-black z-[100]" style={{ maxWidth: '430px', margin: '0 auto' }}>
        {/* Live camera preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: activeFilter?.css || 'none' }}
        />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 pt-4 px-4">
          <div className="flex justify-between items-center">
            <button onClick={() => navigate('/feed')} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex gap-2">
              {FILTERS.slice(0, 5).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                    filter === f.id ? 'bg-brand-600 text-white' : 'bg-black/50 text-white/70 backdrop-blur-sm'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* All filters row */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                  filter === f.id ? 'bg-brand-600 text-white' : 'bg-black/50 text-white/70 backdrop-blur-sm'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
            <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl text-center max-w-xs w-full border border-slate-800">
              <Camera className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-white mb-2">الكاميرا غير متاحة</p>
              <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
              <button
                onClick={() => { setMode('gallery'); setGalleryFile(null) }}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-bold text-white"
              >
                رفع من الاستوديو
              </button>
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 pt-6 bg-gradient-to-t from-black/80 to-transparent">
          {/* Recording time selector */}
          <div className="flex justify-center gap-2 mb-4">
            {RECORDING_TIMES.map(t => (
              <button
                key={t}
                onClick={() => setRecordTime(t)}
                disabled={recording}
                className={`px-3 py-1 rounded-full text-[11px] font-black transition ${
                  recordTime === t ? 'bg-white text-black' : 'text-white/60'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>

          {/* Record button + gallery + flip */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20"
            >
              <ImageIcon className="w-5 h-5 text-white" />
            </button>

            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!stream && !cameraError}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition active:scale-90"
            >
              {recording ? (
                <div className="w-7 h-7 bg-brand-600 rounded-lg" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand-600" />
              )}
            </button>

            <button
              onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
              className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20"
            >
              <SwitchCamera className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Recording timer */}
          {recording && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-brand-600 px-3 py-1 rounded-full text-white text-xs font-black flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {recSecondsLeft}s
            </div>
          )}
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="video/*"
          onChange={handleGallerySelect}
          className="hidden"
        />
      </div>
    )
  }

  // Details / publish form
  return (
    <div className="min-h-screen bg-black text-white fixed inset-0 z-[90] overflow-y-auto no-scrollbar" style={{ maxWidth: '430px', margin: '0 auto' }}>
      {/* Preview at top */}
      <div className="relative w-full aspect-[9/16] max-h-[50vh] bg-black">
        <video
          ref={previewRef}
          src={videoUrl}
          loop
          muted
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ filter: activeFilter?.css || 'none' }}
        />
        <div className="absolute top-4 left-4 z-10">
          <button onClick={retake} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute top-4 right-4 z-10">
          <span className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-[11px] font-bold text-white">
            {activeFilter?.label}
          </span>
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto no-scrollbar px-4 max-w-full">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                filter === f.id ? 'bg-brand-600 text-white' : 'bg-black/60 text-white/70 backdrop-blur-sm'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="p-5 space-y-4">
        <h2 className="text-lg font-black flex items-center gap-2">
          <Tag className="w-5 h-5 text-brand-500" />
          تفاصيل المنتج
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="عنوان جذاب للمنتج..."
              required
              className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="وصف المنتج، المميزات، الهاشتاغات..."
              className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition resize-none"
            />
          </div>

          <div className="relative">
            <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="السعر بالدينار (مثال: 35000)"
              required
              className="w-full pr-11 pl-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-sm text-white focus:outline-none transition"
            />
          </div>

          {error && (
            <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold py-2.5 px-4 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جارٍ النشر...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                نشر الآن
              </>
            )}
          </button>
        </form>

        <button
          onClick={retake}
          className="w-full text-center text-xs font-bold text-slate-500 hover:text-white transition"
        >
          إعادة التسجيل / اختيار فيديو آخر
        </button>
      </div>
    </div>
  )
}
