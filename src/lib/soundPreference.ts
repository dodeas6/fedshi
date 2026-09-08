const KEY = 'fedshi_muted'

/**
 * تفضيل الصوت محفوظ في localStorage بدل حالة منفصلة لكل فيديو.
 * هذا يحل مشكلة "يجب فتح الكتم يدوياً في كل فيديو من جديد" — بمجرد
 * أن يفتح المستخدم الصوت مرة واحدة، يبقى مفتوحاً تلقائياً لكل
 * الفيديوهات التالية، وحتى في الجلسات القادمة.
 */
export function getInitialMuted(): boolean {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === null ? true : saved === 'true' // الافتراضي عند أول زيارة: مكتوم
  } catch {
    return true
  }
}

export function saveMutedPreference(muted: boolean) {
  try {
    localStorage.setItem(KEY, String(muted))
  } catch {
    // تجاهل بيئات لا تدعم localStorage
  }
}
