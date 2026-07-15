import { createClient } from "@supabase/supabase-js";

/**
 * Calls the Supabase Edge Function to get the sentence analysis securely.
 */
async function callSupabaseEdgeFunction(sentenceEn, sentenceKo, supabaseUrl, supabaseKey) {
  try {
    const cleanedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '').trim();
    const supabase = createClient(cleanedUrl, supabaseKey);
    
    const { data, error } = await supabase.functions.invoke("explain-sentence", {
      body: { sentenceEn, sentenceKo }
    });

    if (error) {
      throw new Error(error.message || "에러가 발생했습니다.");
    }

    return data;
  } catch (err) {
    console.error("Supabase Edge Function invocation failed:", err);
    throw new Error(`Supabase AI 호출 실패: Edge Function('explain-sentence')이 새 Supabase 프로젝트에 배포되지 않았습니다. 설정⚙️에서 개인 Gemini API Key를 등록하여 직접 연동하여 이용해 주세요.`);
  }
}

/**
 * Calls the Gemini API directly using the user's provided API key.
 */
async function callGeminiDirectly(sentenceEn, sentenceKo, apiKey) {
  const cleanSentenceEn = sentenceEn.replace(/\*/g, "").trim();
  const cleanSentenceKo = sentenceKo.replace(/\*/g, "").trim();

  const prompt = `Please analyze this English sentence and its Korean translation.
English sentence: "${cleanSentenceEn}"
Korean translation: "${cleanSentenceKo}"

Break down why the sentence is constructed this way, explain key grammar points, define vocabulary words/idioms, and provide natural alternative expressions. Provide all explanation descriptions in friendly and clear Korean.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            translation: {
              type: "STRING",
              description: "Korean translation of the sentence",
            },
            grammar: {
              type: "ARRAY",
              description: "Grammar structures or patterns used in the sentence",
              items: {
                type: "OBJECT",
                properties: {
                  pattern: {
                    type: "STRING",
                    description: "Grammar pattern name or structure (e.g. 'have to + 동사원형', '과거 완료')",
                  },
                  explanation: {
                    type: "STRING",
                    description: "Detailed, easy-to-understand explanation of this pattern in friendly Korean",
                  },
                },
                required: ["pattern", "explanation"],
              },
            },
            vocabulary: {
              type: "ARRAY",
              description: "Key words or idioms in the sentence",
              items: {
                type: "OBJECT",
                properties: {
                  word: {
                    type: "STRING",
                    description: "The English word or idiom",
                  },
                  meaning: {
                    type: "STRING",
                    description: "The Korean meaning matching the sentence's context",
                  },
                  example: {
                    type: "STRING",
                    description: "An example sentence in English, with Korean translation in parentheses (e.g. 'I am busy. (나는 바쁘다.)')",
                  },
                },
                required: ["word", "meaning", "example"],
              },
            },
            alternatives: {
              type: "ARRAY",
              description: "Alternative natural English expressions with same or similar meaning",
              items: {
                type: "OBJECT",
                properties: {
                  expression: {
                    type: "STRING",
                    description: "Alternative English expression",
                  },
                  meaning: {
                    type: "STRING",
                    description: "The context/nuance explanation in Korean (e.g. '더 격식 있는 표현입니다.')",
                  },
                },
                required: ["expression", "meaning"],
              },
            },
          },
          required: ["translation", "grammar", "vocabulary", "alternatives"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API 호출에 실패했습니다: ${errMsg}`);
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error("Gemini API로부터 올바른 응답을 받지 못했습니다.");
  }

  try {
    return JSON.parse(textContent);
  } catch (parseErr) {
    console.error("Failed to parse Gemini response as JSON", parseErr, textContent);
    throw new Error("Gemini 응답 JSON 파싱에 실패했습니다.");
  }
}

/**
 * Fetches sentence analysis (grammar, vocabulary, alternatives) from Gemini API (directly or via Supabase proxy).
 * @param {string} sentenceEn - The English sentence.
 * @param {string} sentenceKo - The Korean translation.
 * @param {string} apiKey - The user's Gemini API Key.
 * @param {string} supabaseUrl - The Supabase Project URL.
 * @param {string} supabaseKey - The Supabase anon key.
 * @returns {Promise<object>} The parsed JSON explanation.
 */
export async function fetchSentenceExplanation(sentenceEn, sentenceKo, apiKey, supabaseUrl, supabaseKey) {
  if (!apiKey) {
    if (supabaseUrl && supabaseKey) {
      return callSupabaseEdgeFunction(sentenceEn, sentenceKo, supabaseUrl, supabaseKey);
    }
    throw new Error("AI 해설을 이용하려면 설정⚙️에서 Supabase 연동을 활성화하거나, 개인 Gemini API Key를 등록해 주세요.");
  }

  return callGeminiDirectly(sentenceEn, sentenceKo, apiKey);
}
