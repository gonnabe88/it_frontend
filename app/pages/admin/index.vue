<!--
================================================================================
[pages/admin/index.vue] 관리자 루트 경로 리다이렉트 페이지
================================================================================
/admin 접근 시 /admin/dashboard로 자동 리다이렉트합니다.
실제 콘텐츠 없이 라우팅만 수행합니다.
================================================================================
-->
<script setup lang="ts">
// /admin → /admin/dashboard 리다이렉트
definePageMeta({ middleware: 'admin', layout: 'admin' });
await navigateTo('/admin/dashboard', { replace: true });
</script>
