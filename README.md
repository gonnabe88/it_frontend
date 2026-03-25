# 개발 노트 (Development Notes)

## 1. 시스템 개요

IT Portal은 정보화사업 및 전산업무비 예산을 통합 관리하는 내부 업무 시스템입니다.  
사업 등록 → 예산 작성 → 결재 → 집행 → 성과평가에 이르는 전체 생명주기를 지원합니다.

## 2. 기술 스택

| 구분 | 기술 | 버전/비고 |
|------|------|-----------|
| **프레임워크** | Nuxt 4 | Composition API + `<script setup>` |
| **UI 라이브러리** | PrimeVue | Aura 테마, 한국어 로케일 |
| **스타일링** | Tailwind CSS | `main.css`에 커스텀 색상 유틸리티(`kdb-tag-*`) 정의 |
| **상태관리** | Pinia | `stores/auth.ts` (인증 전역 상태) |
| **PDF 생성** | pdfmake | 한글 폰트(NanumGothic) 동적 로딩 |
| **리치 텍스트** | Tiptap | 통합 에디터 (StarterKit, Table, Image, Excalidraw 커스텀 노드) |
| **다이어그램** | Excalidraw | Tiptap 내 커스텀 노드로 삽입/재편집 |
| **한글 내보내기** | JSZip (HWPX) | `utils/hwpx.ts`에서 HTML→HWPX 변환, 클라이언트 전용 |
| **AI 연동** | Gemini API | `GeminiChat.vue` 플로팅 패널, 파일 첨부 지원 |
| **보안** | isomorphic-dompurify | `v-html` XSS 방어 |

## 3. 프로젝트 구조

```
app/
├── components/          # 재사용 컴포넌트
│   ├── AppHeader.vue    # 메가메뉴 + 탭바 + 테마 토글
│   ├── AppSidebar.vue   # 좌측 네비게이션 (동적 메뉴)
│   ├── TiptapEditor.vue # Tiptap 통합 리치 텍스트 에디터 (StarterKit + Table + Excalidraw)
│   ├── RichEditor.vue   # Quill 에디터 래퍼 (간단 리치 텍스트용)
│   ├── GeminiChat.vue   # AI 채팅 플로팅 패널 (Gemini API 연동)
│   ├── ExcalidrawWrapper.vue     # Excalidraw React 브리지
│   ├── ExcalidrawNodeView.vue    # Tiptap 내 Excalidraw NodeView
│   ├── ResizableImageNodeView.vue # Tiptap 내 크기 조절 이미지 NodeView
│   ├── approval/        # 결재 관련 컴포넌트
│   ├── budget/          # 예산 관련 컴포넌트
│   └── common/
│       └── EmployeeSearchDialog.vue  # 직원 검색 다이얼로그
├── composables/         # 비즈니스 로직 (API 호출 + 상태)
│   ├── useApiFetch.ts   # 인증된 GET 요청 래퍼 (httpOnly 쿠키 자동 전송)
│   ├── useApprovals.ts  # 전자결재 CRUD
│   ├── useAuth.ts       # 인증 상태 접근 (Pinia 래퍼)
│   ├── useCost.ts       # 전산업무비 CRUD
│   ├── useCurrencyRates.ts  # 환율 조회 + 원화 환산
│   ├── useDocuments.ts  # 요구사항 정의서 CRUD
│   ├── useGuideDocuments.ts  # 가이드 문서 CRUD
│   ├── useFiles.ts      # 첨부파일 업로드/다운로드/미리보기
│   ├── useExcalidrawDialog.ts  # Excalidraw 편집 다이얼로그 상태
│   ├── useHwpxExport.ts # HWPX(한글) 파일 내보내기
│   ├── useOrganization.ts   # 조직도 + 사용자 조회
│   ├── usePdfReport.ts  # PDF 보고서 생성
│   ├── useProjects.ts   # 정보화사업 CRUD
│   └── useTabs.ts       # 멀티탭 네비게이션 관리
├── layouts/default.vue  # 기본 레이아웃 (사이드바+헤더+콘텐츠)
├── middleware/
│   └── auth.global.ts   # 전역 인증 미들웨어
├── pages/               # 파일 기반 라우팅
│   ├── approval/        # 전자결재 목록 + 결재 처리
│   ├── audit/           # IT 자체감사 대시보드
│   ├── budget/          # 예산 작성 유형 선택 + 통합 목록
│   ├── diagnosis/       # 사전진단 설문
│   ├── guide/           # 가이드 문서 (목록/상세/등록폼)
│   ├── info/
│   │   ├── cost/        # 전산업무비 (목록/상세/등록폼)
│   │   ├── documents/   # 요구사항 정의서 (목록/상세/등록폼)
│   │   └── projects/    # 정보화사업 (목록/상세/등록폼/보고서)
│   ├── index.vue        # 루트 → /info 리다이렉트
│   └── login.vue        # 로그인 페이지
├── plugins/auth.ts      # $apiFetch 전역 제공 (인증 인터셉터)
├── stores/auth.ts       # Pinia 인증 스토어
├── types/auth.ts        # 인증 타입 정의
└── utils/
    ├── common.ts        # 공통 유틸리티 (예산 포맷, 커스텀 태그 클래스, 전결권 자동 계산)
    └── hwpx.ts          # HTML→HWPX 변환 (635줄, HWP 파일 구조 분석 기반)
```

