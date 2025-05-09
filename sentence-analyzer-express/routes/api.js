const express = require('express');
const router = express.Router();
const analyzerService = require('../services/analyzerService');
const configService = require('../services/configService');

// API 키 상태 확인
router.get('/check-api-key', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return res.status(400).json({
      status: 'error',
      message: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.',
      details: '환경 변수 파일에 ANTHROPIC_API_KEY를 설정해주세요.'
    });
  }
  
  res.json({ status: 'ok', message: 'API 키가 올바르게 설정되어 있습니다.' });
});

// 초기 문장 분석 API
router.post('/analyze', async (req, res) => {
  try {
    const { sentence } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!sentence) {
      return res.status(400).json({ error: '분석할 문장이 필요합니다.' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API 키가 설정되지 않았습니다.', 
        details: '환경 변수에 ANTHROPIC_API_KEY를 설정해주세요.' 
      });
    }
    
    const result = await analyzerService.analyzeSentence(sentence, apiKey);
    res.json(result);
  } catch (error) {
    console.error('분석 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 구성 요소 분석 API
router.post('/analyze-node', async (req, res) => {
  try {
    const { text, constituent_type, unit } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!text) {
      return res.status(400).json({ error: '분석할 텍스트가 필요합니다.' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API 키가 설정되지 않았습니다.', 
        details: '환경 변수에 ANTHROPIC_API_KEY를 설정해주세요.' 
      });
    }
    
    const result = await analyzerService.analyzeNode(text, constituent_type, unit, apiKey);
    res.json(result);
  } catch (error) {
    console.error('노드 분석 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 프롬프트 정보 API
router.post('/prompt-info', async (req, res) => {
  try {
    const { promptType, text } = req.body;
    
    if (!text || !promptType) {
      return res.status(400).json({ error: '텍스트와 프롬프트 타입이 필요합니다.' });
    }
    
    const promptInfo = analyzerService.getPromptInfo(promptType, text);
    res.json(promptInfo);
  } catch (error) {
    console.error('프롬프트 정보 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 캐시 비우기 API
router.post('/clear-cache', (req, res) => {
  analyzerService.clearCache();
  res.json({ success: true, message: '캐시가 초기화되었습니다.' });
});

// API 버전 정보 가져오기
router.get('/version', (req, res) => {
  const version = configService.getApiVersion();
  res.json({ version });
});

module.exports = router;