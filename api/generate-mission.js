export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { unitId, userId } = req.body;

  if (!unitId || !userId) {
    return res.status(400).json({ error: 'unitId et userId requis' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: lesson, error } = await supabase
    .from('lesson_content')
    .select('vocabulary, structures, theme, category, context_snippets, ocr_confidence')
    .eq('unit_id', unitId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !lesson) {
    return res.status(404).json({
      error: '이 단원의 데이터가 없습니다. 먼저 사진을 업로드하세요.'
    });
  }

  const vocab = lesson.vocabulary || [];
  const structures = lesson.structures || [];

  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const selectedVocab = shuffle(vocab).slice(0, 8);
  const selectedStructures = shuffle(structures).slice(0, 5);

  if (selectedVocab.length < 3 || selectedStructures.length < 2) {
    return res.status(422).json({
      error: '데이터가 부족합니다. 더 많은 사진을 업로드하세요.',
      vocab_count: vocab.length,
      structure_count: structures.length
    });
  }

  const missionId = `mission_${unitId}_${Date.now()}`;

  const missionPrompt = `당신은 서울대학교 한국어 교육 전문가입니다.
다음 학습 데이터를 바탕으로 대학원 수준의 미션을 생성하세요.

단원 정보:
- 주제: ${lesson.theme}
- 분야: ${lesson.category}
- 예시 문장: ${(lesson.context_snippets || []).slice(0, 2).join(' / ')}

필수 포함 요소:
문법 구조: ${selectedStructures.join(', ')}
어휘: ${selectedVocab.join(', ')}

지시사항:
1. 미션 전체를 학문적 한국어로 작성하세요. 프랑스어 절대 금지.
2. 형식 선택지 3개를 제시하세요: 에세이, 보고서, 발표
3. '필수 포함 요소' 섹션에 선택된 문법과 어휘를 명시하세요.
4. 학문적 맥락을 구체적으로 설정하세요 (학회, 연구소, 대학 세미나 등).
5. 마지막에 다음 문장을 추가하세요: "도움이 필요하시면 '설명해 주세요'라고 입력하세요."

출력: 반드시 유효한 JSON만 출력. 마크다운 없음.
{
  "mission_id": "${missionId}",
  "title": "미션 제목",
  "format_options": ["에세이", "보고서", "발표"],
  "academic_context": "구체적인 학문적 상황",
  "requirements": {
    "grammar": ${JSON.stringify(selectedStructures)},
    "vocabulary": ${JSON.stringify(selectedVocab)}
  },
  "instructions": "상세한 가이드라인 (한국어)",
  "evaluation_criteria": "평가 기준",
  "help_command": "설명해 주세요"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: missionPrompt }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const mission = JSON.parse(clean);
    return res.json({ success: true, mission });
  } catch (e) {
    console.error('Mission parse error:', e.message, '| raw:', text.slice(0, 300));
    return res.status(500).json({ error: 'Mission generation failed', raw: text });
  }
}
