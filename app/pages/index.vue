<script setup lang="ts">
definePageMeta({//
  title: '홈',
  middleware: [
    function (to, from) {
      if (to.path === '/') {
        return navigateTo('/info')
      }
    }
  ]
})
</script>
<template>
  <div>Redirecting...</div>
</template>
