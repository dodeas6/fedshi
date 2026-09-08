import * as tus from 'tus-js-client'
import { supabase } from './supabase'

/**
 * رفع ملف إلى Supabase Storage باستخدام بروتوكول TUS القابل للاستئناف.
 *
 * لماذا هذا ضروري: الطريقة "العادية" (`supabase.storage.upload()`) موثّقة
 * رسمياً من Supabase على أنها غير موثوقة لأي ملف أكبر من 6 ميجابايت فقط،
 * وتفشل غالباً برمز 400 لأي فيديو حقيقي (كل فيديوهات المنتجات هنا أكبر
 * من ذلك بكثير). هذه الدالة تستبدلها بطريقة الرفع القابل للاستئناف
 * الموصى بها رسمياً، وتدعم ملفات حتى 50 جيجابايت.
 */
export async function uploadFileResumable(
  bucketName: string,
  fileName: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('يجب تسجيل الدخول أولاً')

  const projectUrl = import.meta.env.VITE_SUPABASE_URL as string
  // نستخدم النطاق المباشر للتخزين (storage.supabase.co) بدل النطاق العام،
  // كما توصي به وثائق Supabase لتحسين أداء رفع الملفات الكبيرة
  const projectId = new URL(projectUrl).hostname.split('.')[0]
  const endpoint = `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName: fileName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // إلزامي من Supabase: يجب أن يكون 6 ميجابايت بالضبط
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress) onProgress(Math.round((bytesUploaded / bytesTotal) * 100))
      },
      onSuccess: () => resolve(),
    })

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
      upload.start()
    })
  })
}
