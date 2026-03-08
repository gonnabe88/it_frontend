# [Plan] 프론트엔드 테스트 구성 (Vitest + Playwright)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 현재 IT 포털 시스템에는 자동화 테스트가 전혀 없어, 기능 추가 및 리팩토링 시 회귀 버그 발생 여부를 수동으로만 확인할 수 있다. |
| **Solution** | Vitest로 단위/통합 테스트를, Playwright로 E2E 테스트를 구성하여 코드 변경 시 자동으로 품질을 검증하는 체계를 마련한다. |
| **Function UX Effect** | 개발자가 코드를 수정한 후 즉시 테스트를 실행하여 안전성을 확인할 수 있으며, CI 파이프라인 연동 시 배포 전 자동 검증이 가능하다. |
| **Core Value** | 테스트 기반의 안전한 개발 문화를 확립하여 운영 장애를 사전에 방지하고, 약 3,000명 임직원이 사용하는 시스템의 신뢰성을 높인다. |

---

## 1. 배경 및 목적

### 1.1 현황 분석

- **프로젝트**: IT Portal System (Nuxt 4 + PrimeVue + Pinia + TypeScript)
- **사용자**: 약 3,000명 사내 임직원
- **현재 테스트 현황**: 자동화 테스트 없음 (package.json에 test 스크립트 없음)
- **주요 리스크**:
  - 인증 흐름(로그인/토큰갱신/세션복원) 변경 시 검증 불가
  - API composable 변경 시 회귀 버그 탐지 어려움
  - 전자결재, 예산 관리 등 핵심 비즈니스 로직 보호 장치 없음

### 1.2 목적

1. **단위 테스트 (Vitest)**: 유틸 함수, composable, store 레벨 로직 검증
2. **E2E 테스트 (Playwright)**: 로그인, 프로젝트 조회/생성, 전자결재 등 핵심 사용자 시나리오 검증
3. **개발 워크플로우 통합**: `npm run test`, `npm run test:e2e` 명령어로 즉시 실행 가능

---

## 2. 범위 (Scope)

### 2.1 In-Scope

#### Vitest 단위/통합 테스트
- `utils/common.ts` — `formatBudget`, `getApprovalTagClass`, `getProjectTagClass` 함수
- `stores/auth.ts` — 로그인, 로그아웃, 세션복원, 토큰갱신 로직
- `composables/useApiFetch.ts` — 인증 헤더 주입, 옵션 병합 로직
- `composables/useOrganization.ts` — OrgUser 변환 로직

#### Playwright E2E 테스트
- 로그인/로그아웃 플로우
- 정보화사업 프로젝트 목록 조회
- 전산업무비 목록 조회
- 전자결재 목록 조회

### 2.2 Out-of-Scope

- 백엔드 API 서버 실제 연동 테스트 (Mock 서버 사용)
- 시각적 회귀 테스트 (Visual Regression)
- 성능 테스트 / 부하 테스트
- CI/CD 파이프라인 연동 (1차 구성 후 별도 태스크로 진행)

---

## 3. 기술 선택

### 3.1 Vitest 선택 이유

| 항목 | Vitest | Jest |
|------|--------|------|
| Nuxt/Vite 호환성 | 네이티브 지원 | 별도 설정 복잡 |
| ESM 지원 | 기본 지원 | 추가 설정 필요 |
| 속도 | 빠름 (Vite 기반) | 상대적으로 느림 |
| Vue 3 / Pinia 지원 | `@vue/test-utils`, `@pinia/testing` 공식 지원 | 가능하나 설정 복잡 |

### 3.2 Playwright 선택 이유

| 항목 | Playwright | Cypress |
|------|-----------|---------|
| 멀티 브라우저 | Chrome, Firefox, Safari 동시 지원 | 기본 Chrome |
| TypeScript 지원 | 기본 제공 | 추가 설정 |
| 네트워크 Mock | `page.route()` 강력 지원 | 제한적 |
| 비용 | 무료 오픈소스 | 유료 플랜 존재 |

---

## 4. 구현 계획

### 4.1 패키지 설치

```bash
# Vitest 관련
npm install -D vitest @vue/test-utils @pinia/testing happy-dom

# Playwright 관련
npm install -D @playwright/test
npx playwright install chromium
```

