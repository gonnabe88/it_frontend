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
    timeline: {
      enabled: true
    }
  },

  /* ── Nuxt 모듈 등록 ── */
  modules: [
    '@primevue/nuxt-module', // PrimeVue UI 컴포넌트 자동 임포트
    '@pinia/nuxt'            // Pinia 상태관리 모듈
  ],

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
    'primeicons/primeicons.css', // PrimeVue 아이콘 폰트
    '~/assets/css/main.css'      // Tailwind CSS + 커스텀 유틸리티 클래스
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
           * FOUC(Flash of Unstyled Content) 방지용 인라인 스크립트
           * Nuxt 하이드레이션 전에 실행되어 다크 모드 클래스를 즉시 적용합니다.
           * localStorage 'theme' 값 또는 시스템 다크 모드 설정을 기준으로 판단합니다.
           */
          innerHTML: `
            (function() {
              const savedTheme = localStorage.getItem('theme');
              const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            })()
          `,
          type: 'text/javascript'
        }
      ]
    }
  }
})