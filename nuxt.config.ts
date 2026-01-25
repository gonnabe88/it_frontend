import Aura from '@primevue/themes/aura';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',
  devtools: {
    enabled: true,

    timeline: {
      enabled: true
    }
  },
  modules: [
    '@primevue/nuxt-module',
    '@pinia/nuxt'
  ],
  pinia: {
    storesDirs: ['./stores/**']
  },
  primevue: {
    options: {

      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        }
      },
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
  css: [
    'primeicons/primeicons.css',
    '~/assets/css/main.css'
  ],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  app: {
    head: {
      script: [
        {
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