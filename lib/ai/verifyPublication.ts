import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface VerificationResult {
  isValid: boolean
  confidence: number
  detected: {
    rappiBrand: boolean
    restaurantName: boolean
    deepLink: boolean
  }
  notes: string
}

export async function verifyPublication(
  screenshotUrl: string,
  restaurantName: string,
  deepLink: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<VerificationResult> {
  const systemPrompt = `You are a publication verifier for Rappi, a food delivery platform.
Your job is to analyze screenshots of social media posts to verify they are real publications
that contain Rappi branding and the restaurant's information.

Always respond with valid JSON only, no markdown, no explanation.`

  const userPrompt = `Analyze this screenshot and determine if it shows a real social media publication (Instagram, Facebook, WhatsApp, TikTok, etc.) that promotes a restaurant on Rappi.

Restaurant name to look for: "${restaurantName}"
Expected deep link domain or QR: related to "rappi.com" or the restaurant slug

Check for:
1. Rappi brand elements (Rappi logo, orange color #FF441B, "Rappi" text, "Pide en Rappi" text)
2. The restaurant name "${restaurantName}" visible in the image
3. A deep link URL or QR code related to Rappi

Respond with ONLY this JSON structure:
{
  "isValid": boolean,
  "confidence": number between 0.0 and 1.0,
  "detected": {
    "rappiBrand": boolean,
    "restaurantName": boolean,
    "deepLink": boolean
  },
  "notes": "brief description of what you see"
}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: screenshotUrl,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as VerificationResult
    // Ensure confidence is clamped
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence))
    return parsed
  } catch {
    // Fallback if JSON parsing fails
    return {
      isValid: false,
      confidence: 0,
      detected: { rappiBrand: false, restaurantName: false, deepLink: false },
      notes: `Failed to parse AI response: ${text.substring(0, 100)}`,
    }
  }
}
