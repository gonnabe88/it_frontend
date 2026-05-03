<!--
================================================================================
[pages/admin/tokens.vue] JWT 갱신토큰 조회 페이지
================================================================================
시스템관리자가 JWT 갱신토큰(TAAABB_CRTOKM)을 조회하는 화면입니다.

[주요 기능]
  - 전체 갱신토큰 목록 조회 (조회 전용, 수정·삭제 없음)
  - 토큰값은 보안상 앞 20자 + "..." 마스킹 표시
  - 만료 여부 시각화 (현재 시각 기준)
  - 이름 클릭: 직원정보 팝업

[Design Ref: §3.6 — 조회 전용 화면, §6.3 — JWT 토큰 마스킹]
================================================================================
-->
<script setup lang="ts">
import { useAdminApi } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import { exportRowsToExcel } from '~/utils/excel';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const { fetchTokens } = useAdminApi();

// 토큰 목록 (반응형)
const { data: tokens, pending } = await fetchTokens();

// 통합검색어
const search = ref('');

// 검색 필터링된 토큰 목록
const filteredTokens = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return tokens.value ?? [];
    return (tokens.value ?? []).filter(t =>
        [t.eno, t.usrNm, t.tokMasked]
            .some(v => v?.toLowerCase().includes(q))
    );
});

// 엑셀 다운로드
const downloadExcel = async () => {
    const rows = filteredTokens.value.map(t => ({
        '사용자명': t.usrNm,
        '사원번호': t.eno,
        '토큰(마스킹)': t.tokMasked,
        '만료일시': t.endDtm,
        '상태': isExpired(t.endDtm) ? '만료' : '유효',
        '발급시간': t.fstEnrDtm,
    }));
    await exportRowsToExcel(rows, 'JWT갱신토큰', `JWT갱신토큰_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 토큰 만료 여부 확인 (현재 시각 기준)
 */
const isExpired = (endDtm: string): boolean => {
    if (!endDtm) return true;
    return new Date(endDtm) < new Date();
};
</script>

<template>
    <div class="flex flex-col h-full gap-6">
        <!-- 페이지 헤더 -->
        <PageHeader title="JWT 갱신토큰" subtitle="TAAABB_CRTOKM — 사용자별 Refresh Token 현황 (조회 전용)" />

        <!-- 토큰 DataTable -->
        <TableCard fill icon="pi-key" title="JWT 갱신토큰 목록" :count="filteredTokens.length">

            <template #toolbar>
                <TableSearchInput v-model="search" placeholder="사원번호, 사용자명 검색..." width="30rem" />
                <div class="flex-1" />
                <button
                    class="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    @click="downloadExcel">
                    <i class="pi pi-file-excel text-xs" style="color:#16a34a;" />
                    Excel
                </button>
            </template>

        <div class="flex-1 min-h-0 flex flex-col">
        <StyledDataTable
            :value="filteredTokens"
            :loading="pending"
            data-key="tokMasked"
            scrollable
            scroll-height="flex"
            class="p-datatable-sm"
            striped-rows>

            <!-- 사용자명 클릭 → 직원정보 팝업 -->
            <Column header="사용자" :style="{ width: '130px' }">
                <template #body="{ data }">
                    <span
class="cursor-pointer text-indigo-600 hover:underline"
                          @click="showEmployeeDialog(data.eno)">
                        {{ data.usrNm || data.eno }}
                    </span>
                </template>
            </Column>

            <Column field="eno" header="사원번호" :style="{ width: '110px' }" />

            <Column field="tokMasked" header="토큰 (마스킹)" :style="{ width: '220px' }">
                <template #body="{ data }">
                    <code class="text-xs text-zinc-500 dark:text-zinc-400">{{ data.tokMasked }}</code>
                </template>
            </Column>

            <Column field="endDtm" header="만료일시" :style="{ width: '160px' }">
                <template #body="{ data }">
                    <span :class="isExpired(data.endDtm) ? 'text-red-500' : 'text-green-600'">
                        {{ formatDateTime(data.endDtm) }}
                    </span>
                </template>
            </Column>

            <Column header="상태" :style="{ width: '90px' }">
                <template #body="{ data }">
                    <Tag
:value="isExpired(data.endDtm) ? '만료' : '유효'"
                         :severity="isExpired(data.endDtm) ? 'danger' : 'success'" />
                </template>
            </Column>

            <Column field="fstEnrDtm" header="발급시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.fstEnrDtm) }}
                </template>
            </Column>
        </StyledDataTable>
        </div>
        </TableCard>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
