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
    <div class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
        <AppSidebar />
        <div class="flex-1 flex flex-col min-w-0 relative">
            <AppHeader />
            <main class="flex-1 overflow-auto p-6 scroll-smooth">
                <slot />
            </main>
            <footer class="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 shrink-0">
                &copy; 2026 IT Portal System. All rights reserved.
            </footer>
        </div>
    </div>
</template>
