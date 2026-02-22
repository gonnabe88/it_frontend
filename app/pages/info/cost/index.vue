<!--
================================================================================
[pages/info/cost/index.vue] 전산업무비 목록 페이지
================================================================================
IT 관리비(전산업무비) 항목의 전체 목록을 표시하는 페이지입니다.

[주요 기능]
  - 전산업무비 목록 조회 (DataTable 표시)
  - 예산 단위 전환 (원 / 천원 / 백만원 / 억원, SelectButton)
  - 관리번호 클릭 → 상세 페이지(/info/cost/:id) 이동
  - 일괄 수정: 현재 로그인한 사용자(eno)가 담당자인 항목만 필터링하여 수정 폼으로 이동
  - 신규 등록: 전산업무비 등록 폼(/info/cost/form)으로 이동

[일괄 수정 로직]
  - 현재 사용자(user.eno)와 pulCgpr(담당자 사원번호)이 일치하는 항목만 대상
  - 해당 항목의 itMngcNo를 쉼표로 연결하여 쿼리 파라미터(?ids=)로 전달
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCost, type ItCost } from '~/composables/useCost';
import { useAuth } from '~/composables/useAuth';
import { useRouter } from 'vue-router';
import { formatBudget as formatBudgetUtil } from '~/utils/common';

/* 페이지 탭 제목 설정 */
const title = '전산업무비 목록';
definePageMeta({
    title
});

/* 전산업무비 목록 데이터 가져오기 */
const { fetchCosts } = useCost();
const { user } = useAuth();
const router = useRouter();
const { data: costsData, error } = await fetchCosts();

/** 전산업무비 목록 (null 안전 처리) */
const costs = computed(() => costsData.value || []);

/** 체크박스 선택된 항목 목록 (다중 선택) */
const selectedCosts = ref<ItCost[]>([]);

/* ── 예산 단위 변환 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원'); // 기본 표시 단위

/**
 * 예산 금액을 선택된 단위로 변환하여 반환
 *
 * @param amount - 변환할 원(KRW) 단위 숫자
 * @returns 단위 변환 후 포맷팅된 문자열
 */
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);

/**
 * 일괄 수정 처리
 * 현재 로그인한 사용자가 담당자인 전산업무비 항목만 필터링하여
 * 수정 폼으로 이동합니다.
 * 담당 건이 없으면 알림 후 종료합니다.
 */
const handleBulkEdit = () => {
    if (!user.value || !user.value.eno) {
        alert('로그인 정보가 없습니다.');
        return;
    }

    // pulCgpr(담당자 사원번호)이 현재 사용자와 일치하는 항목만 추출
    const myCosts = costs.value.filter(cost => cost.pulCgpr === user.value?.eno);

    if (myCosts.length === 0) {
        alert('수정할 대상이 없습니다. (본인 담당 건 없음)');
        return;
    }

    // 관리번호를 쉼표로 연결하여 폼 페이지에 전달 (?ids=id1,id2,...)
    const ids = myCosts.map(cost => cost.itMngcNo).filter(id => id).join(',');
    router.push({ path: '/info/cost/form', query: { ids } });
};

/**
 * 전산업무비 목록 필터링 (현재는 전체 표시, 향후 검색 기능 확장 예정)
 */
const filteredCosts = computed(() => {
    return costs.value;
});
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더: 제목 + 예산 단위 선택 + 액션 버튼 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-4">
                <!-- 예산 표시 단위 선택 (원/천원/백만원/억원) -->
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="basic" />
                <!-- 본인 담당 항목 일괄 수정 -->
                <Button label="일괄 수정" icon="pi pi-pencil" severity="info" @click="handleBulkEdit" />
                <!-- 신규 전산업무비 등록 -->
                <Button label="전산업무비 등록" icon="pi pi-plus" @click="navigateTo('/info/cost/form')" />
            </div>
        </div>

        <!-- 데이터 테이블 영역 -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">

            <!-- API 오류 표시 -->
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>

            <!-- 전산업무비 목록 테이블 -->
            <DataTable v-else :value="filteredCosts" paginator :rows="10" v-model:selection="selectedCosts"
                sortField="itMngcNo" :sortOrder="-1" dataKey="itMngcNo" tableStyle="min-width: 50rem" :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }">
                <!-- 다중 선택 체크박스 -->
                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

                <!-- 관리번호: 클릭 시 상세 페이지로 이동 -->
                <Column field="itMngcNo" header="관리번호" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <NuxtLink :to="`/info/cost/${slotProps.data.itMngcNo}`"
                            class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                            {{ slotProps.data.itMngcNo }}
                        </NuxtLink>
                    </template>
                </Column>
                <Column field="ioeNm" header="비목명" sortable></Column>
                <Column field="cttNm" header="계약명" sortable></Column>
                <Column field="cttOpp" header="계약상대처" sortable></Column>

                <!-- 예산: 선택된 단위로 변환하여 표시 -->
                <Column field="itMngcBg" :header="`예산 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.itMngcBg) }} {{ selectedUnit }}</span>
                    </template>
                </Column>
                <Column field="dfrCle" header="지급주기" sortable></Column>
                <Column field="pulCgpr" header="담당자" sortable></Column>

                <!-- 상세 조회 버튼 -->
                <Column style="width: 10%">
                    <template #body>
                        <Button icon="pi pi-search" text rounded aria-label="Search" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
