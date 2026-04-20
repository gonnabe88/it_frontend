<!--
================================================================================
[components/review/ReviewVersionHistory.vue] 버전 이력 표시
================================================================================
Design Ref: §5.3
- 버전 이력 목록 (타임라인 형태)
- 이전 버전 클릭 시 해당 버전 내용 표시
================================================================================
-->
<script setup lang="ts">
import { useReviewStore } from '~/stores/review';

const emit = defineEmits<{
  (e: 'select-version', version: string): void;
}>();

const store = useReviewStore();

/** 날짜+시각 포맷 */
const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** 버전 목록 (최신순) */
const reversedVersions = computed(() =>
  [...(store.session?.versions ?? [])].reverse()
);
</script>

<template>
  <div class="p-3">
    <h3 class="text-sm font-semibold text-surface-700 mb-3">버전 이력</h3>

    <div v-if="reversedVersions.length === 0" class="text-sm text-surface-400">
      아직 등록된 버전이 없습니다.
    </div>

    <div class="space-y-0">
      <div
        v-for="(ver, idx) in reversedVersions"
        :key="ver.version"
        class="relative flex gap-3 pb-4 cursor-pointer group"
        @click="emit('select-version', ver.version)"
      >
        <!-- 타임라인 세로선 -->
        <div class="flex flex-col items-center">
          <div
            class="w-3 h-3 rounded-full border-2 z-10"
            :class="(store.viewingVersion ?? store.session?.currentVersion) === ver.version
              ? 'bg-primary border-primary'
              : 'bg-white border-surface-300 group-hover:border-primary'"
          />
          <div
            v-if="idx < reversedVersions.length - 1"
            class="w-px flex-1 bg-surface-200"
          />
        </div>

        <!-- 버전 정보 -->
        <div class="flex-1 -mt-0.5">
          <div class="flex items-center gap-2">
            <span
class="text-sm font-medium" :class="
              (store.viewingVersion ?? store.session?.currentVersion) === ver.version
                ? 'text-primary'
                : 'text-surface-700 group-hover:text-primary'"
            >
              v{{ ver.version }}
            </span>
            <Tag
              v-if="ver.version === store.session?.currentVersion"
              value="최신"
              severity="success"
              class="text-[10px]"
            />
          </div>
          <p class="text-xs text-surface-400 mt-0.5">
            {{ formatDateTime(ver.createdAt) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
