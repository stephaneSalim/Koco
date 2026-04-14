/**
 * KoCo — Korean Conversation Companion
 * data.js — Content Library (SNU 3/4/5A)
 * 
 * Structures: grammatical patterns for fluency-focused conversation
 * Units: 8 themes with 4 practice modes each
 * Levels: 3 competency levels (SNU 3, 4, 5A)
 */

// ═══════════════════════════════════════════════════════════════════════════
// LEVEL 1: SNU 3 (débutant-intermédiaire) — Structures réactivables
// ═══════════════════════════════════════════════════════════════════════════

const LEVEL_1_STRUCTURES = [
  {
    pattern: "-아/어서",
    meaning: "because / and then (sequential)",
    examples: ["밥을 먹어서 배가 불러요", "일이 끝나서 집에 갔어요"]
  },
  {
    pattern: "-기 때문에",
    meaning: "because (reason, consequence)",
    examples: ["바빠기 때문에 못 갔어요", "건강하기 때문에 운동을 해요"]
  },
  {
    pattern: "-(으)면",
    meaning: "if / when (conditional)",
    examples: ["피곤하면 쉬세요", "비가 오면 안 나가요"]
  },
  {
    pattern: "-지만",
    meaning: "but / although (contrast)",
    examples: ["피곤하지만 일해야 해요", "작지만 예뻐요"]
  },
  {
    pattern: "-고 싶다",
    meaning: "want to (desire)",
    examples: ["먹고 싶어요", "여행을 가고 싶어요"]
  },
  {
    pattern: "-아/어 보다",
    meaning: "try / attempt",
    examples: ["한번 먹어 봤어요", "해 봤어요"]
  },
  {
    pattern: "-(으)ㄹ 것 같다",
    meaning: "seems like / appears to",
    examples: ["비가 올 것 같아요", "맛있을 것 같아요"]
  },
  {
    pattern: "-게 되다",
    meaning: "come to / end up",
    examples: ["좋아하게 됐어요", "살이 찔 수밖에 없었어요"]
  },
  {
    pattern: "-한테/에게",
    meaning: "to (indirect object marker)",
    examples: ["친구한테 말했어요", "선생님께 물어봤어요"]
  },
  {
    pattern: "-동안",
    meaning: "during / while",
    examples: ["공부하는 동안 음악을 들었어요", "이 영화는 2시간 동안 진행돼요"]
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// LEVEL 2: SNU 4 (intermédiaire) — Structures réactivables
// ═══════════════════════════════════════════════════════════════════════════

const LEVEL_2_STRUCTURES = [
  {
    pattern: "-(으)ㄴ/는 것 같다",
    meaning: "it seems that / it looks like",
    examples: ["이 음식은 건강한 것 같아요", "사람들이 많은 것 같아요"]
  },
  {
    pattern: "-던",
    meaning: "used to / was -ing (past habitual)",
    examples: ["어릴 때 먹던 음식이 그리워요", "자주 가던 카페가 닫혔어요"]
  },
  {
    pattern: "-았/었던",
    meaning: "which was / that had been (past retrospective)",
    examples: ["먹었던 것 중에 가장 맛있었어요", "다녔던 학교"]
  },
  {
    pattern: "-도록",
    meaning: "so that / in order to (purpose/extent)",
    examples: ["건강해지도록 운동해요", "힘낼 수 있도록 응원해요"]
  },
  {
    pattern: "-게",
    meaning: "in a - way / become - (adverbial/resultative)",
    examples: ["조용하게 말씀해요", "슬프게 됐어요"]
  },
  {
    pattern: "-(으)ㄹ수록",
    meaning: "the more... the more...",
    examples: ["먹을수록 맛있어요", "많을수록 좋아요"]
  },
  {
    pattern: "-에 비해서",
    meaning: "compared to",
    examples: ["예전에 비해서 더 건강해졌어요", "다른 사람들에 비해서 운동을 잘해요"]
  },
  {
    pattern: "-뿐만 아니라",
    meaning: "not only... but also",
    examples: ["맛있을 뿐만 아니라 건강해요", "저뿐만 아니라 친구도 좋아해요"]
  },
  {
    pattern: "-는 반면에",
    meaning: "whereas / on the other hand",
    examples: ["여름은 더운 반면에 겨울은 추워요", "A는 좋은 반면에 B는 안 좋아요"]
  },
  {
    pattern: "-더라고요",
    meaning: "I found that / it was... (personal discovery)",
    examples: ["그 영화가 정말 재미있더라고요", "이 음식이 생각보다 맛있더라고요"]
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// LEVEL 3: SNU 5A (avancé) — Structures cibles nouvelles + réactivation
// ═══════════════════════════════════════════════════════════════════════════

const LEVEL_3_STRUCTURES = [
  {
    pattern: "-는 데(에) 좋다/도움이 되다",
    meaning: "is good for -ing / helps with",
    examples: [
      "면역력을 키우는 데에 좋아요",
      "피로를 해소하는 데 도움이 돼요"
    ]
  },
  {
    pattern: "-(으)라면 꼽을 수 있다",
    meaning: "if asked to pick / if I were to choose",
    examples: [
      "건강한 음식이라면 야채를 꼽을 수 있어요",
      "가장 중요한 것이라면 규칙적인 식사를 꼽을 수 있어요"
    ]
  },
  {
    pattern: "-도록 하다",
    meaning: "make/let... / arrange for...",
    examples: [
      "규칙적으로 먹도록 해요",
      "아이가 충분히 자도록 합니다"
    ]
  },
  {
    pattern: "-을뿐더러",
    meaning: "not only... but moreover / furthermore",
    examples: [
      "맛있을뿐더러 건강하기도 해요",
      "효과적일뿐더러 간단해요"
    ]
  },
  {
    pattern: "-는 까닭에",
    meaning: "because of / for the reason that",
    examples: [
      "건강을 지키는 까닭에 규칙적으로 운동해요"
    ]
  },
  {
    pattern: "-으로써",
    meaning: "by means of / through",
    examples: [
      "꾸준한 노력으로써 건강해졌어요",
      "이 음식으로써 면역력을 키울 수 있어요"
    ]
  },
  {
    pattern: "-(으)ㄴ 것은",
    meaning: "the thing is / the fact is",
    examples: [
      "중요한 것은 꾸준함이에요",
      "어려운 것은 습관을 만드는 거예요"
    ]
  },
  {
    pattern: "-기로 하다",
    meaning: "decide to / make a decision to",
    examples: [
      "매일 운동하기로 했어요",
      "건강식을 먹기로 결정했어요"
    ]
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// UNITS — 8 Thèmes SNU 5A
// ═══════════════════════════════════════════════════════════════════════════

const UNITS = {
  // UNIT 1-1: 음식과 영양 (Alimentation & Nutrition) — FULLY IMPLEMENTED
  unit_1_1: {
    id: "unit_1_1",
    title: "음식과 영양",
    subtitle: "Food & Nutrition",
    theme: "Health through proper nutrition and eating habits",
    snu_level: "5A_1-1",
    
    vocabulary: [
      { korean: "면역력을 키우다", meaning: "build immunity" },
      { korean: "끼니를 거르다", meaning: "skip a meal" },
      { korean: "혈액 순환이 잘되다", meaning: "have good blood circulation" },
      { korean: "노화를 방지하다", meaning: "prevent aging" },
      { korean: "만성 질환에 걸리다", meaning: "get a chronic disease" },
      { korean: "균형 잡힌 식사를 하다", meaning: "eat a balanced meal" },
      { korean: "영양이 풍부하다", meaning: "be rich in nutrients" },
      { korean: "피로를 해소하다", meaning: "relieve fatigue" },
      { korean: "영양 불균형", meaning: "nutritional imbalance" },
      { korean: "단백질", meaning: "protein" },
      { korean: "탄수화물", meaning: "carbohydrate" },
      { korean: "지방", meaning: "fat" },
      { korean: "비타민", meaning: "vitamin" },
      { korean: "무기질", meaning: "mineral" }
    ],
    
    targetGrammar: [
      "-(으)라면 꼽을 수 있다",
      "-는 데(에) 좋다",
      "-을뿐더러"
    ],
    
    questions: {
      freeChat: [
        "평소에 건강을 위해 어떤 음식을 먹으려고 노력해요?",
        "즉석식품을 자주 먹으면 어떤 문제가 생길 수 있을까요?",
        "건강에 좋은 음식을 말하라면 뭘 꼽을 수 있어요?",
        "영양 균형을 맞추기 위해 어떤 노력을 해요?",
        "삼계탕 같은 보양식에 대해 어떻게 생각해요?",
        "끼니를 자주 거르는 편이에요? 그 이유는 뭐예요?"
      ],
      debate: [
        "채식주의가 건강에 더 좋다고 생각해요?",
        "정크푸드 광고를 규제해야 할까요?",
        "현대인의 식습관이 예전보다 나빠졌나요?",
        "영양제를 먹는 것이 음식으로 영양을 섭취하는 것보다 효과적일까요?"
      ],
      speaking: [
        "건강에 좋은 음식 하나를 소개하고 효능과 요리법을 설명해 보세요.",
        "최근 먹은 음식 중 가장 영양이 풍부한 음식을 소개해 보세요."
      ],
      speedDrill: [
        "서울에서 쇼핑하기 좋은 장소를 꼽으라면?",
        "가장 기억에 남는 선물을 말하라면?",
        "혼자 살면서 가장 힘든 점을 꼽으라면?",
        "꼭 다시 먹고 싶은 음식을 말하라면?",
        "한국어의 특징을 말하라면?",
        "인생에서 가장 중요한 것 두 가지를 꼽으라면?",
        "면역력을 키우는 데 좋은 음식을 말하라면?",
        "피로를 해소하는 데 효과적인 방법을 꼽으라면?"
      ]
    }
  },

  // UNIT 1-2: 건강한 신체 (Healthy Body) — FULLY IMPLEMENTED
  unit_1_2: {
    id: "unit_1_2",
    title: "건강한 신체",
    subtitle: "Healthy Body",
    theme: "Exercise, posture and healthy habits",
    snu_level: "5A_1-2",

    vocabulary: [
      { korean: "심장", meaning: "heart" },
      { korean: "폐", meaning: "lungs" },
      { korean: "위", meaning: "stomach" },
      { korean: "장", meaning: "intestines" },
      { korean: "근육", meaning: "muscles" },
      { korean: "척추", meaning: "spine" },
      { korean: "관절", meaning: "joints" },
      { korean: "체지방을 줄이다", meaning: "reduce body fat" },
      { korean: "근육량을 늘리다", meaning: "increase muscle mass" },
      { korean: "체력/유연성/근력/지구력을 기르다", meaning: "build stamina/flexibility/strength/endurance" },
      { korean: "뭉친 근육을 풀다", meaning: "loosen stiff muscles" },
      { korean: "바른 자세를 유지하다", meaning: "maintain good posture" },
      { korean: "숙면을 취하다", meaning: "get deep sleep" },
      { korean: "심폐 기능이 향상되다", meaning: "improve cardiopulmonary function" },
      { korean: "목/허리 디스크를 예방하다", meaning: "prevent cervical/lumbar herniation" },
      { korean: "스트레칭을 하다", meaning: "stretch" },
      { korean: "유산소 운동을 하다", meaning: "do cardio" },
      { korean: "근력 운동을 하다", meaning: "do strength training" },
      { korean: "꾸준히 운동하다", meaning: "exercise regularly" }
    ],

    targetGrammar: [
      "-되 (accord + condition)",
      "-(으)ㄹ뿐더러 (non seulement... mais en plus)"
    ],

    questions: {
      freeChat: [
        "평소에 어떤 운동을 즐겨 해요?",
        "건강을 유지하기 위해 어떤 노력을 하고 있어요?",
        "거북목 증후군을 예방하기 위해 어떤 습관이 중요할까요?",
        "걷기 운동의 효과에 대해 어떻게 생각해요?",
        "운동을 꾸준히 하기 어려운 이유가 뭐예요?",
        "바른 자세를 유지하는 게 왜 중요할까요?"
      ],
      debate: [
        "유산소 운동과 근력 운동 중 어느 것이 더 중요하다고 생각해요?",
        "현대인들은 운동을 충분히 하고 있다고 생각해요?",
        "건강을 위해 식단 관리와 운동 중 뭐가 더 효과적일까요?",
        "헬스장보다 걷기 같은 일상 운동이 더 효과적일 수 있을까요?"
      ],
      speaking: [
        "건강한 생활 습관을 위해 실천하고 있는 것을 소개하고 그 효과를 설명해 보세요.",
        "거북목 증후군이 무엇인지 설명하고 예방 방법을 이야기해 보세요."
      ],
      speedDrill: [
        "운동하되 어떻게 해야 해요?",
        "걷기 운동의 효과를 말하라면?",
        "척추 건강을 위해 뭘 해야 해요?",
        "근력 운동을 하면 어떤 점이 좋을뿐더러?",
        "숙면을 취하는 데 좋은 방법을 꼽으라면?",
        "바른 자세를 유지하되 특히 뭘 조심해야 해요?"
      ]
    }
  },

  // UNIT 1-merged: 건강한 삶 통합 (Health Integration) — FULLY IMPLEMENTED
  unit_1_merged: {
    id: "unit_1_merged",
    title: "건강한 삶 — 통합",
    subtitle: "1-1 + 1-2 fusionnés",
    theme: "Alimentation + Corps + Habitudes saines",
    snu_level: "5A_1_merged",

    targetGrammar: [
      "-는 데(에) 좋다/도움이 되다",
      "-(으)라면 꼽을 수 있다",
      "-되",
      "-(으)ㄹ뿐더러"
    ],

    questions: {
      freeChat: [
        "건강을 위해 식습관과 운동 습관 중 뭐가 더 중요하다고 생각해요?",
        "균형 잡힌 식사를 하되 운동도 병행하고 있어요?",
        "면역력을 키우는 데 좋은 음식과 운동을 같이 소개해 보세요.",
        "평소 건강 관리를 위해 하는 것 두 가지를 설명해 보세요.",
        "건강한 생활을 유지하기 어려운 이유가 뭐예요?"
      ],
      debate: [
        "건강에는 음식이 중요할까요, 운동이 중요할까요?",
        "현대인들의 건강이 예전보다 나빠졌다고 생각해요?",
        "영양제를 먹는 것이 운동보다 효율적일 수 있을까요?"
      ],
      speaking: [
        "건강한 삶을 위한 나만의 루틴을 소개해 보세요. 식습관과 운동 습관을 모두 포함해서 말해 보세요.",
        "20~30대가 건강을 유지하기 위해 가장 중요한 것 세 가지를 설명해 보세요."
      ],
      speedDrill: [
        "면역력을 키우는 데 좋은 음식을 말하라면?",
        "꾸준히 운동하되 특히 뭘 조심해야 해요?",
        "균형 잡힌 식사를 하면 어떤 점이 좋을뿐더러?",
        "건강에 좋은 생활 습관을 꼽으라면?",
        "걷기 운동이 좋은 이유를 말하라면?",
        "영양 불균형 상태가 되면 어떤 문제가 생겨요?"
      ]
    }
  },

  // UNIT 2-1: 생활 습관 (Daily Habits) — SCAFFOLD
  unit_2_1: {
    id: "unit_2_1",
    title: "생활 습관",
    subtitle: "Daily Habits",
    theme: "Routines and lifestyle",
    snu_level: "5A_2-1",
    
    vocabulary: [],
    targetGrammar: ["-는 데(에) 좋다", "-게 되다"],
    
    questions: {
      freeChat: [
        "아침에 일어났을 때 항상 하는 일이 뭐예요?",
        "어떤 습관을 바꾸고 싶어요?",
        "좋은 습관을 만드는 데 가장 중요한 게 뭐라고 생각해요?"
      ],
      debate: [
        "휴대폰 없는 삶이 가능할까요?",
        "조기 기상이 생산성에 영향을 미칠까요?"
      ],
      speaking: [
        "가장 좋다고 생각하는 생활 습관을 소개해 보세요."
      ],
      speedDrill: [
        "매일 하는 일이 뭐예요?",
        "언제 가장 에너지가 많아요?",
        "하루를 어떻게 계획해요?"
      ]
    }
  },

  // UNIT 2-2: 환경 의식 (Environmental Awareness) — SCAFFOLD
  unit_2_2: {
    id: "unit_2_2",
    title: "환경 의식",
    subtitle: "Environmental Awareness",
    theme: "Sustainability and eco-consciousness",
    snu_level: "5A_2-2",
    
    vocabulary: [],
    targetGrammar: ["-을뿐더러", "-(으)라면 꼽을 수 있다"],
    
    questions: {
      freeChat: [
        "환경 보호를 위해 뭘 하고 있어요?",
        "일상에서 실천할 수 있는 환경 보호가 뭐가 있을까요?",
        "미래 세대를 위해 우리가 해야 할 일이 뭐예요?"
      ],
      debate: [
        "플라스틱 금지가 현실적일까요?",
        "개인의 노력이 환경 변화에 영향을 미칠 수 있을까요?"
      ],
      speaking: [
        "환경을 지키기 위해 할 수 있는 구체적인 행동을 설명해 보세요."
      ],
      speedDrill: [
        "환경을 위해 뭘 해요?",
        "가장 중요한 환경 문제가 뭐예요?",
        "앞으로 뭘 바꾸고 싶어요?"
      ]
    }
  },

  // UNIT 3-1: 직업과 꿈 (Career & Dreams) — SCAFFOLD
  unit_3_1: {
    id: "unit_3_1",
    title: "직업과 꿈",
    subtitle: "Career & Dreams",
    theme: "Professional aspirations and work",
    snu_level: "5A_3-1",
    
    vocabulary: [],
    targetGrammar: ["-(으)라면 꼽을 수 있다", "-기로 하다"],
    
    questions: {
      freeChat: [
        "어떤 일을 하고 싶어요?",
        "그 일이 왜 좋아요?",
        "꿈을 이루기 위해 뭘 준비하고 있어요?"
      ],
      debate: [
        "돈과 보람, 뭐가 더 중요할까요?",
        "직업 선택에서 타인의 의견이 중요할까요?"
      ],
      speaking: [
        "미래 직업을 소개하고 그것을 선택한 이유를 설명해 보세요."
      ],
      speedDrill: [
        "꿈이 뭐예요?",
        "왜 그 직업을 원해요?",
        "얼마나 준비했어요?"
      ]
    }
  },

  // UNIT 3-2: 관계와 소통 (Relationships & Communication) — SCAFFOLD
  unit_3_2: {
    id: "unit_3_2",
    title: "관계와 소통",
    subtitle: "Relationships & Communication",
    theme: "Interpersonal connections",
    snu_level: "5A_3-2",
    
    vocabulary: [],
    targetGrammar: ["-는데", "-지만", "-았/었던"],
    
    questions: {
      freeChat: [
        "중요한 관계가 뭐예요?",
        "좋은 친구는 어떤 사람이라고 생각해요?",
        "관계를 유지하기 위해 뭘 해요?"
      ],
      debate: [
        "온라인 관계와 오프라인 관계, 뭐가 더 중요할까요?",
        "먼 친구와 자주 연락할 필요가 있을까요?"
      ],
      speaking: [
        "가장 소중한 사람과의 관계를 소개해 보세요."
      ],
      speedDrill: [
        "가장 소중한 사람이 누구예요?",
        "어떻게 알게 됐어요?",
        "왜 중요해요?"
      ]
    }
  },

  // UNIT 4-1: 문화와 예술 (Culture & Arts) — SCAFFOLD
  unit_4_1: {
    id: "unit_4_1",
    title: "문화와 예술",
    subtitle: "Culture & Arts",
    theme: "Cultural appreciation and creativity",
    snu_level: "5A_4-1",
    
    vocabulary: [],
    targetGrammar: ["-는 것 같다", "-더라고요"],
    
    questions: {
      freeChat: [
        "좋아하는 문화 활동이 뭐예요?",
        "한국 문화 중에서 가장 흥미로운 게 뭐예요?",
        "예술이 우리 삶에 뭘 주는지 생각해 본 적 있어요?"
      ],
      debate: [
        "전통 예술이 현대 예술보다 더 가치 있을까요?",
        "예술을 배우는 것이 중요할까요?"
      ],
      speaking: [
        "좋아하는 문화 작품을 소개하고 그 이유를 설명해 보세요."
      ],
      speedDrill: [
        "가장 좋아하는 예술 장르가 뭐예요?",
        "최근에 뭘 봤어요?",
        "왜 좋아해요?"
      ]
    }
  },

  // UNIT 4-2: 여행과 경험 (Travel & Experience) — SCAFFOLD
  unit_4_2: {
    id: "unit_4_2",
    title: "여행과 경험",
    subtitle: "Travel & Experience",
    theme: "Exploration and memories",
    snu_level: "5A_4-2",
    
    vocabulary: [],
    targetGrammar: ["-던", "-았/었던"],
    
    questions: {
      freeChat: [
        "가장 기억에 남는 여행이 뭐예요?",
        "앞으로 어디에 가고 싶어요?",
        "여행에서 가장 중요한 게 뭐라고 생각해요?"
      ],
      debate: [
        "계획적인 여행과 즉흥적인 여행, 뭐가 더 좋을까요?",
        "혼자 여행하는 게 좋을까요, 친구랑 여행하는 게 좋을까요?"
      ],
      speaking: [
        "인상적인 여행 경험을 소개하고 배운 점을 설명해 보세요."
      ],
      speedDrill: [
        "어디를 여행했어요?",
        "언제 갔어요?",
        "뭐가 가장 좋았어요?"
      ]
    }
  },

  // UNIT 5-1: 기후 변화 (Climate Change) — SCAFFOLD
  unit_5_1: {
    id: "unit_5_1",
    title: "기후 변화",
    subtitle: "Climate Change",
    theme: "Global warming and climate impacts",
    snu_level: "5A_5-1",
    
    vocabulary: [],
    targetGrammar: ["-는 데(에) 좋다", "-게 되다"],
    
    questions: {
      freeChat: ["기후 변화의 영향을 느껴본 적 있어요?", "우리가 할 수 있는 게 뭐예요?"],
      debate: ["산업이 환경보다 중요할까요?"],
      speaking: ["기후 변화 문제를 설명해 보세요."],
      speedDrill: ["날씨가 어떻게 변했어요?", "가장 큰 문제가 뭐예요?"]
    }
  },

  // UNIT 5-2: 독특한 지형 (Unique Landscape) — SCAFFOLD
  unit_5_2: {
    id: "unit_5_2",
    title: "독특한 지형",
    subtitle: "Unique Landscape",
    theme: "Geography and tourism",
    snu_level: "5A_5-2",
    
    vocabulary: [],
    targetGrammar: ["-던", "-았/었던"],
    
    questions: {
      freeChat: ["가본 지형 중 가장 아름다운 게 뭐예요?", "특이한 풍경을 소개해 보세요."],
      debate: ["관광지 개발이 필요할까요?"],
      speaking: ["아름다운 풍경지를 소개해 보세요."],
      speedDrill: ["가장 좋은 여행지가 어딜까요?", "언제 그곳을 알게 됐어요?"]
    }
  },

  // UNIT 6-1: 도시와 환경 (City & Environment) — SCAFFOLD
  unit_6_1: {
    id: "unit_6_1",
    title: "도시와 환경",
    subtitle: "City & Environment",
    theme: "Urban sustainability",
    snu_level: "5A_6-1",
    
    vocabulary: [],
    targetGrammar: ["-을뿐더러", "-는 반면에"],
    
    questions: {
      freeChat: ["도시 생활의 장단점이 뭐예요?", "도시를 더 환경 친화적으로 만들려면?"],
      debate: ["대도시 집중이 필요할까요?"],
      speaking: ["도시 문제와 해결책을 설명해 보세요."],
      speedDrill: ["도시의 장점이 뭐예요?", "가장 큰 문제는?"]
    }
  },

  // UNIT 6-2: 주거 공간 (Living Space) — SCAFFOLD
  unit_6_2: {
    id: "unit_6_2",
    title: "주거 공간",
    subtitle: "Living Space",
    theme: "Housing and interior design",
    snu_level: "5A_6-2",
    
    vocabulary: [],
    targetGrammar: ["-도록 하다", "-게"],
    
    questions: {
      freeChat: ["이상적인 집이 어떤 모습일까요?", "주거 환경이 삶에 미치는 영향은?"],
      debate: ["집은 투자일까, 살기 위한 것일까요?"],
      speaking: ["자신의 집을 소개해 보세요."],
      speedDrill: ["어떤 집에서 살고 싶어요?", "가장 중요한 게 뭐예요?"]
    }
  },

  // UNIT 7-1: 인간관계와 심리 (Relationships & Psychology) — SCAFFOLD
  unit_7_1: {
    id: "unit_7_1",
    title: "인간관계와 심리",
    subtitle: "Relationships & Psychology",
    theme: "Social psychology and connections",
    snu_level: "5A_7-1",
    
    vocabulary: [],
    targetGrammar: ["-더라고요", "-는 것 같다"],
    
    questions: {
      freeChat: ["인간관계에서 가장 중요한 게 뭐예요?", "심리 건강은 어떻게 유지해요?"],
      debate: ["혼자가 편할까요, 함께가 편할까요?"],
      speaking: ["좋은 인간관계를 유지하는 방법을 설명해 보세요."],
      speedDrill: ["신뢰가 중요할까요?", "갈등을 어떻게 해결해요?"]
    }
  },

  // UNIT 7-2: 심리와 성격 (Psychology & Personality) — SCAFFOLD
  unit_7_2: {
    id: "unit_7_2",
    title: "심리와 성격",
    subtitle: "Psychology & Personality",
    theme: "Personality type and development",
    snu_level: "5A_7-2",
    
    vocabulary: [],
    targetGrammar: ["--(으)ㄴ 것은", "-기로 하다"],
    
    questions: {
      freeChat: ["자신의 성격을 어떻게 표현해요?", "성격을 바꿀 수 있을까요?"],
      debate: ["타고난 성격과 노력, 뭐가 더 중요할까요?"],
      speaking: ["자신의 성격과 성장 경험을 이야기해 보세요."],
      speedDrill: ["가장 좋은 성격 특성이 뭐예요?", "앞으로 바꾸고 싶은 게?"]
    }
  },

  // UNIT 8-1: 평생 직업 (Lifelong Career) — SCAFFOLD
  unit_8_1: {
    id: "unit_8_1",
    title: "평생 직업",
    subtitle: "Lifelong Career",
    theme: "Career development and growth",
    snu_level: "5A_8-1",
    
    vocabulary: [],
    targetGrammar: ["-도록", "-으로써"],
    
    questions: {
      freeChat: ["커리어 계획이 있어요?", "일에서 가치를 어디서 찾아요?"],
      debate: ["자기 일을 사랑하는 게 중요할까요?"],
      speaking: ["커리어 목표와 그걸 이루기 위한 계획을 설명해 보세요."],
      speedDrill: ["어떤 일이 하고 싶어요?", "성공을 어떻게 정의해요?"]
    }
  },

  // UNIT 8-2: 변화하는 직업 (Changing Jobs) — SCAFFOLD
  unit_8_2: {
    id: "unit_8_2",
    title: "변화하는 직업",
    subtitle: "Changing Jobs",
    theme: "Future of work",
    snu_level: "5A_8-2",
    
    vocabulary: [],
    targetGrammar: ["-게 되다", "-는 데(에)"],
    
    questions: {
      freeChat: ["미래 직업이 어떻게 변할 거 같아요?", "기술이 직업을 대체할까요?"],
      debate: ["AI 시대에 인간만이 할 수 있는 일이 뭘까요?"],
      speaking: ["미래 직업 시장의 변화를 예측해 보세요."],
      speedDrill: ["가장 유망한 직업이 뭐예요?", "어떻게 준비해야 해요?"]
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTERS METADATA — SNU Korean 5A Structure
// ═══════════════════════════════════════════════════════════════════════════

const CHAPTERS = {
  1: {
    major: 1,
    title: "건강한 삶",
    lessons: {
      1: { id: "unit_1_1", title: "음식과 영양" },
      2: { id: "unit_1_2", title: "건강한 신체" }
    }
  },
  2: {
    major: 2,
    title: "행복과 휴식",
    lessons: {
      1: { id: "unit_2_1", title: "생활 습관" },
      2: { id: "unit_2_2", title: "환경 의식" }
    }
  },
  3: {
    major: 3,
    title: "언어와 학습",
    lessons: {
      1: { id: "unit_3_1", title: "직업과 꿈" },
      2: { id: "unit_3_2", title: "관계와 소통" }
    }
  },
  4: {
    major: 4,
    title: "사고와 고정 관념",
    lessons: {
      1: { id: "unit_4_1", title: "문화와 예술" },
      2: { id: "unit_4_2", title: "여행과 경험" }
    }
  },
  5: {
    major: 5,
    title: "기후와 지형",
    lessons: {
      1: { id: "unit_5_1", title: "기후 변화" },
      2: { id: "unit_5_2", title: "독특한 지형" }
    }
  },
  6: {
    major: 6,
    title: "환경과 주거 공간",
    lessons: {
      1: { id: "unit_6_1", title: "도시와 환경" },
      2: { id: "unit_6_2", title: "주거 공간" }
    }
  },
  7: {
    major: 7,
    title: "인간과 심리",
    lessons: {
      1: { id: "unit_7_1", title: "인간관계와 심리" },
      2: { id: "unit_7_2", title: "심리와 성격" }
    }
  },
  8: {
    major: 8,
    title: "직업의 미래",
    lessons: {
      1: { id: "unit_8_1", title: "평생 직업" },
      2: { id: "unit_8_2", title: "변화하는 직업" }
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all grammar structures for a given level
 * @param {number} level - 1 (SNU 3), 2 (SNU 4), or 3 (SNU 5A)
 * @returns {Array} Grammar structures
 */
function getStructuresByLevel(level) {
  switch(level) {
    case 1:
      return LEVEL_1_STRUCTURES;
    case 2:
      return LEVEL_2_STRUCTURES;
    case 3:
      return LEVEL_3_STRUCTURES;
    default:
      return LEVEL_3_STRUCTURES; // Default to advanced
  }
}

/**
 * Get unit content by ID
 * @param {string} unitId - Unit identifier (e.g., "unit_1_1")
 * @returns {Object} Unit data
 */
function getUnit(unitId) {
  return UNITS[unitId] || null;
}

/**
 * Get all available units
 * @returns {Array} Array of unit IDs
 */
function getAllUnits() {
  return Object.keys(UNITS);
}

/**
 * Get a random question from a unit and mode
 * @param {string} unitId - Unit identifier
 * @param {string} mode - Mode name (freeChat, debate, speaking, speedDrill)
 * @returns {string} Random question
 */
function getRandomQuestion(unitId, mode) {
  const unit = getUnit(unitId);
  if (!unit || !unit.questions[mode]) return null;
  
  const questions = unit.questions[mode];
  return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Get context info for API system prompt
 * @param {string} unitId - Current unit
 * @param {number} level - Competency level
 * @returns {Object} Context data
 */
function getSessionContext(unitId, level) {
  const unit = getUnit(unitId);
  const structures = getStructuresByLevel(level);
  
  return {
    unit: unit || null,
    targetLevel: level,
    targetStructures: (unit && unit.targetGrammar) ? unit.targetGrammar : [],
    allTargetStructures: structures,
    vocabulary: (unit && unit.vocabulary) ? unit.vocabulary : []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT for module system
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LEVEL_1_STRUCTURES,
    LEVEL_2_STRUCTURES,
    LEVEL_3_STRUCTURES,
    UNITS,
    getStructuresByLevel,
    getUnit,
    getAllUnits,
    getRandomQuestion,
    getSessionContext
  };
}
