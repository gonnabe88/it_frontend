<!--
================================================================================
[components/ApplicationViewerDialog.vue] 신청서 조회 PDF 뷰어 다이얼로그
================================================================================
전자결재 신청관리번호(apfMngNo)로 API에서 신청서 데이터를 조회하고
PDF를 생성하여 iframe으로 표시하는 재사용 다이얼로그 컴포넌트입니다.

[사용처]
  - pages/approval/index.vue  (신청서명 클릭 시 → apfMngNo 전달)
  - pages/budget/list.vue     (신청서 버튼 클릭 시 → apfMngNo 전달)

[동작 흐름]
  1. visible=true & apfMngNo 세팅 시 자동으로 API 호출
  2. GET /api/applications/{apfMngNo} → apfDtlCone(JSON) 파싱
  3. generateReport(projects, approvalLine, costs) → Blob URL 생성
  4. iframe으로 PDF 표시
  5. 닫을 때 Blob URL 메모리 자동 해제

[Props]
  - visible   : 다이얼로그 표시 여부 (v-model)
  - apfMngNo  : 신청관리번호 (API 조회 키)

[Emits]
  - update:visible : 다이얼로그 닫기

[핵심 패턴]
  PrimeVue Dialog는 v-model:visible로 내부 ref를 연결해야
  정상적으로 열리고 닫힙니다. props.visible을 직접 바인딩하면
  Vue의 단방향 데이터 흐름 제약으로 다이얼로그가 열리지 않습니다.
================================================================================
-->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useApprovals } from '~/composables/useApprovals';
import { usePdfReport } from '~/composables/usePdfReport';

const props = defineProps<{
    /** 다이얼로그 표시 여부 (v-model) */
    visible: boolean;
    /** 신청관리번호 (GET /api/applications/{apfMngNo}) */
    apfMngNo: string;
}>();

const emit = defineEmits<{
    /** 다이얼로그 닫기 */
    'update:visible': [value: boolean];
}>();

const { fetchApplication } = useApprovals();
const { generateReport } = usePdfReport();

/**
 * PrimeVue Dialog에 바인딩할 내부 visible ref
 * props.visible 변경을 감지하여 동기화합니다.
 * v-model:visible로 Dialog에 연결해야 열기/닫기가 정상 동작합니다.
 */
const localVisible = ref(false);

/** 생성된 PDF Blob URL (iframe src에 사용) */
const pdfUrl = ref<string | null>(null);
/** PDF 로딩 중 상태 */
const loading = ref(false);
/** 오류 메시지 */
const errorMsg = ref<string | null>(null);

/**
 * props.visible → localVisible 동기화
 * 부모에서 visible=true 로 세팅하면 다이얼로그를 열고 PDF 생성을 시작합니다.
 */
watch(
    () => props.visible,
    async (newVal) => {
        localVisible.value = newVal;

        if (!newVal) {
            /* 다이얼로그 닫힐 때 Blob URL 해제 */
            if (pdfUrl.value) {
                URL.revokeObjectURL(pdfUrl.value);
                pdfUrl.value = null;
            }
            return;
        }

        if (!props.apfMngNo) {
            errorMsg.value = '신청관리번호가 없습니다.';
            return;
        }

        /* 상태 초기화 */
        loading.value = true;
        pdfUrl.value = null;
        errorMsg.value = null;

        try {
            /* GET /api/applications/{apfMngNo} 조회 */
            const approval = await fetchApplication(props.apfMngNo);

            if (!approval?.apfDtlCone) {
                errorMsg.value = '신청서 상세 내용이 없습니다.';
                return;
            }

            /**
             * apfDtlCone: { projects?: ProjectDetail[], costs?: ItCost[], approvalLine: ApprovalLine } JSON 문자열
             * generateReport(projects, approvalLine, costs) 에 전달하여 PDF 생성
             */
            const detail = JSON.parse(approval.apfDtlCone);
            const url = await generateReport(
                detail.projects || [],
                detail.approvalLine,
                detail.costs || []
            );
            pdfUrl.value = url;
        } catch (e) {
            console.error('신청서 PDF 생성 실패:', e);
            errorMsg.value = '보고서를 생성할 수 없습니다.';
        } finally {
            loading.value = false;
        }
    }
);

/**
 * localVisible → 부모로 emit
 * 다이얼로그 내부(X 버튼, 배경 클릭 등)로 닫힐 때 부모 상태를 동기화합니다.
 */
watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
});
</script>

<template>
    <Dialog v-model:visible="localVisible" header="신청서 조회" modal maximizable
        class="w-[90vw] h-[90vh]" :style="{ maxWidth: '1000px' }">

        <div class="w-full h-[80vh] flex items-center justify-center bg-zinc-50 dark:bg-zinc-800">

            <!-- 로딩 상태 -->
            <div v-if="loading" class="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
                <i class="pi pi-spin pi-spinner text-4xl"></i>
                <span class="text-sm">신청서를 불러오는 중...</span>
            </div>

            <!-- 오류 상태 -->
            <div v-else-if="errorMsg"
                class="flex flex-col items-center gap-3 text-red-500 dark:text-red-400">
                <i class="pi pi-exclamation-triangle text-4xl"></i>
                <span class="text-sm">{{ errorMsg }}</span>
            </div>

            <!-- PDF iframe -->
            <iframe v-else-if="pdfUrl" :src="pdfUrl" class="w-full h-full border-none"></iframe>

            <!-- 초기 빈 상태 -->
            <div v-else class="text-zinc-400 text-sm">
                신청서 데이터가 없습니다.
            </div>

        </div>
    </Dialog>
</template>
