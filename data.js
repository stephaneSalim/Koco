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
        "영양 균형을 맞추기 위해 어떤 노력을 해요?"
      ],
      debate: [
        "채식주의가 건강에 더 좋다고 생각해요?",
        "정크푸드 광고를 규제해야 할까요?",
        "현대인의 식습관이 예전보다 나빠졌나요?"
      ],
      speaking: [
        "건강에 좋은 음식 하나를 소개하고 효능과 요리법을 설명해 보세요."
      ],
      speedDrill: [
        "어떤 음식이 면역력을 키워요?",
        "끼니를 거르면 왜 안 돼요?",
        "피로를 해소하는 데 좋은 음식이 뭐예요?",
        "영양 균형을 맞추려면 뭐를 해야 해요?"
      ]
    }
  },

  // UNIT 1-2: 운동과 건강 (Exercise & Health) — SCAFFOLD
  unit_1_2: {
    id: "unit_1_2",
    title: "운동과 건강",
    subtitle: "Exercise & Health",
    theme: "Physical activity and wellness",
    snu_level: "5A_1-2",
    
    vocabulary: [],
    targetGrammar: ["-는 데(에) 좋다", "-(으)라면 꼽을 수 있다"],
    
    questions: {
      freeChat: [
        "일주일에 몇 번 운동해요?",
        "어떤 운동이 가장 효과적이라고 생각해요?",
        "운동할 때 가장 어려운 점이 뭐예요?"
      ],
      debate: [
        "아침 운동이 저녁 운동보다 더 좋아요?",
        "헬스장에 다니는 것이 집에서 하는 운동보다 효과적일까요?"
      ],
      speaking: [
        "선호하는 운동을 소개하고 그 장점을 설명해 보세요."
      ],
      speedDrill: [
        "주로 어떤 운동을 해요?",
        "운동이 어떻게 도움이 돼요?",
        "일주일에 얼마나 자주 해요?"
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