## 4. 핵심 아키텍처 설계 결정

### 4.1 이중 API 호출 패턴

| 패턴 | 용도 | 인증 처리 |
|------|------|-----------|
| `useApiFetch` | GET 요청 (useFetch 래핑) | httpOnly 쿠키 자동 전송 + 401 시 refresh |
| `$apiFetch` | POST/PUT/DELETE 요청 (ofetch 래핑) | 플러그인 인터셉터로 httpOnly 쿠키 자동 전송 |

**설계 이유**: Nuxt의 `useFetch`는 SSR/CSR 양쪽에서 동작하며 캐싱과 중복 호출 방지가 내장되어 GET에 적합합니다.  
반면 변경 요청(POST 등)은 `ofetch` 기반의 `$apiFetch`로 처리하여 유연성을 확보합니다.

### 4.2 순환 참조 방지 ($fetch 직접 사용)

`stores/auth.ts`에서는 `$apiFetch` 대신 Nuxt 내장 `$fetch`를 직접 사용합니다.  
`$apiFetch`가 스토어의 인증 상태에 의존하므로, 스토어 내에서 호출하면 순환 참조가 발생하기 때문입니다.

### 4.3 전결권 자동 계산

소요자원 입력 시 **자본예산**(개발비/기계장치/기타무형자산)과 **일반관리비**(전산임차료/전산제비) 합계를 기반으로  
`getApprovalAuthority()` 함수가 결재권자를 자동 판정합니다 (부장 → 지역본부장 → 부문장 → 전무이사 → 회장).

### 4.4 DOMPurify 보안 정책

Rich Text(HTML) 필드(`prjDes`, `prjRng`)는 `isomorphic-dompurify`로 새니타이징한 후 `v-html`에 바인딩합니다.  
CLAUDE.md 규칙에 따라 **모든 v-html 사용 시 DOMPurify 적용이 필수**입니다.

### 4.5 다크모드 FOUC 방지

`nuxt.config.ts`의 인라인 스크립트가 Nuxt 하이드레이션 **이전**에 실행되어  
`localStorage('theme')` 또는 시스템 설정 기반으로 `<html class="dark">`를 즉시 적용합니다.

### 4.6 직원 검색 다이얼로그 공유 패턴

`EmployeeSearchDialog.vue`는 조직 트리 + 사용자 목록을 표시하고, 선택 시 `@select` 이벤트로  
`{ eno, usrNm, bbrNm, orgCode }` 형태의 직원 정보를 전달합니다.