### 4.2 디렉토리 구조

```
it_frontend/
├── tests/
│   ├── unit/                        # Vitest 단위 테스트
│   │   ├── utils/
│   │   │   └── common.test.ts       # formatBudget 등 유틸 함수
│   │   ├── stores/
│   │   │   └── auth.test.ts         # 인증 store
│   │   └── composables/
│   │       ├── useApiFetch.test.ts  # API fetch composable
│   │       └── useOrganization.test.ts
│   └── e2e/                         # Playwright E2E 테스트
│       ├── auth.spec.ts             # 로그인/로그아웃
│       ├── projects.spec.ts         # 정보화사업 프로젝트
│       ├── cost.spec.ts             # 전산업무비
│       └── approval.spec.ts         # 전자결재
├── vitest.config.ts                 # Vitest 설정
└── playwright.config.ts             # Playwright 설정
```

### 4.3 설정 파일 구성

#### `vitest.config.ts`
- `environment: 'happy-dom'` (브라우저 환경 시뮬레이션)
- `@nuxt/test-utils/e2e` 연동 또는 독립 설정
- path alias (`~`, `@`) 동일하게 적용
- coverage 리포트: `v8` 사용

#### `playwright.config.ts`
- baseURL: `http://localhost:3000`
- 테스트 전 dev 서버 자동 실행 (`webServer` 옵션)
- API 요청은 `page.route()`로 Mock 처리
- 스크린샷 실패 시 자동 캡처

### 4.4 package.json 스크립트 추가

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 5. 테스트 우선순위

| 우선순위 | 대상 | 이유 |
|---------|------|------|
| P0 | `utils/common.ts` — `formatBudget` | 순수 함수, 테스트 작성 용이, 예산 표시 핵심 |
| P0 | `stores/auth.ts` — `restoreSession` | 세션 복원 오류 시 전체 서비스 영향 |
| P1 | `stores/auth.ts` — `login`, `logout` | 인증 핵심 플로우 |
| P1 | `composables/useApiFetch.ts` | 모든 API 조회의 기반 |
| P1 | E2E: 로그인 플로우 | 진입 관문, 실패 시 전체 서비스 이용 불가 |
| P2 | E2E: 프로젝트 목록 조회 | 핵심 업무 화면 |
| P2 | E2E: 전자결재 목록 조회 | 핵심 업무 화면 |

---

## 6. 제약 사항 및 리스크

| 항목 | 내용 | 대응 방안 |
|------|------|----------|
| Nuxt 4 Auto-import | Vitest에서 `#app`, `#imports` 등 Nuxt auto-import 미지원 | `@nuxt/test-utils` 또는 manual import로 해결 |
| 백엔드 의존성 | E2E 테스트 시 실제 API 호출 불가 (개발환경 제약) | Playwright `page.route()`로 API Mock |
| Pinia 초기화 | 테스트 간 store 상태 오염 가능성 | `@pinia/testing`의 `createTestingPinia()` 사용 |
| Happy-dom 한계 | 일부 브라우저 API 미구현 | 필요 시 jsdom으로 대체 또는 skip |

---

## 7. 성공 기준

| 기준 | 목표값 |
|------|--------|
| Vitest 단위 테스트 작성 수 | 최소 15개 테스트 케이스 |
| Vitest 핵심 유틸 커버리지 | `utils/common.ts` 100% |
| Playwright E2E 시나리오 | 최소 4개 (로그인, 프로젝트, 전산업무비, 결재) |
| `npm run test` 실행 성공 | ✅ 오류 없이 통과 |
| `npm run test:e2e` 실행 성공 | ✅ 오류 없이 통과 (Mock 환경) |

---

## 8. 일정

| 단계 | 내용 |
|------|------|
| Phase 1 | Vitest 환경 설정 + P0 단위 테스트 작성 |
| Phase 2 | P1 단위 테스트 (auth store, useApiFetch) |
| Phase 3 | Playwright 환경 설정 + 로그인 E2E |
| Phase 4 | 나머지 E2E 시나리오 작성 |
| Phase 5 | 전체 검증 및 문서화 |
