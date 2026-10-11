import { useLang } from '../i18n.jsx'
import { StatusBadge } from './ui.jsx'

const COMPONENT_LABEL = {
  do_deficit: ['How far oxygen falls below 5, on average', 'ऑक्सीजन औसतन 5 से कितनी कम'],
  bod_excess: ['How far waste (BOD) goes above 3, on average', 'गंदगी (BOD) औसतन 3 से कितनी ज़्यादा'],
  worst_do: ['The lowest oxygen in the last 2 years', 'पिछले 2 साल की सबसे कम ऑक्सीजन'],
  immersion_impact: ['How often water got worse after immersion', 'विसर्जन के बाद पानी कितनी बार बिगड़ा'],
  ph_out: ['How often pH was outside 6.5–8.5', 'pH कितनी बार 6.5–8.5 से बाहर'],
}

export default function MethodPanel({ overview }) {
  const { t, lang } = useLang()
  const hi = lang === 'hi'
  const m = overview.method
  return (
    <section aria-labelledby="method-h" className="space-y-4 text-[15px] leading-relaxed">
      <h2 id="method-h" className="page-title">{t.methodTitle}</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold">{hi ? '1. किस सीमा से तुलना?' : '1. Which limit do we use?'}</h3>
          <p>
            {hi
              ? 'नहाने के पानी की सीमा (CPCB क्लास B)। विसर्जन के समय लोग घाट पर पानी में उतरते हैं, इसलिए यही सबसे सही है।'
              : 'The bathing-water limit (CPCB Class B). People step into the water at ghats during visarjan, so this fits best.'}
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2 text-center text-sm font-bold">
            <li className="rounded-lg bg-stone-100 p-2">{hi ? 'ऑक्सीजन' : 'Oxygen'}<br />5 {hi ? 'या ज़्यादा' : 'or more'}</li>
            <li className="rounded-lg bg-stone-100 p-2">{hi ? 'गंदगी (BOD)' : 'Waste (BOD)'}<br />3 {hi ? 'या कम' : 'or less'}</li>
            <li className="rounded-lg bg-stone-100 p-2">pH<br />6.5–8.5</li>
          </ul>
          <p className="mt-2 text-sm text-ink-soft">
            {hi
              ? 'इस सीमा में कोलीफॉर्म (कीटाणु) भी है, पर रिपोर्ट में इसकी जाँच नहीं हुई — इसलिए टूल इस पर कुछ नहीं कहता।'
              : 'This limit also covers coliform (germs), but the reports never tested it — so the tool says nothing about it.'}
          </p>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold">{hi ? '2. खतरे के अंक (0–100)' : '2. Risk score (0–100)'}</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {Object.entries(m.weights).map(([k, w]) => (
                <tr key={k} className="border-t border-stone-200">
                  <td className="py-1.5 pr-2">{COMPONENT_LABEL[k][hi ? 1 : 0]}</td>
                  <td className="py-1.5 text-right font-semibold">{Math.round(w * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-ink-soft">
            {hi
              ? 'नई जाँच और दुर्गा विसर्जन की जाँच को ज़्यादा वज़न: इस साल ×1.0, पिछले साल ×0.7, उससे पहले ×0.5; दुर्गा ×1.0, गणेश ×0.8।'
              : 'Newer tests and Durga tests count more: latest year ×1.0, year before ×0.7, before that ×0.5; Durga ×1.0, Ganesh ×0.8.'}
          </p>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold">{hi ? '3. रंग' : '3. Colours'}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="flex items-start gap-2"><StatusBadge status="red" size="sm" />
              <span>{hi ? `अंक ${m.red_score} या ज़्यादा, या पिछले 2 साल में ऑक्सीजन 3 से कम।` : `Score ${m.red_score} or more, or oxygen below 3 in the last 2 years.`}</span></li>
            <li className="flex items-start gap-2"><StatusBadge status="yellow" size="sm" />
              <span>{hi ? 'सीमा पार हुई, पर लाल जितनी नहीं।' : 'Failed the limit sometimes, but not as badly as red.'}</span></li>
            <li className="flex items-start gap-2"><StatusBadge status="green" size="sm" />
              <span>{hi ? 'हाल में कोई सीमा पार नहीं। (इस डेटा में कोई घाट हरा नहीं।)' : 'No recent failures. (No ghat is green in this data.)'}</span></li>
            <li className="flex items-start gap-2"><StatusBadge status="grey" size="sm" />
              <span>{hi ? 'जाँच नहीं हुई। जो डेटा नहीं है, उससे अंक कम नहीं होते और उसे कभी "साफ़" नहीं गिना जाता।' : 'Not tested. Missing data never lowers the score and is never counted as clean.'}</span></li>
          </ul>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold">{hi ? '4. क्या चलता है, क्या नहीं' : '4. What works, what does not'}</h3>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
            {(hi
              ? [
                  'सभी 1,524 रीडिंग, हर एक PDF के पेज से जुड़ी। मुख्य आँकड़े (116 में 42 ऑक्सीजन, 112 में 100 BOD) समस्या विवरण से मेल खाते हैं।',
                  'बिना इंटरनेट या API कुंजी के भी संदेश बनता है (डेटा से)।',
                  'काम और प्रबंधक सिर्फ़ इसी डिवाइस में सहेजे जाते हैं।',
                  'नहीं: कोलीफॉर्म, बाकी धातुएँ, या 2026 की कोई नई जाँच — ये रिपोर्ट में नहीं।',
                  'नहीं: घाटों का नक्शा (रिपोर्ट में जगह के निर्देशांक नहीं)।',
                ]
              : [
                  'All 1,524 readings, each linked to its PDF page. Headline numbers (42 of 116 oxygen, 100 of 112 BOD) match the problem statement.',
                  'Briefs work without internet or an API key (made from the data).',
                  'Tasks and managers are saved on this device only.',
                  'Not covered: coliform, other metals, or any 2026 test — not in the reports.',
                  'Not covered: a map (the reports give no locations).',
                ]
            ).map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}
