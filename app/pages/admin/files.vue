<!--
================================================================================
[pages/admin/files.vue] 첨부파일 조회 페이지
================================================================================
시스템관리자가 전체 첨부파일(TAAABB_CFILEM)을 조회하는 화면입니다.

[주요 기능]
  - 삭제되지 않은 전체 첨부파일 목록 조회 (조회 전용)
  - 파일구분 뱃지: 이미지(info), 첨부파일(secondary)
  - 이름 클릭: 최초등록자 직원정보 팝업

[Design Ref: §3.6 — 조회 전용 화면]
================================================================================
-->
<script setup lang="ts">
import { useAdminApi } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const { fetchFiles } = useAdminApi();

// 첨부파일 목록 (반응형)
const { data: files, pending } = await fetchFiles();

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 파일구분에 따른 Tag severity 반환
 */
const flDttSeverity = (flDtt: string): string => {
    return flDtt === '이미지' ? 'info' : 'secondary';
};
</script>

<template>
    <div>
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">첨부파일</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    TAAABB_CFILEM — 시스템 전체 첨부파일 현황 (조회 전용)
                </p>
            </div>
        </div>

        <!-- 첨부파일 DataTable -->
        <DataTable
            :value="files ?? []"
            :loading="pending"
            dataKey="flMngNo"
            scrollable
            scrollHeight="calc(100vh - 300px)"
            class="p-datatable-sm"
            stripedRows>

            <Column field="flMngNo" header="파일관리번호" :style="{ width: '130px' }" frozen />

            <Column field="orcFlNm" header="원본파일명" :style="{ width: '250px' }">
                <template #body="{ data }">
                    <span class="text-sm truncate block max-w-[240px]" :title="data.orcFlNm">
                        {{ data.orcFlNm }}
                    </span>
                </template>
            </Column>

            <Column field="flDtt" header="파일구분" :style="{ width: '100px' }">
                <template #body="{ data }">
                    <Tag :value="data.flDtt"
                         :severity="flDttSeverity(data.flDtt)" />
                </template>
            </Column>

            <Column field="orcDtt" header="원본구분" :style="{ width: '160px' }" />

            <!-- 최초등록자 클릭 → 직원정보 팝업 -->
            <Column header="등록자" :style="{ width: '120px' }">
                <template #body="{ data }">
                    <span v-if="data.fstEnrUsid"
                          class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.fstEnrUsid)">
                        {{ data.fstEnrUsNm || data.fstEnrUsid }}
                    </span>
                </template>
            </Column>

            <Column field="fstEnrDtm" header="등록시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.fstEnrDtm) }}
                </template>
            </Column>
        </DataTable>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
