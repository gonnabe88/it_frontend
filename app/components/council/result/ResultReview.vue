<!--
================================================================================
[components/council/result/ResultReview.vue]
결과서 검토 확인 버튼 컴포넌트 (Step 3 — 평가위원)
================================================================================
평가위원이 결과서를 확인하고 검토 확인 버튼을 클릭합니다.
전원 확인 완료 시 상태가 RESULT_REVIEW → FINAL_APPROVAL로 자동 전이됩니다.

[Props]
  asctId : 협의회ID (readonly prop 제거 — 내부에서 본인 확인 상태를 직접 조회)

[Emits]
  confirmed : 확인 완료 시 발생

[상태 흐름]
  진입 → fetchMyResultReview() = true  → 완료 UI 표시
       → fetchMyResultReview() = false → "결과서 검토 확인" 버튼 표시
                                            클릭 → reviewResult() 호출
                                                → 성공: 완료 UI + emit('confirmed')

[Design Ref: §5.4 ResultReview.vue]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'confirmed'): void;
}>();

const { reviewResult, fetchMyResultReview } = useCouncil();
const toast = useToast();

// ── 본인 결과서 확인 여부 사전 조회 ─────────────────────────────────
// 페이지 재진입 시에도 이미 완료한 위원은 완료 UI가 표시됩니다.
const { data: alreadyConfirmed, pending: loadingStatus } = fetchMyResultReview(props.asctId);

const confirming = ref(false);
/** 이번 세션에서 방금 확인 처리한 경우 true */
const justConfirmed = ref(false);

/** 완료 상태 여부 (이전 완료 또는 이번 세션 완료) */
const isDone = computed(() => alreadyConfirmed.value === true || justConfirmed.value);

/**
 * 결과서 검토 확인을 서버에 전송합니다.
 * POST /api/council/{asctId}/result/review
 * 전원 확인 완료 시 서버에서 FINAL_APPROVAL로 자동 전이합니다.
 */
const handleConfirm = async () => {
    confirming.value = true;
    try {
        await reviewResult(props.asctId);
        justConfirmed.value = true;
        toast.add({
            severity: 'success',
            summary: '확인 완료',
            detail: '결과서 검토를 확인했습니다.',
            life: 3000,
        });
        emit('confirmed');
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '처리 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        confirming.value = false;
    }
};
</script>

<template>
    <div class="p-5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-center space-y-4">

        <!-- 로딩 중 -->
        <div v-if="loadingStatus" class="flex justify-center py-2">
            <i class="pi pi-spin pi-spinner text-zinc-400 text-xl" />
        </div>

        <!-- 완료 상태 -->
        <div v-else-if="isDone" class="space-y-2">
            <i class="pi pi-check-circle text-3xl text-emerald-500"/>
            <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">결과서 검토를 완료했습니다.</p>
        </div>

        <!-- 미확인 상태 -->
        <div v-else class="space-y-3">
            <p class="text-sm text-zinc-600 dark:text-zinc-300">
                결과서 내용을 확인하셨으면 아래 버튼을 클릭해 주세요.<br>
                전원 확인 완료 시 결재 요청 단계로 전환됩니다.
            </p>
            <Button
                label="결과서 검토 확인"
                icon="pi pi-check"
                severity="success"
                :loading="confirming"
                @click="handleConfirm"
            />
        </div>

    </div>
</template>
