# IT Portal System

IT 포털 시스템은 정보화사업 관리, 전산예산, 전자결재, IT자체감사, 사전진단 기능을 제공하는 **사내 통합 관리 시스템**입니다.

## 기술 스택

| 분류 | 기술 |
|---|---|
| **Framework** | [Nuxt 4](https://nuxt.com) (Vue 3) |
| **UI Library** | [PrimeVue 4](https://primevue.org) (Aura Theme) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com) |
| **State** | [Pinia 3](https://pinia.vuejs.org) |
| **Language** | TypeScript |
| **PDF** | pdfmake |
| **Editor** | Quill |
| **CI/CD** | GitLab CI (ClamAV 백신검사 + Trivy 취약점점검 + 내부 미러링) |

## 주요 기능

- **정보화사업 관리** — 사업 등록/수정, 예산·일정·자원 관리, PDF 보고서 출력
- **전산업무비 관리** — IT 운영비 등록/수정, 계약 및 지급 관리
- **전산예산** — 예산신청, 예산목록(정보화사업·전산업무비 통합 조회)
- **전자결재** — 결재 요청·승인·반려 프로세스
- **IT자체감사** — 일일/월별 감사 운영 및 통계
- **사전진단** — 시스템 자가진단

## 디렉토리 구조

```
it_frontend/
├── app/                          # Nuxt 4 앱 디렉토리
│   ├── assets/                   # CSS, 폰트, 이미지
│   ├── components/               # 공통 컴포넌트
│   │   ├── AppHeader.vue         #   MegaMenu 헤더 + 탭 바
│   │   ├── AppSidebar.vue        #   사이드바 네비게이션
│   │   ├── RichEditor.vue        #   Quill 리치 텍스트 에디터
│   │   └── common/               #   공통 UI (직원 검색 다이얼로그 등)
│   ├── composables/              # 재사용 로직
│   │   ├── useApiFetch.ts        #   인증 토큰 자동 첨부 useFetch 래퍼
│   │   ├── useAuth.ts            #   인증 상태 관리
│   │   ├── useProjects.ts        #   정보화사업 CRUD
│   │   ├── useCost.ts            #   전산업무비 CRUD
│   │   ├── useApprovals.ts       #   전자결재 관리
│   │   ├── useOrganization.ts    #   조직/사용자 조회
│   │   ├── usePdfReport.ts       #   PDF 보고서 생성
│   │   └── useTabs.ts            #   브라우저 탭 관리
│   ├── layouts/default.vue       # 기본 레이아웃 (사이드바 + 헤더 + 콘텐츠)
│   ├── middleware/auth.global.ts  # 글로벌 인증 미들웨어
│   ├── pages/                    # 파일 기반 라우팅
│   │   ├── index.vue             #   대시보드 (/)
│   │   ├── login.vue             #   로그인 (/login)
│   │   ├── info/                 #   정보화 관리
│   │   │   ├── index.vue         #     정보화 메인 (/info)
│   │   │   ├── projects/         #     정보화사업 (/info/projects)
│   │   │   └── cost/             #     전산업무비 (/info/cost)
│   │   ├── budget/               #   전산예산
│   │   │   ├── index.vue         #     예산 신청 (/budget)
│   │   │   └── list.vue          #     예산 목록 (/budget/list)
│   │   ├── approval/             #   전자결재 (/approval)
│   │   ├── audit/                #   IT자체감사 (/audit)
│   │   └── diagnosis/            #   사전진단 (/diagnosis)
│   ├── plugins/auth.ts           # $apiFetch 인터셉터 (토큰 갱신 + 401 처리)
│   ├── stores/auth.ts            # 인증 Pinia 스토어
│   ├── types/auth.ts             # 인증 관련 타입 정의
│   └── utils/common.ts           # 공통 유틸리티 함수
├── public/                       # 정적 파일
├── nuxt.config.ts                # Nuxt 설정
├── tailwind.config.js            # Tailwind 설정
├── .env                          # 환경 변수 (API_BASE)
└── .gitlab-ci.yml                # CI/CD 파이프라인
```

## 인증 구조

```
요청 흐름:
  useApiFetch (useFetch 래퍼)  ──→  GET 데이터 조회 (반응형)
  $apiFetch   ($fetch 래퍼)    ──→  POST/PUT/DELETE 데이터 변경 (일회성)

401 발생 시:
  1. Refresh Token으로 Access Token 갱신 시도
  2. 갱신 성공 → 자동 재요청
  3. 갱신 실패 → 로그아웃 + /login 리다이렉트
```

## 개발 환경 설정

### 사전 요구사항

- Node.js 18+
- npm

### 환경 변수

```bash
# .env
NUXT_PUBLIC_API_BASE=http://localhost:8080
```

### 실행

```bash
# 의존성 설치
npm install

# 타입 정의 생성 (IDE 타입 오류 해결)
npx nuxt prepare

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 운영 빌드
npm run build
```

## CI/CD 파이프라인

GitLab CI를 통해 자동화된 보안 점검 후 내부 저장소로 미러링합니다.

```
scan 단계:
  ├── virus_scan    ClamAV 백신 검사
  └── osv_scan      Trivy 오픈소스 취약점 점검 (HIGH, CRITICAL)

mirror 단계:
  └── internal_mirror   보안 점검 통과 시 내부 Git 저장소 미러링 (main 브랜치)
```

---

자세한 내용은 [Nuxt Documentation](https://nuxt.com/docs)을 참고하세요.
