try {
  require('dotenv').config({ path: '../../../api_key/anthropic_api_key.env' });
  console.log('환경 변수 파일 로드 시도:', '../../../api_key/anthropic_api_key.env');
  console.log('ANTHROPIC_API_KEY 설정 여부:', process.env.ANTHROPIC_API_KEY ? '설정됨 (키 길이: ' + process.env.ANTHROPIC_API_KEY.length + ')' : '설정되지 않음');
} catch (error) {
  console.error('환경 변수 파일 로드 오류:', error);
}

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const configService = require('./services/configService');

const app = express();
// 3001 포트 강제 지정
const PORT = 3001;

// 환경 설정 초기화
configService.initializeConfig();

// 미들웨어 설정
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api', apiRoutes);

// 기본 라우트 - 정적 HTML 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`분석 API 버전: ${configService.getApiVersion()}`);
});