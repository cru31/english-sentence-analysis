const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const claudeService = require('./claudeService');
const configService = require('./configService');

class AnalyzerService {
  constructor() {
    this.cacheDir = path.join(__dirname, '../cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // 문장 해시 생성
  getSentenceHash(sentence) {
    return crypto.createHash('md5').update(sentence).digest('hex');
  }

  // 캐시 경로 생성
  getCachePath(sentence) {
    const hash = this.getSentenceHash(sentence);
    return path.join(this.cacheDir, hash);
  }

  // 캐시 초기화
  clearCache() {
    const dirs = fs.readdirSync(this.cacheDir);
    dirs.forEach(dir => {
      const dirPath = path.join(this.cacheDir, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    });
    console.log('캐시가 초기화되었습니다.');
  }

  // 캐시에서 결과 가져오기
  getFromCache(cachePath, isComponent = false) {
    try {
      const filePath = isComponent 
        ? path.join(cachePath, 'components', `${cachePath.split('/').pop()}.json`)
        : path.join(cachePath, 'sentence.json');

      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('캐시 읽기 오류:', error);
    }
    return null;
  }

  // 캐시에 결과 저장
  saveToCache(cachePath, data, isComponent = false) {
    try {
      const dirPath = isComponent 
        ? path.join(cachePath, 'components')
        : cachePath;

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const filePath = isComponent
        ? path.join(dirPath, `${cachePath.split('/').pop()}.json`)
        : path.join(dirPath, 'sentence.json');

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      // 메타데이터 업데이트
      if (!isComponent) {
        this.updateMetadata(cachePath, data);
      }
    } catch (error) {
      console.error('캐시 저장 오류:', error);
    }
  }

  // 메타데이터 업데이트
  updateMetadata(cachePath, data) {
    const metadataPath = path.join(cachePath, 'metadata.json');
    const metadata = {
      analyzed_at: new Date().toISOString(),
      components: data.map((comp, index) => ({
        text: comp.text,
        type: comp.constituent_type,
        analyzed_at: new Date().toISOString()
      }))
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  // 문장 초기 분석
  async analyzeSentence(sentence, apiKey, useCache = true) {
    try {
      const cachePath = this.getCachePath(sentence);
      
      // 캐시 확인
      if (useCache) {
        const cachedResult = this.getFromCache(cachePath);
        if (cachedResult) {
          console.log(`캐시에서 "${sentence}" 분석 결과 가져옴`);
          return cachedResult;
        }
      }
      
      // 프롬프트 생성
      const prompt = this.getPromptForAnalysis('sentence', sentence);
      
      // Claude API 호출
      const response = await claudeService.callAPI(apiKey, prompt, 'analyzeClause');
      
      // JSON 추출
      const result = claudeService.extractJsonFromResponse(response);
      
      // ID 할당
      this.assignIds(result, 0);
      
      // 캐시에 저장
      if (useCache) {
        this.saveToCache(cachePath, result);
      }
      
      return result;
    } catch (error) {
      console.error('문장 분석 오류:', error);
      throw error;
    }
  }
  
  // 노드 분석 (하위 구성 요소)
  async analyzeNode(text, constituent_type, unit, apiKey, useCache = true) {
    try {
      let analysisType = 'unknown';
      let configName = '';
      
      // 분석 유형 결정
      if (unit === 'Clause') {
        analysisType = 'sentence';
        configName = 'analyzeClause';
      } else if (unit === 'Phrase') {
        // 구문 유형에 따른 매핑 - 실제 YAML 파일명 사용
        const phraseMappings = {
          'Verb Phrase': { type: 'verb', config: 'analyzeVerbPhraseSpecific' },
          'Noun Phrase': { type: 'noun', config: 'analyzeNounPhraseSpecific' },
          'Prepositional Phrase': { type: 'prep', config: 'analyzePrepositionalPhraseSpecific' },
          'Adjective Phrase': { type: 'adj', config: 'analyzeAdjectivePhraseSpecific' },
          'Adverb Phrase': { type: 'adv', config: 'analyzeAdverbPhraseSpecific' },
          'Infinitive Phrase': { type: 'inf', config: 'analyzeInfinitivePhraseSpecific' },
          'Gerund Phrase': { type: 'ger', config: 'analyzeGerundPhraseSpecific' },
          'Participial Phrase': { type: 'part', config: 'analyzeParticipialPhraseSpecific' }
        };
        
        if (!phraseMappings[constituent_type]) {
          throw new Error(`지원되지 않는 구문 유형: ${constituent_type}`);
        }
        
        analysisType = phraseMappings[constituent_type].type;
        configName = phraseMappings[constituent_type].config;
      } else {
        throw new Error(`분석할 수 없는 유형: ${unit}`);
      }
      
      const cachePath = this.getCachePath(text);
      
      // 캐시 확인
      if (useCache) {
        const cachedResult = this.getFromCache(cachePath, true);
        if (cachedResult) {
          console.log(`캐시에서 "${text}" 분석 결과 가져옴`);
          return cachedResult;
        }
      }
      
      // 프롬프트 생성
      const prompt = this.getPromptForAnalysis(analysisType, text, constituent_type);
      
      // Claude API 호출
      const response = await claudeService.callAPI(apiKey, prompt, configName);
      
      // JSON 추출
      const result = claudeService.extractJsonFromResponse(response);
      
      // 캐시에 저장
      if (useCache) {
        this.saveToCache(cachePath, result, true);
      }
      
      return result;
    } catch (error) {
      console.error('노드 분석 오류:', error);
      throw error;
    }
  }
  
  // ID 할당
  assignIds(components, level) {
    if (!Array.isArray(components)) return;
    
    components.forEach((component, index) => {
      component.id = `${level}-${index}`;
      if (component.children && component.children.length > 0) {
        this.assignIds(component.children, level + 1);
      } else if (!component.children) {
        component.children = [];
      }
    });
  }
  
  // 분석 유형에 따른 프롬프트 생성
  getPromptForAnalysis(analysisType, text, phraseType = null) {
    switch (analysisType) {
      case 'sentence':
        return this.getSentencePrompt(text);
      case 'verb':
      case 'noun':
      case 'prep':
      case 'adj':
      case 'adv':
      case 'inf':
      case 'ger':
      case 'part':
        return this.getPhrasePrompt(phraseType, text);
      default:
        throw new Error(`알 수 없는 분석 유형: ${analysisType}`);
    }
  }
  
  // 문장/절 분석 프롬프트
  getSentencePrompt(text) {
    const clauseConfig = configService.getClauseConfig();
    return configService.generatePromptTemplate(clauseConfig, 'sentence', { text });
  }
  
  // 구문 분석 프롬프트 (공통 + 특정 구문)
  getPhrasePrompt(phraseType, text) {
    try {
      // 완전한 구성 가져오기 (공통 + 특정)
      const completeConfig = configService.getCompletePhraseConfig(phraseType);
      
      // 템플릿 변수 준비
      const replacements = {
        text
      };
      
      // 템플릿 생성
      return configService.generatePromptTemplate(completeConfig, phraseType, replacements);
    } catch (error) {
      console.error(`${phraseType} 프롬프트 생성 오류:`, error);
      throw error;
    }
  }
  
  // 프롬프트 정보 가져오기 (디버깅 및 UI 표시용)
  getPromptInfo(promptType, text) {
    try {
      // 구문 유형과 설정 파일 매핑
      const phraseConfigMapping = {
        'verb': { type: 'Verb Phrase', config: 'analyzeVerbPhraseSpecific' },
        'noun': { type: 'Noun Phrase', config: 'analyzeNounPhraseSpecific' },
        'prep': { type: 'Prepositional Phrase', config: 'analyzePrepositionalPhraseSpecific' },
        'adj': { type: 'Adjective Phrase', config: 'analyzeAdjectivePhraseSpecific' },
        'adv': { type: 'Adverb Phrase', config: 'analyzeAdverbPhraseSpecific' },
        'inf': { type: 'Infinitive Phrase', config: 'analyzeInfinitivePhraseSpecific' },
        'ger': { type: 'Gerund Phrase', config: 'analyzeGerundPhraseSpecific' },
        'part': { type: 'Participial Phrase', config: 'analyzeParticipialPhraseSpecific' }
      };
      
      switch (promptType) {
        case 'sentence':
          const sentencePrompt = this.getSentencePrompt(text);
          return {
            prompt: sentencePrompt,
            config: configService.getClauseConfig()
          };
        case 'verb':
        case 'noun':
        case 'prep':
        case 'adj':
        case 'adv':
        case 'inf':
        case 'ger':
        case 'part':
          const phraseInfo = phraseConfigMapping[promptType];
          const prompt = this.getPhrasePrompt(phraseInfo.type, text);
          return {
            prompt: prompt,
            config: configService.getApiConfig(phraseInfo.config)
          };
        default:
          throw new Error(`알 수 없는 프롬프트 유형: ${promptType}`);
      }
    } catch (error) {
      console.error('프롬프트 정보 오류:', error);
      throw error;
    }
  }
}

module.exports = new AnalyzerService();