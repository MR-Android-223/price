
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";

// Always initialize with named parameter and use process.env.API_KEY directly.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  // AI Assistant Chat using Complex Text Model
  chat: async (message: string, history: { role: string; parts: { text: string }[] }[]) => {
    // Re-initialize to ensure latest API key is used as per guidelines
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: "أنت مساعد ذكي لتطبيق إدارة الديون والهدوء. تتحدث العربية بطلاقة. ساعد المستخدم في إدارة حساباته أو قدم نصائح حول التوفير والهدوء.",
      }
    });
    return response.text;
  },

  // Image Generation for Meditation Visuals using High-Quality Model
  generateVisual: async (prompt: string, size: "1K" | "2K" | "4K" = "1K") => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `Create a serene, high-quality meditation visual: ${prompt}` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: size
        }
      }
    });

    // Iterate through all parts to find the image part as per guidelines
    for (const part of response.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  },

  // TTS for Meditation/Summary using Speech Model
  generateSpeech: async (text: string) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  }
};

// Implement manual base64 decoding as per guidelines example
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Implement PCM audio decoding as per guidelines (Gemini returns raw PCM, not standard audio files)
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function playAudio(base64: string) {
  // Use recommended sample rate for Gemini TTS
  const outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  
  const audioBuffer = await decodeAudioData(
    decode(base64),
    outputAudioContext,
    24000,
    1,
  );
  
  const source = outputAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(outputAudioContext.destination);
  source.start();
}
