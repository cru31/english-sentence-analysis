const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const _ = require('lodash');

class ConfigService {
  constructor() {
    this.config = {};
    this.apiConfigs = {};
    this.basePath = path.join(__dirname, '../resources');
  }

  // 설정 초기화
  initializeConfig() {
    try {
      // current.json 파일 로드
      const currentConfigPath = path.join(this.basePath, 'current.json');
      const currentConfig = JSON.parse(fs.readFileSync(currentConfigPath, 'utf8'));
      
      this.config = currentConfig;
      
      // API 경로 설정
      const apiPath = this.config.analysis_api_functions.base_path;
      const apiVersion = this.config.analysis_api_functions.version;
      
      console.log(`API 구성 로드 중: ${apiPath}`);
      
      // 모든 YAML 파일 로드
      this.loadApiConfigs(apiPath);
      
      console.log(`API 구성 로드 완료. 버전: ${apiVersion}`);
    } catch (error) {
      console.error('설정 초기화 오류:', error);
      throw error;
    }
  }
  
  // API 구성 파일 로드
  loadApiConfigs(apiPath) {
    const fullApiPath = path.join(this.basePath, apiPath);
    
    // 특정 API 경로의 모든 YAML 파일 찾기
    if (!fs.existsSync(fullApiPath)) {
      console.error(`API 경로가 존재하지 않습니다: ${fullApiPath}`);
      throw new Error(`API 경로가 존재하지 않습니다: ${fullApiPath}`);
    }
    
    const files = fs.readdirSync(fullApiPath);
    
    console.log('\n=== API 구성 파일 로딩 시작 ===');
    console.log(`API 경로: ${fullApiPath}`);
    console.log('발견된 YAML 파일들:');
    
    if (files.length === 0) {
      console.warn(`경로에 YAML 파일이 없습니다: ${fullApiPath}`);
    }
    
    files.forEach(file => {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const filePath = path.join(fullApiPath, file);
        const configName = path.basename(file, path.extname(file));
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const config = yaml.load(content);
          
          // 파일 유효성 검사
          if (!config) {
            console.error(`❌ ${file}: 유효하지 않은 YAML 형식`);
            return;
          }
          
          // 필수 필드 검사 (Common 및 Clause 파일)
          if (configName === 'analyzeClause' || configName === 'analyzePhraseCommon') {
            if (!config.model || !config.messages || !config.messages[0]) {
              console.error(`❌ ${file}: 필수 필드 누락 (model 또는 messages)`);
              return;
            }
          }
          
          this.apiConfigs[configName] = config;
          console.log(`✓ ${file} (${configName})`);
        } catch (error) {
          console.error(`❌ ${file} 로드 실패:`, error);
        }
      }
    });
    
    console.log('\n로딩된 구성 목록:');
    Object.keys(this.apiConfigs).forEach(configName => {
      console.log(`- ${configName}`);
    });
    
    // 필수 파일 존재 여부 확인
    const requiredConfigs = ['analyzeClause', 'analyzePhraseCommon'];
    const missingRequiredConfigs = requiredConfigs.filter(name => !this.apiConfigs[name]);
    
    if (missingRequiredConfigs.length > 0) {
      console.error(`\n⚠️ 중요: 다음 필수 구성 파일이 없습니다: ${missingRequiredConfigs.join(', ')}`);
    }
    
    // 권장 파일 체크
    const recommendedPhraseConfigs = [
      'analyzeVerbPhraseSpecific', 
      'analyzeNounPhraseSpecific', 
      'analyzePrepositionalPhraseSpecific', 
      'analyzeAdjectivePhraseSpecific', 
      'analyzeAdverbPhraseSpecific', 
      'analyzeInfinitivePhraseSpecific', 
      'analyzeGerundPhraseSpecific',
      'analyzeParticipialPhraseSpecific'
    ];
    
    const missingPhraseConfigs = recommendedPhraseConfigs.filter(name => !this.apiConfigs[name]);
    
    if (missingPhraseConfigs.length > 0) {
      console.warn(`\n⚠️ 참고: 다음 구문 유형별 구성 파일이 없습니다: ${missingPhraseConfigs.join(', ')}`);
    }
    
    console.log('=== API 구성 파일 로딩 완료 ===\n');
  }
  
  // 특정 API 구성 가져오기
  getApiConfig(name) {
    if (!this.apiConfigs[name]) {
      console.warn(`경고: ${name} 구성 파일을 찾을 수 없습니다.`);
    }
    return this.apiConfigs[name];
  }
  
  // 문장/절 분석 구성 가져오기
  getClauseConfig() {
    return this.apiConfigs['analyzeClause'];
  }
  
  // 일반 구문 분석 구성 가져오기
  getPhraseCommonConfig() {
    return this.apiConfigs['analyzePhraseCommon'];
  }
  
  // 특정 구문 분석 구성 가져오기
  getPhraseSpecificConfig(phraseType) {
    // 구문 유형에서 "Phrase" 부분을 제거하고 정규화
    const phraseTypeNormalized = phraseType.replace(/\s*Phrase\s*$/, '');
    const specificConfigName = `analyze${phraseTypeNormalized}PhraseSpecific`;
    
    if (!this.apiConfigs[specificConfigName]) {
      console.warn(`경고: '${specificConfigName}.yml' 파일을 찾을 수 없습니다.`);
    }
    
    return this.apiConfigs[specificConfigName];
  }
  
  // 특정 구문 유형에 대한 완전한 구성 생성 (공통 + 특정)
  getCompletePhraseConfig(phraseType) {
    const commonConfig = this.getPhraseCommonConfig();
    
    if (!commonConfig) {
      throw new Error('공통 구문 분석 구성(analyzePhraseCommon.yml)을 찾을 수 없습니다.');
    }
    
    // 특정 구문 유형에 대한 구성 가져오기
    const phraseTypeNormalized = phraseType.replace(/\s*Phrase\s*$/, '');
    const specificConfigName = `analyze${phraseTypeNormalized}PhraseSpecific`;
    
    if (!this.apiConfigs[specificConfigName]) {
      console.warn(`${phraseType}에 대한 특정 구성(${specificConfigName})이 없습니다. 공통 구성만 사용합니다.`);
      return commonConfig;
    }
    
    const specificConfig = this.apiConfigs[specificConfigName];
    
    // 깊은 복사로 병합된 구성 생성
    const mergedConfig = _.cloneDeep(commonConfig);
    
    // 메시지 템플릿에 필요한 변수 채우기
    if (mergedConfig.messages && mergedConfig.messages.length > 0) {
      const messageContent = mergedConfig.messages[0].content;
      
      // 변수 대체
      if (messageContent) {
        // 구문 유형
        mergedConfig.messages[0].content = messageContent
          .replace(/{{phrase_type}}/g, specificConfig.phrase_type || phraseType)
          .replace(/{{specific_rule}}/g, specificConfig.specific_rule || '')
          .replace(/{{valid_labels}}/g, specificConfig.valid_labels || '')
          .replace(/{{example_label}}/g, specificConfig.example_label || '')
          .replace(/{{example_unit}}/g, specificConfig.example_unit || '')
          .replace(/{{example_properties}}/g, specificConfig.example_properties || '');
      }
    }
    
    return mergedConfig;
  }
  
  // 프롬프트 템플릿 생성
  generatePromptTemplate(config, type, replacements = {}) {
    try {
      if (!config || !config.messages || !config.messages[0] || !config.messages[0].content) {
        throw new Error(`${type}에 대한 유효한 프롬프트 템플릿이 없습니다.`);
      }
      
      let template = config.messages[0].content;
      
      // 템플릿 문자열에서 변수 대체
      for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, value);
      }
      
      return template;
    } catch (error) {
      console.error('프롬프트 템플릿 생성 오류:', error);
      throw error;
    }
  }
  
  // 현재 API 버전 가져오기
  getApiVersion() {
    return this.config.analysis_api_functions?.version || 'unknown';
  }
  
  // 모델 구성 가져오기
  getModelConfig(configName) {
    // 올바른 구성 파일 이름 매핑
    const configMapping = {
      'analyzeClause': 'analyzeClause',
      'analyzeVerbPhraseSpecific': 'analyzeVerbPhraseSpecific',
      'analyzeNounPhraseSpecific': 'analyzeNounPhraseSpecific',
      'analyzePrepositionalPhraseSpecific': 'analyzePrepositionalPhraseSpecific',
      'analyzeAdjectivePhraseSpecific': 'analyzeAdjectivePhraseSpecific',
      'analyzeAdverbPhraseSpecific': 'analyzeAdverbPhraseSpecific',
      'analyzeInfinitivePhraseSpecific': 'analyzeInfinitivePhraseSpecific',
      'analyzeGerundPhraseSpecific': 'analyzeGerundPhraseSpecific',
      'analyzeParticipialPhraseSpecific': 'analyzeParticipialPhraseSpecific'
    };
    
    // 구성 파일 이름 결정
    const actualConfigName = configMapping[configName] || 'analyzeClause';
    
    // 구성 가져오기
    const config = this.apiConfigs[actualConfigName] || this.apiConfigs['analyzeClause'];
    
    // 모델 정보가 없으면 공통 구성 참조
    if (!config.model) {
      const commonConfig = config === this.apiConfigs['analyzeClause'] 
        ? config 
        : this.apiConfigs['analyzeClause'];
      
      return {
        model: commonConfig.model || 'claude-3-7-sonnet-20250219',
        max_tokens: commonConfig.max_tokens || 4000,
        temperature: commonConfig.temperature || 0.1
      };
    }
    
    return {
      model: config.model,
      max_tokens: config.max_tokens || 4000,
      temperature: config.temperature || 0.1
    };
  }
}

module.exports = new ConfigService();