<!--
================================================================================
[layouts/admin.vue] 관리자 전용 레이아웃
================================================================================
시스템관리자(ITPAD001) 전용 레이아웃입니다.
default.vue와 동일한 사이드바+헤더+콘텐츠+푸터 구성을 사용합니다.

[레이아웃 구조]
  ┌──────────┬─────────────────────────────┐
  │          │  AppHeader (탭바 + 메뉴)      │
  │ AppSide- ├─────────────────────────────┤
  │  bar     │  <slot /> (페이지 콘텐츠)     │
  │          ├─────────────────────────────┤
  │          │  Footer                      │
  └──────────┴─────────────────────────────┘

[Design Ref: §3.3 — layouts/admin.vue]
================================================================================
-->
<template>
    <div class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans print:h-auto print:overflow-visible print:bg-white">
        <AppSidebar class="print:hidden" />
        <div class="flex-1 flex flex-col min-w-0 relative print:h-auto print:overflow-visible print:block">
            <AppHeader class="print:hidden" />
            <main class="main-scroll flex-1 min-h-0 overflow-auto p-6 print:overflow-visible print:p-0 print:h-auto">
                <slot />
            </main>
            <footer class="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 shrink-0 print:hidden">
                &copy; 2026 IT Portal System. All rights reserved.
            </footer>
        </div>
    </div>
</template>

<style scoped>
.main-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.main-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.main-scroll::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.2s;
}
.main-scroll:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.18);
}
.main-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.35);
}
</style>
