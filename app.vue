<script setup lang="ts">
import { useAuth } from '~/composables/useAuth';

const { restoreSession } = useAuth();

// 앱 시작 시 즉시 세션 복원 (onMounted보다 먼저 실행)
restoreSession();
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
    <ConfirmDialog />
  </NuxtLayout>
</template>
