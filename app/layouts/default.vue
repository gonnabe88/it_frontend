<!--
================================================================================
[layouts/default.vue] 기본 레이아웃
================================================================================
인증된 사용자에게 표시되는 메인 애플리케이션 레이아웃입니다.
좌측 사이드바, 상단 헤더, 중앙 콘텐츠 영역, 하단 푸터로 구성됩니다.

[레이아웃 구조]
  ┌──────────┬─────────────────────────────┐
  │          │  AppHeader (탭바 + 메뉴)      │
  │ AppSide- ├─────────────────────────────┤
  │  bar     │  <slot /> (페이지 콘텐츠)     │
  │          ├─────────────────────────────┤
  │          │  Footer (저작권 표시)          │
  └──────────┴─────────────────────────────┘

[인쇄 대응]
  - print: 클래스로 사이드바/헤더/푸터를 숨기고 콘텐츠만 인쇄합니다.
================================================================================
-->
<template>
  <!-- 전체 화면 flex 컨테이너: 사이드바 + 메인 영역 수평 배치 -->
  <div
    class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans print:h-auto print:overflow-visible print:bg-white">

    <!-- 좌측 사이드바 네비게이션 (인쇄 시 숨김) -->
    <AppSidebar class="print:hidden" />

    <!-- 우측 메인 영역: 헤더 + 콘텐츠 + 푸터 수직 배치 -->
    <div class="flex-1 flex flex-col min-w-0 relative print:h-auto print:overflow-visible print:block">
      <!-- 상단 헤더: 메가메뉴 + 탭바 + 사용자 정보 (인쇄 시 숨김) -->
      <AppHeader class="print:hidden" />

      <!-- 메인 콘텐츠 영역: 각 페이지가 <slot />으로 삽입됩니다 -->
      <main class="flex-1 overflow-auto p-6 scroll-smooth print:overflow-visible print:p-0 print:h-auto">
        <slot />
      </main>

      <!-- 하단 푸터: 저작권 표시 (인쇄 시 숨김) -->
      <footer
        class="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 shrink-0 print:hidden">
        &copy; 2026 IT Portal System. All rights reserved.
      </footer>
    </div>
  </div>
</template>
