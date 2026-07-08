const DEFAULT_MODEL = 'gemini-2.5-flash';

function fallbackTranslate(text, source) {
  const normalized = String(text || '').trim().toLowerCase();
  const dictionary = {
    ko: {
      '안녕': 'สวัสดี',
      '안녕, 오늘 하루 어땠어?': 'สวัสดี วันนี้เป็นยังไงบ้าง?',
      '보고 싶어': 'คิดถึงนะ',
      '보고 싶어. 오늘도 네 생각 많이 했어.': 'คิดถึงนะ วันนี้ก็คิดถึงเธอมากเลย',
      '사랑해': 'รักนะ',
      '고마워': 'ขอบคุณนะ',
      '잘 자': 'ฝันดีนะ',
      '오늘 뭐해?': 'วันนี้ทำอะไรอยู่?'
    },
    th: {
      'สวัสดี': '안녕',
      'สวัสดี วันนี้เป็นยังไงบ้าง?': '안녕, 오늘 하루 어땠어?',
      'คิดถึงนะ': '보고 싶어',
      'รักนะ': '사랑해',
      'ขอบคุณนะ': '고마워',
      'ฝันดีนะ': '잘 자',
      'วันนี้ทำอะไรอยู่?': '오늘 뭐해?'
    }
  };

  return dictionary[source]?.[normalized] || (source === 'ko'
    ? `[태국어 번역 준비중] ${text}`
    : `[한국어 번역 준비중] ${text}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text = '', source = 'ko', target = 'th', model = DEFAULT_MODEL } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      translatedText: fallbackTranslate(text, source),
      source,
      target,
      engine: 'fallback'
    });
  }

  try {
    const prompt = [
      `Translate this ${source === 'ko' ? 'Korean' : 'Thai'} message to ${target === 'ko' ? 'Korean' : 'Thai'}.`,
      'Use a natural, affectionate tone for a real couple chat.',
      'Return only the translated text.',
      '',
      text
    ].join('\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
    const payload = await response.json();
    const translatedText = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return res.status(200).json({
      translatedText: translatedText || fallbackTranslate(text, source),
      source,
      target,
      engine: translatedText ? 'gemini' : 'fallback'
    });
  } catch (error) {
    return res.status(200).json({
      translatedText: fallbackTranslate(text, source),
      source,
      target,
      engine: 'fallback'
    });
  }
}
