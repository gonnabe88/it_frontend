<!--
================================================================================
[pages/info/cost/[id].vue] 전산업무비 상세 페이지
================================================================================
URL 파라미터(id = itMngcNo)로 특정 전산업무비 항목의 상세 정보를 표시합니다.
수정 및 삭제 기능을 제공하며, 삭제 시 확인 다이얼로그를 표시합니다.

[라우팅]
  - 접근: /info/cost/:id
  - 목록 이동: /info/cost
  - 수정 이동: /info/cost/form?id=:id

[UI 구성]
  - 기본 정보: 관리번호, 비목명, 계약명, 계약구분, 계약상대처, 담당자
  - 예산 및 지급 정보: 예산, 지급주기, 최초지급일, 통화, 환율
  - 기타 정보: 정보보호여부, 증감사유
================================================================================
-->
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useCost } from '~/composables/useCost';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchCost, deleteCost } = useCost();

/* URL 파라미터에서 전산업무비 관리번호 추출 */
const id = route.params.id as string;
const title = '전산업무비 상세';
definePageMeta({
    title
});

/* 전산업무비 상세 데이터 조회 */
const { data: cost, error } = await fetchCost(id);

/**
 * 목록 페이지로 이동
 */
const goBack = () => {
    router.push('/info/cost');
};

/**
 * 수정 폼 페이지로 이동
 * 쿼리 파라미터로 현재 항목의 id를 전달합니다.
 */
const goEdit = () => {
    router.push(`/info/cost/form?id=${id}`);
};

/**
 * 삭제 확인 다이얼로그 표시 및 처리
 * 사용자가 '삭제'를 클릭하면 deleteCost() API를 호출합니다.
 * 성공 시 목록 페이지로 이동, 실패 시 에러 알림을 표시합니다.
 */
const confirmDelete = () => {
    confirm.require({
        message: '정말로 삭제하시겠습니까?',
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        acceptClass: 'p-button-danger', // 삭제 버튼 빨간색 강조
        accept: async () => {
            try {
                await deleteCost(id);
                router.push('/info/cost'); // 삭제 성공 후 목록으로 이동
            } catch (e) {
                console.error('Delete failed', e);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    });
};

/**
 * 숫자를 한국어 통화 형식으로 포맷팅
 * undefined/null은 '-'로 표시합니다.
 *
 * @param value - 포맷팅할 숫자
 * @returns 천 단위 구분자가 적용된 문자열 또는 '-'
 */
const formatNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString('ko-KR');
};
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더: 제목 + 액션 버튼 그룹 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex gap-2">
                <Button label="목록" icon="pi pi-list" severity="secondary" @click="goBack" />
                <Button label="수정" icon="pi pi-pencil" severity="info" @click="goEdit" />
                <Button label="삭제" icon="pi pi-trash" severity="danger" @click="confirmDelete" />
            </div>
        </div>

        <!-- API 오류 표시 -->
        <div v-if="error"
            class="p-4 text-red-500 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
        </div>

        <!-- 상세 정보 카드 (데이터 존재 시) -->
        <div v-else-if="cost"
            class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">

            <!-- 섹션 1: 기본 정보 -->
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

            <!-- 섹션 2: 예산 및 지급 정보 -->
            <div class="space-y-4">
                <h3 class="text-lg font-semibold border-b pb-2 border-zinc-200 dark:border-zinc-700">예산 및 지급 정보</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-zinc-500">전산업무비예산</span>
                        <!-- 통화 단위 함께 표시 -->
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
                        <!-- 환율 및 기준일을 함께 표시 -->
                        <span class="font-medium">{{ formatNumber(cost.xcr) }} (기준일: {{ cost.xcrBseDt }})</span>
                    </div>
                </div>
            </div>

            <!-- 섹션 3: 기타 정보 -->
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
