<!--
================================================================================
[pages/info/plan/[id].vue] 정보기술부문 계획 상세 페이지
================================================================================
계획 조회 화면에서 계획 선택 시 상세 정보를 표시합니다.

[표시 내용]
  - 기본 정보 (계획관리번호, 대상년도, 계획구분, 등록일, 등록자)
  - 예산 총계 (총예산, 자본예산, 일반관리비) - PLN_DTL_CONE JSON 파싱
  - 부문(SVN_HDQ)별 사업목록 - PLN_DTL_CONE JSON 파싱
  - 사업유형(PRJ_TP)별 사업목록 - PLN_DTL_CONE JSON 파싱
  - [삭제] 버튼 (논리 삭제 후 목록 이동)

[데이터 기준]
  TAAABB_BPLANM.PLN_DTL_CONE(계획세부내용) JSON을 파싱하여 화면에 표시합니다.
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onActivated } from 'vue';
import { usePlan, type PlanSnapshot } from '~/composables/usePlan';
import { formatBudget as formatBudgetUtil } from '~/utils/common';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

/* 페이지 탭 제목 설정 */
const title = '정보기술부문 계획 상세';
definePageMeta({ title });

const route = useRoute();
const router = useRouter();
const { fetchPlan, deletePlan } = usePlan();

/** URL 파라미터에서 계획관리번호 추출 */
const plnMngNo = route.params.id as string;

/* 계획 상세 데이터 조회 */
const { data: planData, error, pending, refresh: refreshPlan } = await fetchPlan(plnMngNo);

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(() => refreshPlan());

/* ── 공통코드 코드명 변환 ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP');

/* ── 예산 단위 선택 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');

/**
 * 예산 금액을 선택된 단위로 변환하여 반환
 */
const formatBudget = (amount: number | undefined | null) => {
    if (amount == null) return '-';
    return formatBudgetUtil(amount, selectedUnit.value);
};

/**
 * 날짜 문자열을 YYYY-MM-DD 형태로 표시
 */
const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return dateStr.substring(0, 10);
};

/**
 * PLN_DTL_CONE JSON 파싱 결과
 * null이면 파싱 실패 또는 데이터 없음
 */
const snapshot = computed<PlanSnapshot | null>(() => {
    if (!planData.value?.plnDtlCone) return null;
    try {
        return JSON.parse(planData.value.plnDtlCone) as PlanSnapshot;
    } catch {
        console.error('PLN_DTL_CONE JSON 파싱 실패');
        return null;
    }
});

/* ── 삭제 처리 ── */
const deleting = ref(false);

/**
 * [삭제] 버튼 클릭 핸들러
 * 논리 삭제 처리 후 목록 페이지로 이동합니다.
 */
