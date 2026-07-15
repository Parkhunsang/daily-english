import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sentenceEn, sentenceKo } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not set in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cleanSentenceEn = sentenceEn.replace(/\*/g, "").trim()
    const cleanSentenceKo = sentenceKo.replace(/\*/g, "").trim()

    const prompt = `Please analyze this English sentence and its Korean translation.
English sentence: "${cleanSentenceEn}"
Korean translation: "${cleanSentenceKo}"

Break down why the sentence is constructed this way, explain key grammar points, define vocabulary words/idioms, and provide natural alternative expressions. Provide all explanation descriptions in friendly and clear Korean.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                translation: {
                  type: 'STRING',
                  description: 'Korean translation of the sentence',
                },
                grammar: {
                  type: 'ARRAY',
                  description: 'Grammar structures or patterns used in the sentence',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      pattern: {
                        type: 'STRING',
                        description: "Grammar pattern name or structure (e.g. 'have to + 동사원형', '과거 완료')",
                      },
                      explanation: {
                        type: 'STRING',
                        description: 'Detailed, easy-to-understand explanation of this pattern in friendly Korean',
                      },
                    },
                    required: ['pattern', 'explanation'],
                  },
                },
                vocabulary: {
                  type: 'ARRAY',
                  description: 'Key words or idioms in the sentence',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      word: {
                        type: 'STRING',
                        description: 'The English word or idiom',
                      },
                      meaning: {
                        type: 'STRING',
                        description: "The Korean meaning matching the sentence's context",
                      },
                      example: {
                        type: 'STRING',
                        description: "An example sentence in English, with Korean translation in parentheses (e.g. 'I am busy. (나는 바쁘다.)')",
                      },
                    },
                    required: ['word', 'meaning', 'example'],
                  },
                },
                alternatives: {
                  type: 'ARRAY',
                  description: 'Alternative natural English expressions with same or similar meaning',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      expression: {
                        type: 'STRING',
                        description: 'Alternative English expression',
                      },
                      meaning: {
                        type: 'STRING',
                        description: "The context/nuance explanation in Korean (e.g. '더 격식 있는 표현입니다.')",
                      },
                    },
                    required: ['expression', 'meaning'],
                  },
                },
              },
              required: ['translation', 'grammar', 'vocabulary', 'alternatives'],
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini API error: ${err}`)
    }

    const data = await response.json()
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    return new Response(
      textContent,
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
