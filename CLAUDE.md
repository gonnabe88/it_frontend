/**

============================================================================

[ 프로젝트 메인 가이드 ]

본 파일은 IT Portal System의 개발 환경, 기술 스택, 코딩 표준을 정의합니다.

AI 어시스턴트는 코드 생성 시 이 지침을 준수하며, 모든 주석은 한글로 작성합니다.

============================================================================
*/

1. 프로젝트 개요
명칭: IT Portal System (IT 포털 시스템)
주요 기능: 프로젝트 관리, 전자 결재, 감사, 진단 통합 관리
사용자: 약 3,000명의 사내 임직원

2. 기술 스택 (Tech Stack)
Framework: Nuxt 4 (v4)
UI Library: PrimeVue (Aura Theme)
Styling: Tailwind CSS
State Management: Pinia
Language: TypeScript

3. 주요 명령어
npm install: 패키지 설치
npx nuxt prepare: 타입 정의 자동 생성
npm run dev: 개발 서버 실행
npm run build: 운영 빌드

4. 코딩 스타일 및 가이드라인
4.1 컴포넌트 개발 원칙
Composition API 사용: 반드시 <script setup lang="ts"> 구조를 사용합니다.
UI 일관성: PrimeVue 컴포넌트를 우선 사용하며, 세부 레이아웃은 Tailwind로 조정합니다.
상세 주석: 코드의 의도를 명확히 하기 위해 모든 로직에는 한글 주석을 필수로 작성합니다.

4.2 디렉토리 및 라우팅 구조
프로젝트 관리: /pages/info/projects/index.vue
전자 결재: /pages/approval/index.vue
감사 및 진단: /pages/audit/index.vue 및 /pages/diagnosis/index.vue
상태 관리: 전역 상태는 stores/ 폴더의 Pinia 스토어에서 관리합니다.

5. 주석 및 타입 작성 예시
TypeScript
/**
 * [프로젝트 상태 정의]
 * 프로젝트의 진행 단계를 구분하는 타입입니다.
 */
type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * 프로젝트 정보를 업데이트하는 함수
 * @param id - 프로젝트 고유 아이디
 * @param data - 수정할 데이터 객체
 */
const updateProject = (id: string, data: any) => {
  // 로직을 한글 주석과 함께 구현하세요.
};