const handleDelete = async () => {
    if (!confirm(`계획 [${plnMngNo}]을(를) 삭제하시겠습니까?`)) return;

    deleting.value = true;
    try {
        await deletePlan(plnMngNo);
        alert('삭제되었습니다.');
        if (window.history.length > 1) { router.back(); } else { router.push('/info/plan'); }
    } catch (e) {
        console.error('계획 삭제 실패:', e);
        alert('삭제 중 오류가 발생했습니다.');
    } finally {
        deleting.value = false;
    }
};
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between gap-4 flex-wrap">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-3">
                <!-- 예산 표시 단위 선택 -->
                <SelectButton v-model="selectedUnit" :options="units" />
                <!-- 목록으로 이동 -->
                <Button
                    label="목록"
                    icon="pi pi-list"
                    severity="secondary"
                    outlined
                    @click="router.back()"
                />
                <!-- 삭제 버튼 -->
                <Button
                    label="삭제"
                    icon="pi pi-trash"
                    severity="danger"
                    :loading="deleting"
                    @click="handleDelete"
                />
            </div>
        </div>

        <!-- 로딩 -->
        <div v-if="pending" class="flex items-center justify-center py-16 text-zinc-500">
            <i class="pi pi-spin pi-spinner text-2xl mr-3" />
            데이터를 불러오는 중...
        </div>

        <!-- 오류 -->
        <div v-else-if="error" class="p-6 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl">
            데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
        </div>

        <template v-else-if="planData">

            <!-- ① 기본 정보 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2 mb-4">기본 정보</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <div class="text-xs text-zinc-500 mb-1">계획관리번호</div>
                        <div class="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {{ planData.plnMngNo }}
                        </div>
                    </div>
                    <div>
                        <div class="text-xs text-zinc-500 mb-1">대상년도</div>
                        <div class="font-semibold">{{ planData.plnYy }}년</div>
                    </div>
                    <div>
                        <div class="text-xs text-zinc-500 mb-1">계획구분</div>
                        <Tag
                            :value="planData.plnTp"
                            :severity="planData.plnTp === '신규' ? 'success' : 'warn'"
                        />
                    </div>
                    <div>
                        <div class="text-xs text-zinc-500 mb-1">등록일</div>
                        <div>{{ formatDate(planData.fstEnrDtm) }}</div>
                    </div>
                    <div>
                        <div class="text-xs text-zinc-500 mb-1">등록자</div>
                        <div>{{ planData.fstEnrUsid || '-' }}</div>
                    </div>
                    <div>
                        <div class="text-xs text-zinc-500 mb-1">대상사업 수</div>
                        <div>{{ planData.prjMngNos?.length || 0 }}건</div>
                    </div>
                </div>
            </div>

            <!-- ② 예산 총계 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">예산 총계</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- 총예산 -->
                    <div class="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-indigo-600 dark:text-indigo-300 font-medium mb-1">총예산</div>
                        <div class="text-2xl font-bold text-indigo-700 dark:text-indigo-200 tabular-nums">
                            {{ formatBudget(planData.ttlBg) }}
                        </div>
                        <div class="text-xs text-indigo-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                    <!-- 자본예산 -->
                    <div class="bg-sky-50 dark:bg-sky-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-sky-600 dark:text-sky-300 font-medium mb-1">자본예산</div>
                        <div class="text-2xl font-bold text-sky-700 dark:text-sky-200 tabular-nums">
                            {{ formatBudget(planData.cptBg) }}
                        </div>
                        <div class="text-xs text-sky-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                    <!-- 일반관리비 -->
                    <div class="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-emerald-600 dark:text-emerald-300 font-medium mb-1">일반관리비</div>
                        <div class="text-2xl font-bold text-emerald-700 dark:text-emerald-200 tabular-nums">
                            {{ formatBudget(planData.mngc) }}
                        </div>
                        <div class="text-xs text-emerald-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                </div>
            </div>

            <!-- JSON 파싱 실패 안내 -->
            <div v-if="!snapshot" class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-700 dark:text-yellow-300 text-sm">
                계획 세부내용 데이터를 파싱할 수 없습니다. (PLN_DTL_CONE 형식 오류)
            </div>

            <template v-else>

                <!-- ③ 부문(SVN_HDQ)별 사업목록 -->
                <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">부문별 사업목록</h2>
                    <div
                        v-for="dept in snapshot.byDepartment"
                        :key="dept.svnHdq"
                        class="space-y-2"
                    >
                        <div class="flex items-center gap-2">
                            <Tag :value="dept.svnHdq" severity="info" />
                            <span class="text-sm text-zinc-500">{{ dept.projects.length }}건</span>
                        </div>
                        <StyledDataTable
                            :value="dept.projects"
                            dataKey="prjMngNo"
                        >
                            <Column field="prjNm" header="사업명" />
                            <Column field="prjTp" header="사업유형" style="width: 8rem">
                                <template #body="slotProps">{{ getPrjTpName(slotProps.data.prjTp) }}</template>
                            </Column>
                            <Column field="svnDpmNm" header="주관부서" style="width: 10rem" />
                            <Column field="prjBg" :header="`총예산 (${selectedUnit})`" style="width: 10rem">
                                <template #body="slotProps">
                                    <span class="tabular-nums">{{ formatBudget(slotProps.data.prjBg) }}</span>
                                </template>
                            </Column>
                            <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" style="width: 10rem">
                                <template #body="slotProps">
                                    <span class="tabular-nums">{{ formatBudget(slotProps.data.assetBg) }}</span>
                                </template>
                            </Column>
                            <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" style="width: 10rem">
                                <template #body="slotProps">
                                    <span class="tabular-nums">{{ formatBudget(slotProps.data.costBg) }}</span>
                                </template>
                            </Column>
                        </StyledDataTable>
                    </div>
                </div>

                <!-- ④ 사업유형(PRJ_TP)별 사업목록 -->
                <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">사업유형별 사업목록</h2>
                    <div
                        v-for="typeGroup in snapshot.byProjectType"
                        :key="typeGroup.prjTp"
                        class="space-y-2"
                    >
                        <div class="flex items-center gap-2">
                            <Tag :value="getPrjTpName(typeGroup.prjTp)" severity="secondary" />
                            <span class="text-sm text-zinc-500">{{ typeGroup.projects.length }}건</span>
                        </div>
                        <StyledDataTable
                            :value="typeGroup.projects"
                            dataKey="prjMngNo"
                        >
                            <Column field="prjNm" header="사업명" />
                            <Column field="svnHdq" header="주관부문" style="width: 10rem" />
                            <Column field="svnDpmNm" header="주관부서" style="width: 10rem" />
                            <Column field="prjBg" :header="`총예산 (${selectedUnit})`" style="width: 10rem">
                                <template #body="slotProps">
                                    <span class="tabular-nums">{{ formatBudget(slotProps.data.prjBg) }}</span>
                                </template>
                            </Column>
                            <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" style="width: 10rem">
                                <template #body="slotProps">
                                    <span class="tabular-nums">{{ formatBudget(slotProps.data.assetBg) }}</span>
                                </template>
                            </Column>
                            <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" style="width: 10rem">
                                <template #body="slotProps">
                                    <span class="tabular-nums">{{ formatBudget(slotProps.data.costBg) }}</span>
                                </template>
                            </Column>
                        </StyledDataTable>
                    </div>
                </div>

            </template>
        </template>
    </div>
</template>
