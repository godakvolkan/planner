/**
 * Gemini AI Servis Bağlantısı
 * Uygulamanın zekasını sağlayacak ana sınıf.
 */

export class GeminiService {
  private apiKey: string;

  constructor(apiKey?: string) {
    // TODO: İleride bunu kullanıcının ayarlarından veya .env dosyasından okuyacağız
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  /** API anahtarı tanımlı mı (yoksa çağıranlar yerel yönteme düşer) */
  get available(): boolean {
    return !!this.apiKey
  }

  async generateContent(prompt: string): Promise<string> {
    if (!this.apiKey) {
      console.warn('Gemini API Key eksik. Mock cevap dönülüyor...');
      return 'Bu bir AI deneme yanıtıdır. API anahtarı eklenmedi.';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API Hatası: ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      console.error('Gemini ile iletişim kurulamadı:', error);
      throw error;
    }
  }
}

// Singleton instance (Uygulama genelinde tek bir servis nesnesi kullanmak için)
export const gemini = new GeminiService();
