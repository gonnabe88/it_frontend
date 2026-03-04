<!--
================================================================================
[app.vue] Nuxt 애플리케이션 루트 컴포넌트
================================================================================
Nuxt 4 앱의 최상위 컴포넌트입니다.
NuxtLayout으로 레이아웃(default.vue)을 적용하고,
NuxtPage로 URL 기반의 라우팅 페이지를 렌더링합니다.

[포함 컴포넌트]
  - NuxtLayout    : 레이아웃 래퍼 (layouts/default.vue 자동 적용)
  - NuxtPage      : 파일 기반 라우팅 페이지 렌더링
  - ConfirmDialog : PrimeVue 전역 확인 다이얼로그 (useConfirm() 호출 시 표시)
  - Toast         : PrimeVue 전역 알림 (useToast() 호출 시 표시)
================================================================================
-->
<template>
  <!-- 레이아웃 래퍼: layouts/default.vue가 적용됩니다 -->
  <NuxtLayout>
    <!-- 파일 기반 라우팅으로 현재 URL에 해당하는 페이지 렌더링 -->
    <NuxtPage />
    <!-- PrimeVue 전역 확인 다이얼로그 (삭제, 저장 완료 등에서 사용) -->
    <ConfirmDialog />
    <!-- PrimeVue 전역 Toast 알림 (API 오류 등 비동기 피드백에 사용) -->
    <Toast position="top-right" />
  </NuxtLayout>
</template>
