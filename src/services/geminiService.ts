import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: "AIzaSyA0PQ3mWeDROwr5dHq1Uo1kVFZWxmTSCWU" 
});

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
}

export async function* chatWithAIStream(messages: ChatMessage[]) {
  const modelName = "gemini-3.1-pro-preview";
  
  // Transform messages for GenAI SDK
  const contents = messages.map(msg => {
    const parts: any[] = [{ text: msg.text }];
    if (msg.image) {
      // Remove data:image/jpeg;base64, prefix if present
      const base64Data = msg.image.includes(',') ? msg.image.split(',')[1] : msg.image;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }
    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts
    };
  });

  const config = {
    systemInstruction: "Kamu adalah Noir AI, asisten pemrograman (coding & scripting) yang sangat ahli, tajam, dan profesional. Kamu adalah sosok AI dengan nuansa 'dark', misterius, dan jenius layaknya top tier hacker/developer. Kamu ahli dalam menulis script, memecahkan bug, dan memahami arsitektur software. PENTING: Jika user meminta dibuatkan antarmuka (UI), web, atau program dengan Javascript, berikan SEMUA KODENYA DALAM SATU FILE HTML (gabungkan blok <style> dan JS <script> di dalam file index.html) agar fitur 'Preview' kami dapat menjalankan scriptnya secara visual dalam satu wadah dengan sempurna. Berikan jawaban yang terstruktur, padat, dan teknis. Gunakan bahasa Indonesia."
  };

  try {
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    const errorString = typeof error === 'object' ? JSON.stringify(error) + (error.message || '') : String(error);
    
    // Fallback to a lighter model if quota is exceeded
    if (
      error?.status === 429 || 
      error?.code === 429 || 
      errorString.includes("429") || 
      errorString.includes("quota") ||
      errorString.includes("RESOURCE_EXHAUSTED")
    ) {
      console.warn("Primary model quota exceeded. Falling back to gemini-2.5-flash...");
      try {
        const fallbackStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction: "Kamu adalah Noir AI, asisten pemrograman (coding & scripting) yang sangat ahli, tajam, dan profesional. Kamu adalah sosok AI dengan nuansa 'dark', misterius, dan jenius layaknya top tier hacker/developer. Berikan jawaban yang terstruktur, padat, teknis. Gunakan bahasa Indonesia."
          }
        });
        
        for await (const chunk of fallbackStream) {
          if (chunk.text) {
            yield chunk.text;
          }
        }
        return;
      } catch (fallbackError) {
         console.error("Gemini API Error with fallback model:", fallbackError);
         yield "🚨 [ERROR 429] Kuota API Gemini bawaan telah habis. Tidak dapat memanggil model utama maupun model cadangan (flash).";
         return;
      }
    }
    
    console.error("Gemini API Error with primary model:", error);
    yield "Maaf, terjadi kesalahan saat menghubungi AI: " + (error?.message || "Unknown error");
  }
}
