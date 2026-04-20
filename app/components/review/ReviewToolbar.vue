<!--
================================================================================
[components/review/ReviewToolbar.vue] 상단 툴바
================================================================================
Design Ref: §5.4 Toolbar 영역
- 뒤로가기 버튼, 문서 제목, 버전 선택, 검토요청/검토완료 버튼
- 검토 현황 배지 (팀별 상태)
================================================================================
-->
<script setup lang="ts">
import { useReviewStore } from '~/stores/review';

const emit = defineEmits<{
  (e: 'submit-for-review'): void;
  (e: 'complete-review' | 'version-change', value: string): void;
}>();

const store = useReviewStore();
const router = useRouter();
const route = useRoute();

/** 뒤로가기 */
const goBack = () => {
  const docId = route.params.id as string;
  router.push(`/info/documents/${docId}`);
};

/** 버전 변경 */
const handleVersionChange = (event: { value: string }) => {
  emit('version-change', event.value);
};

/** 검토자 선택 다이얼로그 표시 여부 */
const showReviewerSelect = ref(false);
/** 선택된 검토자 사번 */
const selectedReviewer = ref<string | null>(null);

/** 검토완료 처리 */
const handleCompleteReview = () => {
  if (store.session && store.session.reviewers.length > 0) {
    // 미완료 검토자 중 첫 번째를 기본 선택
    const pending = store.session.reviewers.find(r => r.status === 'pending');
    if (pending) {
      selectedReviewer.value = pending.eno;
      showReviewerSelect.value = true;
    }
  }
};

/** 검토자 선택 후 확인 */
const confirmReview = () => {
  if (selectedReviewer.value) {
    emit('complete-review', selectedReviewer.value);
    showReviewerSelect.value = false;
    selectedReviewer.value = null;
  }
};

/** 미완료 검토자 목록 */
const pendingReviewers = computed(() =>
  store.session?.reviewers.filter(r => r.status === 'pending') ?? []
);
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-surface-200 shadow-sm">
    <!-- 뒤로가기 -->
    <Button
      icon="pi pi-arrow-left"
      label="돌아가기"
      text
      size="small"
      @click="goBack"
    />

    <!-- 구분선 -->
    <div class="w-px h-6 bg-surface-200" />

    <!-- 문서 제목 -->
    <h1 class="text-base font-semibold text-surface-800 truncate flex-1">
      {{ store.session?.docTitle ?? '사전협의' }}
    </h1>

    <!-- 버전 선택 -->
    <Select
      v-if="store.versionList.length > 0"
      :model-value="store.viewingVersion ?? store.session?.currentVersion"
      :options="store.versionList"
      option-label="label"
      option-value="value"
      placeholder="버전"
      class="w-28"
      size="small"
      @change="handleVersionChange"
    />

    <!-- 검토요청 버튼 (작성자용) -->
    <Button
      v-if="!store.isViewingHistory"
      label="검토요청"
      icon="pi pi-send"
      severity="info"
      size="small"
      :disabled="store.session?.status === 'completed'"
      @click="emit('submit-for-review')"
    />

    <!-- 검토완료 버튼 (검토자용) -->
    <Button
      v-if="!store.isViewingHistory && store.session?.status === 'reviewing'"
      label="검토완료"
      icon="pi pi-check"
      severity="success"
      size="small"
      :disabled="pendingReviewers.length === 0"
      @click="handleCompleteReview"
    />

  </div>

  <!-- 검토자 선택 다이얼로그 -->
  <Dialog
    v-model:visible="showReviewerSelect"
    header="검토완료 처리"
    :modal="true"
    :style="{ width: '400px' }"
  >
    <p class="mb-3 text-sm text-surface-600">검토를 완료할 검토자를 선택하세요.</p>
    <div class="space-y-2">
      <div
        v-for="reviewer in pendingReviewers"
        :key="reviewer.eno"
        class="flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors"
        :class="selectedReviewer === reviewer.eno
          ? 'border-primary bg-primary/5'
          : 'border-surface-200 hover:bg-surface-50'"
        @click="selectedReviewer = reviewer.eno"
      >
        <RadioButton
          :model-value="selectedReviewer"
          :value="reviewer.eno"
          @update:model-value="selectedReviewer = $event"
        />
        <div>
          <div class="text-sm font-medium">{{ reviewer.empNm }}</div>
          <div class="text-xs text-surface-500">{{ reviewer.team }}</div>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="취소" text @click="showReviewerSelect = false" />
      <Button label="확인" icon="pi pi-check" :disabled="!selectedReviewer" @click="confirmReview" />
    </template>
  </Dialog>
</template>
