<!--
================================================================================
[layouts/admin.vue] 관리자 전용 레이아웃
================================================================================
시스템관리자(ITPAD001) 전용 레이아웃입니다.
기존 default.vue 구조를 기반으로 관리자 서브메뉴 탭을 추가합니다.

[레이아웃 구조]
  ┌──────────┬──────────────────────────────────────┐
  │          │  AppHeader (메가메뉴 + 탭바)            │
  │ AppSide- ├──────────────────────────────────────┤
  │  bar     │  [관리자 서브메뉴 TabMenu]               │
  │          │  대시보드 | 공통코드 | 자격등급 | ...     │
  │          ├──────────────────────────────────────┤
  │          │  <slot /> (페이지 콘텐츠)               │
  │          ├──────────────────────────────────────┤
  │          │  Footer                               │
  └──────────┴──────────────────────────────────────┘

[Design Ref: §3.3 — layouts/admin.vue]
================================================================================
-->
<template>
    <!-- 전체 화면 flex 컨테이너 -->
    <div class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">

        <!-- 좌측 사이드바 (기존 공통 컴포넌트 재사용) -->
        <AppSidebar />

        <!-- 우측 메인 영역 -->
        <div class="flex-1 flex flex-col min-w-0 relative">
            <!-- 상단 헤더 (기존 공통 컴포넌트 재사용) -->
            <AppHeader />

            <!-- 관리자 서브메뉴 탭 -->
            <div class="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6">
                <TabMenu :model="adminMenuItems" class="border-none"
                    :pt="{ root: { class: 'border-none bg-transparent' } }" />
            </div>

            <!-- 메인 콘텐츠 영역 -->
            <main class="flex-1 overflow-auto p-6 scroll-smooth">
                <slot />
            </main>

            <!-- 하단 푸터 -->
            <footer class="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 shrink-0">
                &copy; 2026 IT Portal System. All rights reserved.
            </footer>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// 관리자 서브메뉴 탭 항목 — 9개 관리 화면
const adminMenuItems = ref([
    { label: '공통코드', icon: 'pi pi-list', command: () => navigateTo('/admin/codes') },
    { label: '자격등급', icon: 'pi pi-shield', command: () => navigateTo('/admin/auth-grades') },
    { label: '사용자', icon: 'pi pi-users', command: () => navigateTo('/admin/users') },
    { label: '조직', icon: 'pi pi-sitemap', command: () => navigateTo('/admin/organizations') },
    { label: '역할', icon: 'pi pi-id-card', command: () => navigateTo('/admin/roles') },
    { label: '로그인이력', icon: 'pi pi-history', command: () => navigateTo('/admin/login-history') },
    { label: 'JWT토큰', icon: 'pi pi-key', command: () => navigateTo('/admin/tokens') },
    { label: '첨부파일', icon: 'pi pi-paperclip', command: () => navigateTo('/admin/files') },
]);
</script>