하나의 다이얼로그를 여러 폼 필드에서 공유하는 패턴:
```ts
// 1. 어떤 필드에서 열었는지 추적
const activeDialogField = ref<'svnDpm' | 'itDpm' | ...>('svnDpm');

// 2. 헤더를 computed로 파생
const FIELD_HEADERS = { svnDpm: '주관부서 검색', ... } as const;
const dialogHeader = computed(() => FIELD_HEADERS[activeDialogField.value]);

// 3. 선택 시 FIELD_CONFIG 매핑으로 폼에 세팅
const FIELD_CONFIG = {
  svnDpm:    { valueKey: 'orgCode', labelKey: 'bbrNm' },
  svnDpmTlr: { valueKey: 'eno',     labelKey: 'usrNm' },
  ...
};
```

### 4.7 httpOnly 쿠키 인증 전략

JWT 토큰(accessToken, refreshToken)은 서버가 `Set-Cookie` 헤더로 httpOnly 쿠키에 저장합니다.  
JavaScript에서 직접 접근할 수 없어 XSS 공격 시 토큰 탈취를 방지합니다.  
프론트엔드는 `credentials: 'include'`만 설정하면 브라우저가 쿠키를 자동 전송합니다.

### 4.8 Tiptap 에디터 아키텍처

`TiptapEditor.vue`는 20개 이상의 확장을 통합하여 완전한 리치 텍스트 편집 기능을 제공합니다:
- **커스텀 노드**: `ExcalidrawExtension`(다이어그램), `ResizableImage`(크기 조절 이미지), `CustomTable`(너비 저장)
- **상태 공유**: `useExcalidrawDialog()` composable로 NodeView-Editor 통신
- **파일 업로드**: `imageUploadFn` prop으로 API 업로드/base64 모드 선택
- **TOC**: Heading 노드에 자동 `id` 부여 → `update:toc` 이벤트로 부모 전달
- **드래그&드롭**: 이미지 파일 드롭 시 자동 업로드/삽입

### 4.9 HWPX 내보내기 (한글 문서)

`utils/hwpx.ts`는 실제 HWP가 생성한 HWPX 파일을 직접 분석하여 동일한 구조를 구현합니다:  
- HTML → DocNode(ParagraphNode/TableNode) 변환 → HWPX XML 생성 → JSZip으로 압축
- 폰트: 맑은 고딕 (10pt 본문, 15pt H1, 12pt H3)
- 표: th/td 구분, 셀 병합, 파란 배경 헤더, 균등 열배분

## 5. 인증 흐름

```
1. 로그인   → stores/auth.ts login()  → 서버가 httpOnly 쿠키로 토큰 세팅 + user 정보 localStorage 저장
2. API 요청 → useApiFetch / $apiFetch → credentials:'include'로 httpOnly 쿠키 자동 전송
3. 401 응답 → onResponseError         → refresh() 호출 → 서버가 새 쿠키 세팅 → tokenRefreshSignal++로 재요청
4. 갱신 실패 → logout()                → 상태/localStorage 초기화 → /login 리다이렉트
5. 새로고침  → auth.global.ts          → restoreSession() → localStorage에서 user 정보 복원
```

## 6. 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `NUXT_PUBLIC_API_BASE` | 백엔드 API 서버 주소 | `http://localhost:8080` |

## 7. 개발 환경 실행

```bash
# 의존성 설치
npm install

# 타입 정의 생성 (Type Generation)
'Nuxt의 자동 생성 타입(.nuxt/)을 최신 상태로 유지하려면 아래 명령어를 실행하세요. IDE에서 타입 오류(예: vue 모듈을 찾을 수 없음)가 발생할 때 유용합니다.'
npm run postinstall

# 개발 서버 실행 (기본 포트: 3000)
npm run dev
```

## 7.1 테스트 실행

### 단위 테스트 (Vitest)

```bash
# 전체 단위 테스트 실행 (1.4초 내 완료)
npm test

# 파일 변경 감지 + 자동 재실행 (개발 중 사용)
npm run test:watch

# 코드 커버리지 리포트 생성 (coverage/ 디렉토리)
npm run test:coverage
```

### E2E 테스트 (Playwright)

```bash
# E2E 테스트 실행 (dev 서버 자동 기동)
npm run test:e2e

# Playwright 인터랙티브 UI 모드 (테스트 디버깅)
npm run test:e2e:ui
```

