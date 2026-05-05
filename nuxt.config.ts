/**
 * ============================================================================
 * [nuxt.config.ts] Nuxt 애플리케이션 전역 설정
 * ============================================================================
 * IT Portal 프로젝트의 Nuxt 4 프레임워크 설정 파일입니다.
 *
 * [주요 설정 항목]
 *  - runtimeConfig : API 베이스 URL 등 환경변수 기반 런타임 설정
 *  - modules       : PrimeVue UI 라이브러리 + Pinia 상태관리 모듈
 *  - primevue      : Aura 테마, 다크모드 셀렉터, 한국어 로케일 설정
 *  - css           : PrimeIcons + 글로벌 스타일시트(main.css)
 *  - postcss       : Tailwind CSS + Autoprefixer 플러그인
 *  - app.head      : FOUC 방지용 다크모드 초기화 인라인 스크립트
 *
 * [환경변수]
 *  - NUXT_PUBLIC_API_BASE : 백엔드 API 서버 주소 (기본값: http://localhost:8080)
 * ============================================================================
 */
import Aura from '@primevue/themes/aura';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',
  /**
   * SPA 모드 — 정적 SSG에서 발생하던 _payload.json 하이드레이션 이슈 회피
   *
   * [전환 사유]
   *  - npm run generate(SSG) + nginx 서빙 시 SSO 무한 리다이렉트 발생.
   *  - 원인: 빌드 시점 Pinia 스토어 user=null 상태가 _payload.json에 직렬화되어
   *          클라이언트 하이드레이션 시 it-portal-user 쿠키 기반 user.value를
   *          null로 덮어쓰는 타이밍 이슈.
   *  - 사내 포털이라 SEO 불필요 → 완전 클라이언트 렌더링이 가장 단순한 해결.
   *
   * [동작 변화]
   *  - prerender 미수행 → 모든 라우트가 동일한 index.html에서 클라이언트 라우팅
   *  - SSR 없음 → 서버 미들웨어/페이로드 추출 무관
   */
  ssr: false,

  /* ── Nuxt 4 호환 모드: app/ 디렉토리를 소스 루트(~)로 사용 ── */
  future: {
    compatibilityVersion: 4
  },

  /* ── 빌드 디렉토리: node_modules/.cache 경로 대신 .nuxt 사용 (Windows 호환) ── */
  buildDir: '.nuxt',

  /* ── 런타임 설정: 환경변수 기반 API 베이스 URL ── */
  runtimeConfig: {
    public: {
      /** 백엔드 API 서버 주소 (.env의 NUXT_PUBLIC_API_BASE로 오버라이드 가능) */
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080'
    }
  },

  /* ── 개발 도구 설정 ── */
  devtools: {
    enabled: true,
    // timeline은 메모리를 많이 소비하므로 비활성화
    timeline: {
      enabled: false
    }
  },
  /* ── Vue 컴파일러: Web Component 등록 ── */
  vue: {
    compilerOptions: {
      // mathlive의 <math-field>를 Vue 컴포넌트가 아닌 Web Component로 인식
      isCustomElement: (tag: string) => tag === 'math-field'
    }
  },

  /* ── Vite 번들러 메모리 최적화 ── */
  vite: {
    optimizeDeps: {
      // CJS 의존성을 가진 패키지들을 Vite가 ESM으로 사전 번들링합니다.
      // exclude 시 내부 CJS 모듈이 브라우저에 그대로 전달되어 명명 내보내기 오류가 발생합니다.
      include: ['react', 'react-dom', 'react/jsx-runtime', 'quill'],
      // mathlive는 브라우저 전용(customElements 등) — 사전 번들링 제외
      exclude: ['mathlive'],
    },
    // 주의: vite.ssr.external에 mathlive를 추가하면 Node.js가 require('mathlive')를 시도하고
    // customElements.define()이 Node.js에 없어 "worker exited with code 0" 크래시 발생
    // → NodeView 컴포넌트의 onMounted에서 @vite-ignore 동적 import로만 로드
    css: {
      devSourcemap: true
    },
  },

  /* ── Nuxt 모듈 등록 ── */
  modules: [
    '@nuxtjs/tailwindcss',
    '@primevue/nuxt-module', // PrimeVue UI 컴포넌트 자동 임포트
    '@pinia/nuxt'            // Pinia 상태관리 모듈
  ],


  /* ── Nitro 프리렌더링: 백엔드 의존/미구현 라우트 제외 ── */
  nitro: {
    prerender: {
      ignore: [
        // 미구현 메뉴 라우트 (AppSidebar에 링크되어 크롤러가 접근)
        '/info/estimation',
        '/info/deliberation',
        '/info/contract',
        '/info/payment',
        '/info/evaluation',
        '/info/council/working',
        '/info/council/promotion',
        '/info/council/committee',
        '/audit/daily',
        '/audit/monthly',
        '/audit/quarterly',
        '/audit/biannual',
        '/audit/annual',
        '/audit/manage/daily',
        '/audit/manage/monthly',
        '/audit/manage/quarterly',
        '/audit/manage/biannual',
        '/audit/manage/annual',
      ]
    }
  },

  /* ── Pinia 스토어 자동 인식 디렉토리 ── */
  pinia: {
    storesDirs: ['./app/stores/**']
  },

  /* ── PrimeVue 설정: 테마 + 한국어 로케일 ── */
  primevue: {
    options: {
      theme: {
        preset: Aura, // Aura 테마 프리셋 적용
        options: {
          darkModeSelector: '.dark', // <html class="dark">로 다크모드 전환
        }
      },
      /** PrimeVue 컴포넌트 한국어 번역 (DatePicker, Password 등) */
      locale: {
        firstDayOfWeek: 0,
        dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
        dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
        dayNamesMin: ["일", "월", "화", "수", "목", "금", "토"],
        monthNames: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
        monthNamesShort: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
        today: '오늘',
        clear: '초기화',
        dateFormat: 'yy-mm-dd',
        weekHeader: '주',
        weak: '약함',
        medium: '보통',
        strong: '강함',
        passwordPrompt: '비밀번호를 입력하세요',
        emptyFilterMessage: '결과가 없습니다',
        emptyMessage: '데이터가 없습니다',
        fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
      }
    }
  },

  /* ── 글로벌 CSS 파일 ── */
  css: [
    '~/assets/css/main.css',                               // Tailwind CSS + 커스텀 유틸리티 클래스
  ],

  /* ── PostCSS 플러그인: Tailwind CSS + 자동 벤더 프리픽스 ── */
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  /* ── 앱 HTML Head 설정 ── */
  app: {
    head: {
      script: [
        {
          /**
           * 다크모드 + 인증 플래시(FOUC) 방지 인라인 스크립트
           * Vue 하이드레이션 전에 실행됩니다.
           *
           * 1) 다크모드: theme-dark 쿠키로 <html class="dark"> 즉시 적용
           * 2) 인증 플래시 방지: it-portal-user 쿠키가 없고 /login이 아닌 경우
           *    SSO 리다이렉트가 완료될 때까지 페이지를 투명하게 유지합니다.
           */
          innerHTML: `
            (function() {
              var m = document.cookie.match('(^|;\\s*)theme-dark=([^;]*)');
              var saved = m ? decodeURIComponent(m[2]) : null;
              var dark = saved === 'true';
              if (dark) {
                document.documentElement.classList.add('dark');
                document.documentElement.style.colorScheme = 'dark';
              } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.style.colorScheme = 'light';
              }
              var hasAuth = /(?:^|;\\s*)it-portal-user=/.test(document.cookie);
              var isLogin = location.pathname === '/login';
              if (!hasAuth && !isLogin) {
                document.documentElement.style.visibility = 'hidden';
              }
            })()
          `,
          type: 'text/javascript',
          tagPriority: 0
        }
      ]
    }
  }
})
