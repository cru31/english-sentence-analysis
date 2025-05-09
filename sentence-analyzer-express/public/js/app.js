document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 참조
    const elements = {
        // 입력 및 버튼
        sentenceInput: document.getElementById('sentence-input'),
        analyzeButton: document.getElementById('analyze-button'),
        clearCacheButton: document.getElementById('clear-cache-button'),
        
        // 섹션
        resultContent: document.getElementById('result-content'),
        errorSection: document.getElementById('error-section'),
        loadingSection: document.getElementById('loading-section'),
        successSection: document.getElementById('success-section'),
        
        // JSON 응답 관련
        jsonSection: document.getElementById('json-response-section'),
        jsonViewer: document.getElementById('json-viewer'),
        toggleJsonButton: document.getElementById('toggle-json-button'),
        
        // 프롬프트 관련
        promptSection: document.getElementById('prompt-section'),
        promptViewer: document.getElementById('prompt-viewer'),
        togglePromptButton: document.getElementById('toggle-prompt-button'),
        
        // 버전 정보
        apiVersionSpan: document.getElementById('api-version')
    };

    // 상태 관리
    const state = {
        lastAnalyzedSentence: null,
        isAnalyzing: false,
        currentJsonResponse: null,
        jsonVisible: true,
        promptVisible: true
    };

    // 초기화 함수
    function initialize() {
        // 이벤트 리스너 등록
        registerEventListeners();
        
        // API 키 상태 확인
        checkApiKeyStatus();
        
        // API 버전 확인
        fetchApiVersion();
        
        // URL 파라미터 확인 및 자동 분석
        checkUrlParams();
    }

    // 이벤트 리스너 등록
    function registerEventListeners() {
        // 분석 버튼 클릭
        elements.analyzeButton.addEventListener('click', handleAnalyzeClick);
        
        // 캐시 삭제 버튼 클릭
        elements.clearCacheButton.addEventListener('click', handleClearCacheClick);
        
        // JSON 토글 버튼 클릭
        elements.toggleJsonButton.addEventListener('click', () => toggleSection('json'));
        
        // 프롬프트 토글 버튼 클릭
        elements.togglePromptButton.addEventListener('click', () => toggleSection('prompt'));
        
        // 엔터 키 입력으로 분석 시작
        elements.sentenceInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && event.ctrlKey) {
                event.preventDefault();
                handleAnalyzeClick();
            }
        });
    }

    // 분석 버튼 클릭 핸들러
    async function handleAnalyzeClick() {
        const sentence = elements.sentenceInput.value.trim();
        if (!sentence) {
            showErrorMessage('분석할 문장을 입력해주세요.');
            return;
        }
        
        if (state.isAnalyzing) {
            showErrorMessage('이미 분석 중입니다. 잠시만 기다려주세요.');
            return;
        }
        
        state.lastAnalyzedSentence = sentence;
        
        // URL 파라미터 업데이트
        updateUrlParam('sentence', sentence);
        
        // 문장 분석 시작
        await analyzeSentence(sentence);
    }

    // 캐시 삭제 버튼 클릭 핸들러
    async function handleClearCacheClick() {
        await clearCache();
    }

    // API 키 상태 확인
    async function checkApiKeyStatus() {
        try {
            const response = await fetch('/api/check-api-key');
            const data = await response.json();
            
            if (data.status !== 'ok') {
                showApiKeyError(data);
            }
        } catch (error) {
            console.error('API 키 상태 확인 오류:', error);
            showErrorMessage('서버 연결 오류: API 키 상태를 확인할 수 없습니다.');
        }
    }

    // API 버전 확인
    async function fetchApiVersion() {
        try {
            const response = await fetch('/api/version');
            const data = await response.json();
            
            elements.apiVersionSpan.textContent = data.version || '알 수 없음';
        } catch (error) {
            console.error('API 버전 확인 오류:', error);
            elements.apiVersionSpan.textContent = '확인 실패';
        }
    }

    // URL 파라미터 확인 및 자동 분석
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const sentenceParam = urlParams.get('sentence');
        
        if (sentenceParam) {
            elements.sentenceInput.value = sentenceParam;
            // 페이지 로드 후 약간의 시간을 두고 분석 시작
            setTimeout(() => {
                handleAnalyzeClick();
            }, 500);
        }
    }

    // URL 파라미터 업데이트
    function updateUrlParam(key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url);
    }

    // 섹션 토글 함수
    function toggleSection(sectionType) {
        if (sectionType === 'json') {
            const content = document.getElementById('json-content');
            state.jsonVisible = !state.jsonVisible;
            
            if (state.jsonVisible) {
                content.style.display = 'block';
                elements.toggleJsonButton.textContent = '접기';
            } else {
                content.style.display = 'none';
                elements.toggleJsonButton.textContent = '펼치기';
            }
        } else if (sectionType === 'prompt') {
            const content = document.getElementById('prompt-content');
            state.promptVisible = !state.promptVisible;
            
            if (state.promptVisible) {
                content.style.display = 'block';
                elements.togglePromptButton.textContent = '접기';
            } else {
                content.style.display = 'none';
                elements.togglePromptButton.textContent = '펼치기';
            }
        }
    }

    // 문장 분석 함수
    async function analyzeSentence(sentence) {
        state.isAnalyzing = true;
        showLoading();
        hideAllMessages();
        
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sentence })
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (data.details) {
                    showDetailedError(data.error, data.details);
                } else {
                    showErrorMessage(data.error || 'API 요청 실패');
                }
                return;
            }

            // 상태 업데이트
            state.currentJsonResponse = data;
            
            // JSON 응답 표시
            displayJsonResponse(data);
            
            // 분석 결과 표시
            displayResults(data);
            
            // 프롬프트 정보 가져오기
            await fetchPromptInfo('sentence', sentence);
            
            // 성공 메시지 표시
            showSuccessMessage('분석이 완료되었습니다.');
        } catch (error) {
            console.error('분석 오류:', error);
            showErrorMessage(`분석 오류: ${error.message}`);
        } finally {
            hideLoading();
            state.isAnalyzing = false;
        }
    }

    // 컴포넌트 분석 함수
    async function analyzeComponent(component, element) {
        if (state.isAnalyzing) {
            showErrorMessage('다른 분석이 진행 중입니다. 완료 후 다시 시도해주세요.');
            return;
        }
        
        // 이미 자식 요소가 있는지 확인
        const childrenContainer = element.querySelector('.component-children');
        if (childrenContainer && childrenContainer.children.length > 0) {
            // 이미 분석된 요소는 토글만 수행
            childrenContainer.style.display = 
                childrenContainer.style.display === 'none' ? 'block' : 'none';
            return;
        }
        
        state.isAnalyzing = true;
        element.classList.add('analyzing');
        showLoading();
        
        try {
            const response = await fetch('/api/analyze-node', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: component.text,
                    constituent_type: component.constituent_type,
                    unit: component.unit
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (data.details) {
                    showDetailedError(data.error, data.details);
                } else {
                    showErrorMessage(data.error || 'API 요청 실패');
                }
                return;
            }

            // JSON 응답 표시
            state.currentJsonResponse = data;
            displayJsonResponse(data);
            
            // 프롬프트 정보 가져오기
            let promptType = 'sentence';
            if (component.unit === 'Phrase') {
                if (component.constituent_type === 'Verb Phrase') promptType = 'verb';
                else if (component.constituent_type === 'Noun Phrase') promptType = 'noun';
                else if (component.constituent_type === 'Prepositional Phrase') promptType = 'prep';
                else if (component.constituent_type === 'Adjective Phrase') promptType = 'adj';
                else if (component.constituent_type === 'Adverb Phrase') promptType = 'adv';
                else if (component.constituent_type === 'Infinitive Phrase') promptType = 'inf';
                else if (component.constituent_type === 'Gerund Phrase') promptType = 'ger';
                else if (component.constituent_type === 'Participial Phrase') promptType = 'part';
            }
            await fetchPromptInfo(promptType, component.text);
            
            // 자식 요소 추가
            if (!childrenContainer) {
                const newChildrenContainer = document.createElement('div');
                newChildrenContainer.className = 'component-children';
                
                // 결과가 있으면 추가
                if (data && data.length > 0) {
                    data.forEach(child => {
                        const childElement = createComponentElement(child);
                        newChildrenContainer.appendChild(childElement);
                    });
                } else {
                    const emptyMessage = document.createElement('div');
                    emptyMessage.className = 'empty-message';
                    emptyMessage.textContent = '분석 가능한 하위 요소가 없습니다.';
                    newChildrenContainer.appendChild(emptyMessage);
                }
                
                element.appendChild(newChildrenContainer);
            }
            
        } catch (error) {
            console.error('컴포넌트 분석 오류:', error);
            showErrorMessage(`컴포넌트 분석 오류: ${error.message}`);
        } finally {
            hideLoading();
            element.classList.remove('analyzing');
            state.isAnalyzing = false;
        }
    }

    // 프롬프트 정보 가져오기
    async function fetchPromptInfo(promptType, text) {
        try {
            const response = await fetch('/api/prompt-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    promptType,
                    text
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error('프롬프트 정보 오류:', data.error);
                return;
            }

            // 프롬프트 정보 표시
            displayPromptInfo(data);
        } catch (error) {
            console.error('프롬프트 정보 가져오기 오류:', error);
        }
    }

    // 캐시 삭제
    async function clearCache() {
        showLoading();
        
        try {
            const response = await fetch('/api/clear-cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                showErrorMessage(data.error || '캐시 삭제 실패');
                return;
            }

            showSuccessMessage(data.message || '캐시가 성공적으로 삭제되었습니다.');
        } catch (error) {
            console.error('캐시 삭제 오류:', error);
            showErrorMessage(`캐시 삭제 오류: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    // JSON 응답 표시
    function displayJsonResponse(data) {
        elements.jsonViewer.textContent = JSON.stringify(data, null, 2);
        elements.jsonSection.style.display = 'block';
    }

    // 프롬프트 정보 표시
    function displayPromptInfo(data) {
        if (!data || !data.prompt) return;
        
        elements.promptViewer.textContent = data.prompt;
        elements.promptSection.style.display = 'block';
    }

    // 결과 표시
    function displayResults(data) {
        elements.resultContent.innerHTML = '';
        
        if (!data || (!Array.isArray(data) && !data.label)) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = '분석 결과가 없습니다.';
            elements.resultContent.appendChild(emptyMessage);
            return;
        }
        
        const components = Array.isArray(data) ? data : [data];
        
        components.forEach(component => {
            const componentElement = createComponentElement(component);
            elements.resultContent.appendChild(componentElement);
        });
    }

    // 컴포넌트 요소 생성
    function createComponentElement(component) {
        const componentEl = document.createElement('div');
        componentEl.className = 'component';
        
        // 헤더 생성
        const header = document.createElement('div');
        header.className = 'component-header';
        
        // 라벨
        const label = document.createElement('span');
        label.className = 'component-label';
        label.textContent = component.label;
        
        // 타입
        const type = document.createElement('span');
        type.className = 'component-type';
        type.textContent = `${component.unit}${component.constituent_type ? ` (${component.constituent_type})` : ''}`;
        
        header.appendChild(label);
        header.appendChild(type);
        componentEl.appendChild(header);
        
        // 텍스트
        const text = document.createElement('div');
        text.className = 'component-text';
        text.textContent = `"${component.text}"`;
        componentEl.appendChild(text);
        
        // 자식 요소가 있는 경우
        if (component.children && component.children.length > 0) {
            const children = document.createElement('div');
            children.className = 'component-children';
            
            component.children.forEach(child => {
                const childEl = createComponentElement(child);
                children.appendChild(childEl);
            });
            
            componentEl.appendChild(children);
        }
        
        // 클릭 이벤트 추가 (Clause 또는 Phrase인 경우에만)
        if (component.unit === 'Clause' || component.unit === 'Phrase') {
            componentEl.style.cursor = 'pointer';
            
            // 클릭 이벤트 리스너
            componentEl.addEventListener('click', function(e) {
                e.stopPropagation(); // 이벤트 버블링 방지
                analyzeComponent(component, this);
            });
        }
        
        return componentEl;
    }

    // API 키 오류 표시
    function showApiKeyError(data) {
        let errorHTML = `
            <strong>API 키 오류:</strong>
            <p>${data.message || '인증에 필요한 API 키가 설정되지 않았습니다.'}</p>`;
        
        if (data.details) {
            errorHTML += `<p>세부 정보:</p>
            <pre>${typeof data.details === 'string' ? data.details : JSON.stringify(data.details, null, 2)}</pre>`;
        }
        
        elements.errorSection.innerHTML = errorHTML;
        elements.errorSection.style.display = 'block';
    }

    // 에러 메시지 표시
    function showErrorMessage(message) {
        elements.errorSection.innerHTML = `<strong>오류:</strong> <p>${message}</p>`;
        elements.errorSection.style.display = 'block';
        
        // 3초 후 자동으로 숨김
        setTimeout(() => {
            elements.errorSection.style.display = 'none';
        }, 5000);
    }

    // 상세 에러 표시
    function showDetailedError(message, details) {
        elements.errorSection.innerHTML = `
            <strong>오류:</strong>
            <p>${message}</p>
            <p>세부 정보:</p>
            <pre>${typeof details === 'string' ? details : JSON.stringify(details, null, 2)}</pre>`;
        elements.errorSection.style.display = 'block';
    }

    // 성공 메시지 표시
    function showSuccessMessage(message) {
        elements.successSection.innerHTML = `<strong>성공:</strong> <p>${message}</p>`;
        elements.successSection.style.display = 'block';
        
        // 3초 후 자동으로 숨김
        setTimeout(() => {
            elements.successSection.style.display = 'none';
        }, 3000);
    }

    // 로딩 표시
    function showLoading() {
        elements.loadingSection.style.display = 'flex';
    }

    // 로딩 숨기기
    function hideLoading() {
        elements.loadingSection.style.display = 'none';
    }

    // 모든 메시지 숨기기
    function hideAllMessages() {
        elements.errorSection.style.display = 'none';
        elements.successSection.style.display = 'none';
    }

    // 초기화 실행
    initialize();
});