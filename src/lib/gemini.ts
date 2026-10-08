// Mentor's online mode: Google Gemini through Firebase AI Logic (Gemini Developer
// API, usable on the free Spark plan). The API key stays inside Firebase.
import { getAI, getGenerativeModel, GoogleAIBackend, type Content } from 'firebase/ai'
import { app } from './firebase'

// Tried in order; the first one this project can use is remembered.
const MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
const KEY = 'mentor-model'

const SYSTEM = `You are "Mentor", the assistant inside Mera Khata, a shop and home accounts app used in Pakistan.
- Reply in the same language the user writes in (English, Urdu or Roman Urdu). Be short and clear; use bullet points for lists.
- For questions about the user's own shop, stock, loans, spending or balances, use ONLY the data given in the message. Never invent figures. If the data doesn't contain the answer, say so.
- Money is Pakistani Rupees; write amounts like "Rs 12,500".
- For questions about jobs, news, prices or anything current, use Google Search. For jobs give the post, department, last date and the official link, and remind the user to verify on the official website before applying.
- Never ask for or repeat CNIC numbers, passwords or PINs.`

export interface GeminiReply {
  text: string
  sources: { title: string; uri: string }[]
  searchHtml?: string
}

let cachedModel: string | null = null

export async function askGemini(question: string, context: string, history: Content[], search: boolean): Promise<GeminiReply> {
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  let stored: string | null = null
  try {
    stored = localStorage.getItem(KEY)
  } catch {
    // storage unavailable
  }
  const order = [...new Set([cachedModel, stored, ...MODELS].filter(Boolean) as string[])]
  let lastErr: unknown = null
  for (const name of order) {
    try {
      const model = getGenerativeModel(ai, {
        model: name,
        systemInstruction: SYSTEM,
        ...(search ? { tools: [{ googleSearch: {} }] } : {}),
      })
      const chat = model.startChat({ history })
      const res = await chat.sendMessage(`${context}\n\nQUESTION: ${question}`)
      cachedModel = name
      try {
        localStorage.setItem(KEY, name)
      } catch {
        // ignore
      }
      const cand = res.response.candidates?.[0]
      const g = cand?.groundingMetadata
      return {
        text: res.response.text(),
        sources: (g?.groundingChunks ?? [])
          .map((c) => ({ title: c.web?.title ?? c.web?.uri ?? '', uri: c.web?.uri ?? '' }))
          .filter((s) => s.uri),
        searchHtml: g?.searchEntryPoint?.renderedContent,
      }
    } catch (err) {
      lastErr = err
      const msg = String((err as Error)?.message ?? err)
      // Only move on to the next model when this one isn't available.
      if (!/not.?found|404|unsupported|not supported|does not exist/i.test(msg)) break
    }
  }
  throw friendly(lastErr)
}

function friendly(err: unknown): Error {
  const msg = String((err as Error)?.message ?? err)
  if (/api-not-enabled|AI Logic|firebasevertexai|PERMISSION_DENIED|403/i.test(msg))
    return new Error('Gemini is not switched on yet. In Firebase console open AI Logic → Get started → Gemini Developer API.')
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(msg)) return new Error('The free Gemini limit is used up for now. Try again later, or use Offline mode.')
  if (/network|fetch|Failed to fetch/i.test(msg)) return new Error('No internet connection.')
  return new Error(`Gemini error: ${msg.slice(0, 200)}`)
}
