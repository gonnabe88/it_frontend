<!--
================================================================================
[components/council/result/ResultReview.vue]
결과서 검토 확인 버튼 컴포넌트 (Step 3 — 평가위원)
================================================================================
평가위원이 결과서를 확인하고 동의 버튼을 클릭합니다.
전원 확인 완료 시 상태가 RESULT_REVIEW → FINAL_APPROVAL로 전이됩니다.

[Props]
  asctId   : 협의회ID
  readonly : 이미 확인 완료된 경우 true

[Emits]
  confirmed : 확인 완료 시 발생

[Design Ref: §4.4 result/[id].vue — 평가위원 결과서 확인 버튼]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'confirmed'): void;
}>();

const { confirmResult } = useCouncil();
const toast = useToast();

const confirming = ref(false);
const confirmed = ref(false);

/**
 * 결과서 검토 확인을 서버에 전송합니다.
 * PUT /api/council/{asctId}/result/confirm
 */
const handleConfirm = async () => {
    confirming.value = true;
    try {
        await confirmResult(props.asctId);
        confirmed.value = true;
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

        <div v-if="readonly || confirmed" class="space-y-2">
            <i class="pi pi-check-circle text-3xl text-emerald-500"/>
            <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">결과서 검토를 완료했습니다.</p>
        </div>

        <div v-else class="space-y-3">
            <p class="text-sm text-zinc-600 dark:text-zinc-300">
                결과서 내용을 확인하셨으면 아래 버튼을 클릭해 주세요.<br>
                전원 확인 완료 시 결과보고 결재가 진행됩니다.
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
