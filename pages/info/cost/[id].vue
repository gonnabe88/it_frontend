<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useCost } from '~/composables/useCost';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchCost, deleteCost } = useCost();

const id = route.params.id as string;
const title = '전산업무비 상세';
definePageMeta({
    title
});

const { data: cost, error } = await fetchCost(id);

const goBack = () => {
    router.push('/info/cost');
};

const goEdit = () => {
    router.push(`/info/cost/form?id=${id}`);
};

const confirmDelete = () => {
    confirm.require({
        message: '정말로 삭제하시겠습니까?',
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteCost(id);
                router.push('/info/cost');
            } catch (e) {
                console.error('Delete failed', e);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    });
};

// 숫자 포맷팅
const formatNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString('ko-KR');
};

</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex gap-2">
                <Button label="목록" icon="pi pi-list" severity="secondary" @click="goBack" />
                <Button label="수정" icon="pi pi-pencil" severity="info" @click="goEdit" />
                <Button label="삭제" icon="pi pi-trash" severity="danger" @click="confirmDelete" />
            </div>
        </div>

        <div v-if="error"
            class="p-4 text-red-500 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
        </div>

        <div v-else-if="cost"
            class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">

            <!-- 기본 정보 -->
            <div class="space-y-4">
                <h3 class="text-lg font-semibold border-b pb-2 border-zinc-200 dark:border-zinc-700">기본 정보</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">관리번호</span>
                        <span class="font-medium">{{ cost.itMngcNo }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">비목명</span>
                        <span class="font-medium">{{ cost.ioeNm }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">계약명</span>
                        <span class="font-medium">{{ cost.cttNm }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">계약구분</span>
                        <span class="font-medium">{{ cost.cttTp }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">계약상대처</span>
                        <span class="font-medium">{{ cost.cttOpp }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">추진담당자</span>
                        <span class="font-medium">{{ cost.pulCgpr }}</span>
                    </div>
                </div>
            </div>

            <!-- 예산 및 지급 정보 -->
            <div class="space-y-4">
                <h3 class="text-lg font-semibold border-b pb-2 border-zinc-200 dark:border-zinc-700">예산 및 지급 정보</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">전산업무비예산</span>
                        <span class="font-medium">{{ formatNumber(cost.itMngcBg) }} {{ cost.cur }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">지급주기</span>
                        <span class="font-medium">{{ cost.dfrCle }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">최초지급일자</span>
                        <span class="font-medium">{{ cost.fstDfrDt }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">통화</span>
                        <span class="font-medium">{{ cost.cur }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">환율</span>
                        <span class="font-medium">{{ formatNumber(cost.xcr) }} (기준일: {{ cost.xcrBseDt }})</span>
                    </div>
                </div>
            </div>

            <!-- 기타 정보 -->
            <div class="space-y-4">
                <h3 class="text-lg font-semibold border-b pb-2 border-zinc-200 dark:border-zinc-700">기타 정보</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">정보보호여부</span>
                        <span class="font-medium">{{ cost.infPrtYn }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">증감사유</span>
                        <span class="font-medium">{{ cost.indRsn }}</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>
