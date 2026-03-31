<script setup lang="ts">
// /admin → /admin/dashboard 리다이렉트
definePageMeta({ middleware: 'admin', layout: 'admin' });
await navigateTo('/admin/codes', { replace: true });
</script>
