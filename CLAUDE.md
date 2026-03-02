---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Portal System의 개발 환경, 기술 스택, 코딩 표준을 정의합니다.
AI 어시스턴트는 코드 생성 시 이 지침을 준수하며, 모든 주석은 한글로 작성합니다.
---

## 1. 프로젝트 개요
- 명칭: IT Portal System (IT 포털 시스템)
- 주요 기능: 프로젝트(정보화사업 및 전산예산) 관리, 전자결재
- 사용자: 약 3,000명의 사내 임직원

## 2. 기술 스택 (Tech Stack)
- Framework: Nuxt 4 (v4)
- UI Library: PrimeVue (Aura Theme)
- Styling: Tailwind CSS
- State Management: Pinia
- Language: TypeScript

## 3. 주요 명령어
- npm install: 패키지 설치
- npx nuxt prepare: 타입 정의 자동 생성
- npm run dev: 개발 서버 실행
- npm run build: 운영 빌드

## 4. 코딩 스타일 및 가이드라인
### 4.1 컴포넌트 개발 원칙
- API 요청: 
  - useApiFetch (useFetch 래퍼) : GET 데이터 조회 (반응형)
  - $apiFetch ($fetch 래퍼) : POST/PUT/DELETE 데이터 변경 (일회성)
- Composition API 사용: 반드시 `<script setup lang="ts">` 구조를 사용합니다.
- UI 일관성: PrimeVue 컴포넌트를 우선 사용하며, 세부 레이아웃은 Tailwind로 조정합니다.
- 상세 주석: 코드의 의도를 명확히 하기 위해 모든 로직에는 한글 주석을 필수로 작성합니다.

### 4.2 Architecture
- stores/ : 상태관리
- types/ : 타입 정의
- utils/ : 유틸리티 함수
- assets/ : 이미지, 아이콘 등
- middleware/ : 미들웨어
- components/ : 컴포넌트
- layouts/ : 레이아웃
- plugins/ : 플러그인
- public/ : 공용 파일
- pages/info/projects/ : 프로젝트(정보화사업) 관리
- pages/info/cost/ : 프로젝트(전산업무비) 관리
- pages/budget/ : 전산예산 관리
- pages/diagnosis/ : 사전진단
- pages/audit/ : IT 감사
- pages/approval/ : 전자결재

## 5. 주석 및 타입 작성 예시
```TypeScript
    /**
     * 페이지 새로고침 후 세션 복원
     * localStorage에 저장된 토큰과 사용자 정보를 읽어 Pinia 상태를 복원합니다.
     * middleware/auth.global.ts에서 매 라우트 네비게이션마다 호출됩니다.
     *
     * [localStorage 데이터 형식]
     *  - 'accessToken'  : 문자열 (JWT)
     *  - 'refreshToken' : 문자열 (JWT)
     *  - 'user'         : JSON 문자열 ({ eno, empNm })
     *
     * [예외 처리]
     * - JSON.parse 실패(데이터 손상) 시 clearAuth()로 초기화합니다.
     */
    const restoreSession = (): void => {
```

```TypeScript
/**
 * 프로젝트 정보를 업데이트하는 함수
 * @param id - 프로젝트 고유 아이디
 * @param data - 수정할 데이터 객체
 */
const updateProject = (id: string, data: any) => {
  // 로직을 한글 주석과 함께 구현하세요.
};
```