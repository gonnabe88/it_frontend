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
import VersionHistoryDialog from '~/components/common/VersionHistoryDialog.vue';
import type { VersionHistoryItem } from '~/components/common/VersionHistoryDialog.vue';

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

/* ── 버전 히스토리 다이얼로그 ── */
/** 버전 뱃지 클릭 시 열리는 다이얼로그 표시 여부 */
const versionDialogVisible = ref(false);

/** 현재 표시 버전 문자열 (과거 열람 중이면 viewingVersion, 아니면 currentVersion) */
const currentVersionStr = computed<string | undefined>(() => {
  if (!store.session) return undefined;
  return store.viewingVersion ?? store.session.currentVersion;
});

/** 현재 버전 숫자 (공통 다이얼로그 하이라이트용) */
const currentVersionNum = computed<number | undefined>(() => {
  if (!currentVersionStr.value) return undefined;
  const parsed = Number.parseFloat(currentVersionStr.value);
  return Number.isNaN(parsed) ? undefined : parsed;
});

/**
 * 공통 VersionHistoryDialog에 전달할 버전 아이템 목록
 * session.versions는 오름차순으로 저장되어 있으므로
 * 최신 버전을 상단에 보여주기 위해 reverse 처리합니다.
 */
const versionItems = computed<VersionHistoryItem[]>(() => {
  if (!store.session) return [];
  return [...store.session.versions].reverse().map(v => ({
    key: v.version,
    version: Number.parseFloat(v.version),
    changedAt: v.createdAt,
  }));
});

/**
 * 버전 항목 선택 → 부모(review.vue)로 version-change 이벤트 전달
 * 공통 컴포넌트는 number 타입을 사용하므로 string("0.08") 포맷으로 변환하여 전달합니다.
 */
const onSelectVersion = (item: VersionHistoryItem) => {
  emit('version-change', item.version.toFixed(2));
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

    <!-- 버전 뱃지 (클릭 시 버전 목록 다이얼로그) -->
    <Tag
      v-if="currentVersionStr"
      :value="`v${currentVersionStr}`"
      severity="info"
      class="cursor-pointer hover:opacity-80 transition-opacity"
      title="버전 목록 보기"
      @click="versionDialogVisible = true"
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

  <!-- 버전 히스토리 다이얼로그 (버전 뱃지 클릭 시 표시) -->
  <VersionHistoryDialog
    v-model:visible="versionDialogVisible"
    :versions="versionItems"
    :current-version="currentVersionNum"
    @select="onSelectVersion"
  />

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
