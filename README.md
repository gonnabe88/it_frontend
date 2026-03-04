# 개발 노트 (Development Notes)

## 1. 시스템 개요

IT Portal은 정보화사업 및 전산업무비 예산을 통합 관리하는 내부 업무 시스템입니다.  
사업 등록 → 예산 신청 → 결재 → 집행 → 성과평가에 이르는 전체 생명주기를 지원합니다.

## 2. 기술 스택

| 구분 | 기술 | 버전/비고 |
|------|------|-----------|
| **프레임워크** | Nuxt 4 | Composition API + `<script setup>` |
| **UI 라이브러리** | PrimeVue | Aura 테마, 한국어 로케일 |
| **스타일링** | Tailwind CSS | `main.css`에 커스텀 색상 유틸리티(`kdb-tag-*`) 정의 |
| **상태관리** | Pinia | `stores/auth.ts` (인증 전역 상태) |
| **PDF 생성** | pdfmake | 한글 폰트(NanumGothic) 동적 로딩 |
| **리치 텍스트** | Quill | `RichEditor.vue` 래퍼 컴포넌트 |
| **보안** | isomorphic-dompurify | `v-html` XSS 방어 |

## 3. 프로젝트 구조

```
app/
├── components/          # 재사용 컴포넌트
│   ├── AppHeader.vue    # 메가메뉴 + 탭바 + 테마 토글
│   ├── AppSidebar.vue   # 좌측 네비게이션 (동적 메뉴)
│   ├── RichEditor.vue   # Quill 에디터 래퍼
│   └── common/
│       └── EmployeeSearchDialog.vue  # 직원 검색 다이얼로그
├── composables/         # 비즈니스 로직 (API 호출 + 상태)
│   ├── useApiFetch.ts   # 인증된 GET 요청 래퍼
│   ├── useApprovals.ts  # 전자결재 CRUD
│   ├── useAuth.ts       # 인증 상태 접근 (Pinia 래퍼)
│   ├── useCost.ts       # 전산업무비 CRUD
│   ├── useCurrencyRates.ts  # 환율 조회 + 원화 환산
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
│   ├── budget/          # 예산 신청 유형 선택 + 통합 목록
│   ├── diagnosis/       # 사전진단 설문
│   ├── info/
│   │   ├── cost/        # 전산업무비 (목록/상세/등록폼)
│   │   └── projects/    # 정보화사업 (목록/상세/등록폼/보고서)
│   ├── index.vue        # 루트 → /info 리다이렉트
│   └── login.vue        # 로그인 페이지
├── plugins/auth.ts      # $apiFetch 전역 제공 (인증 인터셉터)
├── stores/auth.ts       # Pinia 인증 스토어
├── types/auth.ts        # 인증 타입 정의
└── utils/common.ts      # 공통 유틸리티 (예산 포맷, 태그 클래스 등)
```

## 4. 핵심 아키텍처 설계 결정

### 4.1 이중 API 호출 패턴

| 패턴 | 용도 | 인증 처리 |
|------|------|-----------|
| `useApiFetch` | GET 요청 (useFetch 래핑) | 자동 토큰 주입 + 401 시 refresh |
| `$apiFetch` | POST/PUT/DELETE 요청 (ofetch 래핑) | 플러그인 인터셉터로 토큰 주입 |

**설계 이유**: Nuxt의 `useFetch`는 SSR/CSR 양쪽에서 동작하며 캐싱과 중복 호출 방지가 내장되어 GET에 적합합니다.  
반면 변경 요청(POST 등)은 `ofetch` 기반의 `$apiFetch`로 처리하여 유연성을 확보합니다.

### 4.2 순환 참조 방지 ($fetch 직접 사용)

`stores/auth.ts`에서는 `$apiFetch` 대신 Nuxt 내장 `$fetch`를 직접 사용합니다.  
`$apiFetch`가 스토어의 `accessToken`에 의존하므로, 스토어 내에서 호출하면 순환 참조가 발생하기 때문입니다.

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

### 4.7 한글 IME placeholder 대응

Quill 에디터에서 한글 입력 시 `compositionstart`/`compositionend` 이벤트를 감지하여  
`.ql-blank` 클래스를 수동 제어합니다. `MutationObserver`로 `.ql-editor` 렌더링 시점을 감지하고,  
`onBeforeUnmount`에서 이벤트 리스너와 옵저버를 정리하여 메모리 누수를 방지합니다.

## 5. 인증 흐름

```
1. 로그인   → stores/auth.ts login()  → accessToken + refreshToken + user 저장
2. API 요청 → useApiFetch / $apiFetch → Authorization: Bearer {accessToken} 자동 주입
3. 401 응답 → onResponseError         → refresh() 호출 → 새 토큰으로 재시도
4. 갱신 실패 → logout()                → 상태/localStorage 초기화 → /login 리다이렉트
5. 새로고침  → auth.global.ts          → restoreSession() → localStorage에서 상태 복원
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
| 2026-03-04 | 직원 검색 다이얼로그 연동 | `form.vue` 6개 필드(주관/IT 부서·팀장·담당자) |
| 2026-03-04 | 한글 IME placeholder 수정 | `RichEditor.vue` compositionstart/end 처리 |
| 2026-03-03 | JPA 복합키 리팩토링 | `ProjectId` @IdClass 적용 (백엔드) |
| 2026-03-02 | 예산 통합 목록 "전체" 탭 | `budget/list.vue` UnifiedBudgetItem 구현 |
| 2026-03-02 | 추진부서 필드 추가 | `Bcostm` 엔티티 + DTO (백엔드) |