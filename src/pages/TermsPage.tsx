import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldAlert } from 'lucide-react'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      <div className="max-w-2xl mx-auto p-5 space-y-6">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/auth'))}
          className="text-slate-400 flex items-center gap-1 text-xs font-bold"
        >
          <ArrowRight className="w-4 h-4" /> رجوع
        </button>

        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-brand-500" />
          <h1 className="text-xl font-black">شروط الاستخدام وسياسة المسؤولية</h1>
        </div>
        <p className="text-[11px] text-slate-500">آخر تحديث: 2026</p>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">1. طبيعة المنصة</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            فدشي هي منصة وسيطة تتيح للمستخدمين نشر محتوى مرئي (ريلز) وعرض منتجات للبيع مباشرة بين التاجر والمشتري.
            المنصة لا تُنتج، ولا تراجع مسبقاً، ولا تملك أي محتوى ينشره المستخدمون، وتعمل فقط كوسيط تقني لعرض هذا المحتوى.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">2. المسؤولية الكاملة تقع على الناشر</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            كل مستخدم ينشر فيديو، صورة، تعليقاً، أو أي محتوى آخر على المنصة يتحمّل وحده كامل المسؤولية القانونية
            والأخلاقية عن هذا المحتوى. باستخدامك للمنصة، تقرّ وتوافق على أن:
          </p>
          <ul className="text-xs text-slate-300 leading-relaxed list-disc pr-5 space-y-1">
            <li>المحتوى الذي تنشره ملكك أو لديك الحق القانوني الكامل لنشره.</li>
            <li>أنت المسؤول الوحيد عن أي ضرر أو نزاع أو مطالبة قانونية تنشأ عن محتواك.</li>
            <li>فدشي لا تتحمّل أي مسؤولية مدنية أو جنائية عن أي منشور، تعليق، أو منتج ينشره أي مستخدم آخر غيرك.</li>
            <li>المنصة غير مسؤولة عن دقة أوصاف المنتجات أو جودتها أو مطابقتها لما هو معروض؛ هذه مسؤولية التاجر الناشر وحده.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">3. المحتوى الممنوع منعاً باتاً</h2>
          <p className="text-xs text-slate-300 leading-relaxed">يُمنع نشر أي محتوى يتضمن:</p>
          <ul className="text-xs text-slate-300 leading-relaxed list-disc pr-5 space-y-1">
            <li>مواد إباحية أو جنسية صريحة، أو محتوى يستغل القُصّر بأي شكل.</li>
            <li>خطاب كراهية، عنصرية، أو تحريض على العنف ضد أي فرد أو جماعة.</li>
            <li>أسلحة، متفجرات، أو تعليمات لصنع أي أداة إيذاء.</li>
            <li>مشاهد قتل، عنف صريح، أو تعذيب حقيقية أو تمثيلية مروّعة.</li>
            <li>ترويج أو تشجيع للانتحار أو إيذاء النفس.</li>
            <li>بيع مواد محظورة قانونياً (مخدرات، أدوية بدون رخصة، سلع مقلّدة تنتهك حقوق الملكية).</li>
            <li>احتيال، نصب، أو منتجات وهمية غير موجودة فعلياً.</li>
          </ul>
          <p className="text-xs text-slate-300 leading-relaxed">
            أي حساب ينشر شيئاً من ذلك يُحظر فوراً ونهائياً، وقد يُبلَّغ للجهات المختصة إذا اقتضت الحاجة القانونية ذلك.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">4. حق المنصة في الإشراف والإزالة</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            تحتفظ فدشي بالحق الكامل، دون الحاجة لإذن مسبق، في مراجعة أو حذف أو إخفاء أي محتوى، وتعليق أو حظر أي
            حساب يخالف هذه الشروط، بناءً على بلاغات المستخدمين أو تقدير فريق الإدارة، دون تحمّل أي مسؤولية تجاه
            الناشر عن هذا الإجراء.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">5. تحديد المسؤولية</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            تُقدَّم المنصة "كما هي" دون أي ضمانات. لا تتحمّل فدشي أو فريقها أي مسؤولية عن أي ضرر مباشر أو غير مباشر
            ينتج عن استخدام المنصة، بما في ذلك على سبيل المثال لا الحصر: خسارة مالية من صفقة بين مستخدمين، تعرّضك
            لمحتوى مسيء نشره طرف آخر، أو أي نزاع بين تاجر ومشترٍ.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">6. الإبلاغ</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            إذا صادفت محتوى يخالف هذه الشروط، استخدم زر "إبلاغ" الموجود على كل فيديو. يراجع فريقنا كل البلاغات
            ويتخذ الإجراء المناسب في أقرب وقت ممكن.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-black text-brand-400">7. التعديل على الشروط</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            يجوز لفدشي تعديل هذه الشروط في أي وقت. استمرارك باستخدام المنصة بعد أي تعديل يُعتبر موافقة ضمنية
            على الشروط الجديدة.
          </p>
        </section>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mt-6">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            بالضغط على "إنشاء الحساب" أثناء التسجيل، فإنك تقرّ بأنك قرأت هذه الشروط بالكامل وتوافق عليها،
            وتتحمّل وحدك كامل المسؤولية القانونية عن أي محتوى تنشره على المنصة.
          </p>
        </div>
      </div>
    </div>
  )
}