### 테스트 구조

```
tests/
├── unit/                            # Vitest 단위 테스트 (68개 케이스)
│   ├── utils/common.test.ts         # formatBudget, getApprovalTagClass 등 유틸 함수
│   ├── stores/auth.test.ts          # useAuthStore (login, logout, restoreSession, refresh)
│   └── composables/useApiFetch.test.ts  # watch 병합, credentials, 옵션 전달 검증
└── e2e/                             # Playwright E2E 테스트 (10개 시나리오)
    ├── helpers/mockApi.ts           # 공통 Mock 헬퍼 (mockLoginApi, mockApi, setLoggedIn)
    ├── auth.spec.ts                 # 로그인 성공/실패 플로우
    ├── projects.spec.ts             # 정보화사업 목록 조회
    ├── cost.spec.ts                 # 전산업무비 목록 조회
    └── approval.spec.ts             # 전자결재 목록 조회
```

### Mock 전략

- **단위 테스트**: `vi.stubGlobal('$fetch', mockFetch)`로 API 호출 대체, `Object.assign(process, { client: true })`로 클라이언트 환경 시뮬레이션
- **E2E 테스트**: `page.route()`로 API 응답 Mock, `page.addInitScript()`로 localStorage user 주입 (백엔드 없이 실행 가능)

### Nuxt auto-import 관련 주의사항

Vitest는 Nuxt auto-import(`#app`, `#imports`)를 지원하지 않으므로, 테스트 파일에서 `ref`, `computed`, `defineStore` 등을 명시적으로 import합니다.
`useRuntimeConfig`, `navigateTo` 등 Nuxt 전용 API는 `vi.stubGlobal()`로 Mock 처리합니다.

## 8. 코딩 컨벤션 요약

- 모든 코드 주석은 **한국어**로 작성합니다.
- Composition API + `<script setup lang="ts">` 패턴을 사용합니다.
- PrimeVue 컴포넌트를 우선 사용하고, Tailwind CSS로 스타일링합니다.
- API 요청: GET → `useApiFetch`, POST/PUT/DELETE → `$apiFetch`
- API 베이스 URL은 `runtimeConfig`에서 관리합니다.
- `components/common/` 하위 컴포넌트는 Nuxt 자동 등록 시 `Common` 접두사가 붙으므로,  
  기존 코드와의 일관성을 위해 **명시적 import**를 사용합니다.
- 상세 규칙은 `CLAUDE.md` 파일을 참조하세요.

## 9. 최근 구현 이력

| 날짜 | 항목 | 비고 |
|------|------|------|
| 2026-03-25 | 전체 프로젝트 문서화 리프레시 | 소스 코드 주석 전수 점검(60개 파일), README.md 최신화 |
| 2026-03-22 | Tiptap 에디터 관련 수정 | `__VLS_ctx.editor` undefined 오류 해결 |
| 2026-03-14 | TOC 스크롤 기능 구현 | 목차 클릭 시 해당 섹션으로 부드러운 스크롤 |
| 2026-03-14 | 테이블 포맷 보존 수정 | 요구사항 정의서 reqCone 데이터 손실 해결 |
| 2026-03-09 | httpOnly 쿠키 인증 전환 | `stores/auth.ts`, `plugins/auth.ts`, `useApiFetch.ts` 전면 개편 |
| 2026-03-08 | 프론트엔드 테스트 환경 구축 | Vitest(단위 68개) + Playwright(E2E 10개) |
| 2026-03-08 | RichEditor 리스트 스타일 수정 | 중복 리스트 마커 버그 해결 |
| 2026-03-04 | 직원 검색 다이얼로그 연동 | `form.vue` 6개 필드(주관/IT 부서·팀장·담당자) |
| 2026-03-03 | JPA 복합키 리팩토링 | `ProjectId` @IdClass 적용 (백엔드) |
| 2026-03-02 | 예산 통합 목록 "전체" 탭 | `budget/list.vue` UnifiedBudgetItem 구현 |