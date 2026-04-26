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
import StyledDataTable from '~/components/common/StyledDataTable.vue';

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
    <div class="flex flex-col h-full gap-6">
        <!-- 페이지 헤더 -->
        <PageHeader title="첨부파일" subtitle="TAAABB_CFILEM — 시스템 전체 첨부파일 현황 (조회 전용)" />

        <!-- 첨부파일 DataTable -->
        <TableCard fill>
        <div class="flex-1 min-h-0 flex flex-col">
        <StyledDataTable
            :value="files ?? []"
            :loading="pending"
            data-key="flMngNo"
            scrollable
            scroll-height="flex"
            class="p-datatable-sm"
            striped-rows>

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
                    <Tag
                        :value="data.flDtt"
                        :severity="flDttSeverity(data.flDtt)" />
                </template>
            </Column>

            <Column field="orcDtt" header="원본구분" :style="{ width: '160px' }" />

            <!-- 최초등록자 클릭 → 직원정보 팝업 -->
            <Column header="등록자" :style="{ width: '120px' }">
                <template #body="{ data }">
                    <span
v-if="data.fstEnrUsid"
                          class="cursor-pointer text-indigo-600 hover:underline"
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
        </StyledDataTable>
        </div>
        </TableCard>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
