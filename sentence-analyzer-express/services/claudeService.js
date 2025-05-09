const axios = require('axios');
const configService = require('./configService');

class ClaudeService {
  constructor() {
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }
  
  async callAPI(apiKey, prompt, configName) {
    try {
      // 모델 구성 가져오기
      const modelConfig = configService.getModelConfig(configName);
      console.log(`[DEBUG] API 호출 - 구성: ${configName}, 모델: ${modelConfig.model}`);
      
      const response = await axios.post(
        this.baseUrl,
        {
          model: modelConfig.model,
          max_tokens: modelConfig.max_tokens,
          temperature: modelConfig.temperature,
          system: "You are a linguistics expert specializing in English grammar and syntax analysis. Your task is to analyze sentences and phrases according to their grammatical structure. ALWAYS return JSON format exactly as requested, with no additional text or explanation.",
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Claude API 호출 오류:', error.response?.data || error.message);
      
      if (error.response) {
        throw new Error(`API 오류 (${error.response.status}): ${error.response.data.error?.message || '알 수 없는 오류'}`);
      } else {
        throw new Error(`API 호출 실패: ${error.message}`);
      }
    }
  }
  
  // Claude 응답에서 JSON 추출
  extractJsonFromResponse(responseData) {
    try {
      const responseText = responseData.content[0].text;
      
      // JSON 코드 블록 찾기
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      
      // 코드 블록이 없으면 텍스트 전체를 JSON으로 파싱 시도
      return JSON.parse(responseText);
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      throw new Error('Claude 응답을 JSON으로 파싱할 수 없습니다.');
    }
  }
}

module.exports = new ClaudeService();