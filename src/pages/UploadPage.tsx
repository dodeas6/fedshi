import { useState, useRef, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Film, X, Check, Sparkles, Tag, DollarSign, Image as ImageIcon, SwitchCamera, Zap, Sliders, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadFileResumable } from '../lib/uploadHelper'
import { useAuth } from '../context/AuthContext'

const FILTERS = [
  { id: 'none', label: 'أصلي', css: 'none', swatch: 'linear-gradient(135deg,#64748b,#94a3b8)' },
  { id: 'warm', label: 'دافئ', css: 'sepia(0.3) saturate(1.4) hue-rotate(-10deg)', swatch: 'linear-gradient(135deg,#f59e0b,#dc2626)' },
  { id: 'cool', label: 'بارد', css: 'hue-rotate(180deg) saturate(1.2) brightness(1.05)', swatch: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
  { id: 'vivid', label: 'حيوي', css: 'saturate(1.8) contrast(1.15)', swatch: 'linear-gradient(135deg,#ec4899,#8b5cf6,#0ea5e9)' },
  { id: 'mono', label: 'أبيض/أسود', css: 'grayscale(1) contrast(1.1)', swatch: 'linear-gradient(135deg,#000,#fff)' },
  { id: 'vintage', label: 'كلاسيكي', css: 'sepia(0.5) contrast(0.9) brightness(1.1)', swatch: 'linear-gradient(135deg,#a16207,#78350f)' },
  { id: 'soft', label: 'ناعم', css: 'brightness(1.1) contrast(0.9) blur(0.3px)', swatch: 'linear-gradient(135deg,#f9a8d4,#e9d5ff)' },
  { id: 'dramatic', label: 'درامي', css: 'contrast(1.4) saturate(1.3) brightness(0.95)', swatch: 'linear-gradient(135deg,#1e293b,#7f1d1d)' },
]

const RECORDING_TIMES = [15, 30, 60]

const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL']

const COLOR_PRESETS = [
  { name: 'أبيض', hex: '#f8fafc' },
  { name: 'أسود', hex: '#0f172a' },
  { name: 'أحمر', hex: '#dc2626' },
  { name: 'أخضر', hex: '#16a34a' },
  { name: 'أزرق', hex: '#2563eb' },
  { name: 'أصفر', hex: '#eab308' },
  { name: 'بنفسجي', hex: '#9333ea' },
  { name: 'بني', hex: '#78350f' },
  { name: 'رمادي', hex: '#6b7280' },
  { name: 'وردي', hex: '#ec4899' },
]

const CATEGORIES = ['ملابس نسائية', 'ملابس رجالية', 'أحذية', 'إكسسوارات', 'تجميل', 'إلكترونيات', 'منزل ومطبخ', 'أخرى']

interface VariantDraft {
  name: string
  hex?: string
  stock: string
}

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
  const [category, setCategory] = useState(CATEGORIES[0])
  const [postType, setPostType] = useState<'reel' | 'product'>('product')
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')

  const [hasSizes, setHasSizes] = useState(false)
  const [sizeStocks, setSizeStocks] = useState<Record<string, string>>({})
  const [hasColors, setHasColors] = useState(false)
  const [selectedColors, setSelectedColors] = useState<VariantDraft[]>([])
  const [customColorName, setCustomColorName] = useState('')

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

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const MAX_VIDEO_MB = 100
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    if (!ALLOWED_VIDEO_TYPES.includes(f.type)) {
      setError('صيغة الفيديو غير مدعومة. استخدم MP4 أو WebM أو MOV')
      return
    }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`حجم الفيديو كبير جداً. الحد الأقصى ${MAX_VIDEO_MB} ميجابايت`)
      return
    }

    setError('')
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

  const toggleSize = (size: string) => {
    setSizeStocks(prev => {
      const next = { ...prev }
      if (size in next) delete next[size]
      else next[size] = '1'
      return next
    })
  }

  const toggleColor = (name: string, hex?: string) => {
    setSelectedColors(prev => {
      if (prev.find(c => c.name === name)) return prev.filter(c => c.name !== name)
      return [...prev, { name, hex, stock: '1' }]
    })
  }

  const addCustomColor = () => {
    const name = customColorName.trim()
    if (!name || selectedColors.find(c => c.name === name)) { setCustomColorName(''); return }
    setSelectedColors(prev => [...prev, { name, stock: '1' }])
    setCustomColorName('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || (!recordedBlob && !galleryFile)) return
    setError('')
    setLoading(true)
    setUploadProgress(0)

    try {
      const file = galleryFile || new File([recordedBlob!], `recording-${Date.now()}.webm`, { type: 'video/webm' })
      const ext = file.name.split('.').pop() || 'mp4'
      const fileName = `${user.id}/${Date.now()}.${ext}`

      // الإصلاح الجوهري: الطريقة القديمة (supabase.storage.upload) موثوقة
      // فقط لملفات أصغر من 6 ميجابايت حسب توثيق Supabase الرسمي، وتفشل
      // برمز 400 مع أي فيديو حقيقي. الآن نستخدم الرفع القابل للاستئناف.
      await uploadFileResumable('videos', fileName, file, setUploadProgress)

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)

      const effectiveType: 'reel' | 'product' = isMerchant ? postType : 'reel'

      const { data: insertedVideo, error: insertError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || title.trim(),
          price: effectiveType === 'product' ? (parseInt(price) || 0) : 0,
          category: effectiveType === 'product' ? category : 'أخرى',
          video_type: effectiveType,
          video_url: urlData.publicUrl,
          sound_name: 'الصوت الأصلي - فدشي',
          status: 'approved',
        })
        .select()
        .single()

      if (insertError) throw insertError

      const variantRows: any[] = []
      if (effectiveType === 'product' && hasSizes) {
        for (const [size, stock] of Object.entries(sizeStocks)) {
          variantRows.push({ video_id: insertedVideo.id, variant_type: 'size', option_name: size, stock: parseInt(stock) || 0 })
        }
      }
      if (effectiveType === 'product' && hasColors) {
        for (const c of selectedColors) {
          variantRows.push({ video_id: insertedVideo.id, variant_type: 'color', option_name: c.name, option_hex: c.hex || null, stock: parseInt(c.stock) || 0 })
        }
      }
      if (variantRows.length > 0) {
        const { error: variantError } = await supabase.from('product_variants').insert(variantRows)
        if (variantError) throw variantError
      }

      navigate('/profile')
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الرفع')
    }
    setLoading(false)
  }

  const isMerchant = profile?.role === 'merchant' || profile?.role === 'admin' || profile?.role === 'super_admin'
  const currentType: 'reel' | 'product' = isMerchant ? postType : 'reel'

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

        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl max-w-[90%] text-center">
            {error}
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 pt-4 px-4">
          <div className="flex justify-between items-center">
            <button onClick={() => navigate('/feed')} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
            {activeFilter && activeFilter.id !== 'none' && (
              <span className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-[11px] font-bold text-white">
                {activeFilter.label}
              </span>
            )}
          </div>

          {/* All filters row */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 pb-1 px-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <span
                  className={`w-11 h-11 rounded-full border-2 transition ${filter === f.id ? 'border-brand-500 scale-110' : 'border-white/30'}`}
                  style={{ background: f.swatch }}
                />
                <span className={`text-[10px] font-bold whitespace-nowrap ${filter === f.id ? 'text-brand-400' : 'text-white/70'}`}>
                  {f.label}
                </span>
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
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2.5 overflow-x-auto no-scrollbar px-4 max-w-full">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={`w-8 h-8 rounded-full border-2 transition ${filter === f.id ? 'border-brand-500 scale-110' : 'border-white/30'}`}
                style={{ background: f.swatch }}
              />
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
          {isMerchant && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setPostType('reel')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                  postType === 'reel' ? 'bg-brand-600 text-white' : 'text-slate-500'
                }`}
              >
                ريلز عادي
              </button>
              <button
                type="button"
                onClick={() => setPostType('product')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                  postType === 'product' ? 'bg-brand-600 text-white' : 'text-slate-500'
                }`}
              >
                منتج للبيع
              </button>
            </div>
          )}

          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={currentType === 'product' ? 'عنوان جذاب للمنتج...' : 'اكتب وصفاً للريلز...'}
              required
              className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="وصف إضافي، هاشتاغات..."
              className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition resize-none"
            />
          </div>

          {currentType === 'product' && (
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
          )}

          {currentType === 'product' && (
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">فئة المنتج</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                    category === cat ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          )}

          {currentType === 'product' && (
          <>
          {/* القياسات */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-slate-200">هل المنتج له قياسات؟</span>
              <input
                type="checkbox"
                checked={hasSizes}
                onChange={e => { setHasSizes(e.target.checked); if (!e.target.checked) setSizeStocks({}) }}
                className="w-5 h-5 accent-brand-600"
              />
            </label>

            {hasSizes && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {SIZE_OPTIONS.map(size => {
                  const active = size in sizeStocks
                  return (
                    <div key={size} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`w-full py-2 rounded-lg text-xs font-black transition ${
                          active ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {size}
                      </button>
                      {active && (
                        <input
                          type="number"
                          min={0}
                          value={sizeStocks[size]}
                          onChange={e => setSizeStocks(prev => ({ ...prev, [size]: e.target.value }))}
                          placeholder="الكمية"
                          className="w-full px-1 py-1.5 bg-black border border-slate-800 rounded-md text-[11px] text-center text-white"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* الألوان */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-slate-200">هل المنتج له ألوان؟</span>
              <input
                type="checkbox"
                checked={hasColors}
                onChange={e => { setHasColors(e.target.checked); if (!e.target.checked) setSelectedColors([]) }}
                className="w-5 h-5 accent-brand-600"
              />
            </label>

            {hasColors && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(c => {
                    const active = !!selectedColors.find(sc => sc.name === c.name)
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => toggleColor(c.name, c.hex)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition border ${
                          active ? 'border-brand-500 bg-brand-600/20 text-white' : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ background: c.hex }} />
                        {c.name}
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customColorName}
                    onChange={e => setCustomColorName(e.target.value)}
                    placeholder="لون آخر (مثال: كحلي)"
                    className="flex-1 px-3 py-2 bg-black border border-slate-800 rounded-lg text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomColor}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-white"
                  >
                    إضافة
                  </button>
                </div>

                {selectedColors.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {selectedColors.map(c => (
                      <div key={c.name} className="flex items-center gap-2">
                        {c.hex && <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ background: c.hex }} />}
                        <span className="text-xs text-slate-300 flex-1">{c.name}</span>
                        <input
                          type="number"
                          min={0}
                          value={c.stock}
                          onChange={e => setSelectedColors(prev => prev.map(x => x.name === c.name ? { ...x, stock: e.target.value } : x))}
                          placeholder="الكمية"
                          className="w-20 px-2 py-1.5 bg-black border border-slate-800 rounded-md text-[11px] text-center text-white"
                        />
                        <button type="button" onClick={() => setSelectedColors(prev => prev.filter(x => x.name !== c.name))} className="text-slate-600 hover:text-brand-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </>
          )}

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
                {uploadProgress > 0 ? `جارٍ الرفع... ${uploadProgress}%` : 'جارٍ التحضير...'}
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
