<!--
================================================================================
[pages/info/plan/form.vue] 정보기술부문 계획 등록 페이지
================================================================================
연도별 IT 부문 계획을 등록하는 화면입니다.

[업무 흐름]
  1. 대상년도(YYYY) 입력
  2. 계획구분(신규/조정) 선택
  3. 해당 연도의 정보화사업 목록 조회 후 체크박스로 다중 선택
  4. [생성] 버튼 클릭 → 선택된 사업들의 예산 총계, 부문별/사업유형별 목록 미리보기 표시
  5. [저장] 버튼 클릭 → BPLANM + BPROJA 저장, 목록 페이지로 이동

[데이터 흐름]
  - 사업 목록: fetchProjects({ bgYy }) → 연도 필터 조회
  - 선택 사업 상세: fetchProjectsBulk(selectedIds) → 예산 집계용
  - 저장: createPlan({ plnYy, plnTp, prjMngNos })
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjects, type Project } from '~/composables/useProjects';
import { usePlan, type PlanProjectItem } from '~/composables/usePlan';
import { formatBudget as formatBudgetUtil } from '~/utils/common';

/* 페이지 탭 제목 설정 */
const title = '정보기술부문 계획 등록';
definePageMeta({ title });

const { fetchProjectsBulk } = useProjects();
const { createPlan } = usePlan();
const router = useRouter();
const { removeTab } = useTabs();
const config = useRuntimeConfig();
const { $apiFetch } = useNuxtApp();

/* ── 입력 폼 상태 ── */
/** 대상년도 (YYYY 형식) */
const plnYy = ref<string>(String(new Date().getFullYear()));

/** 계획구분 옵션 */
const plnTpOptions = ['신규', '조정'];
const plnTp = ref<string>('신규');

/* ── 공통코드 코드명 변환 ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP');

/* ── 사업 목록 조회 상태 ── */
/** 조회된 사업 목록 */
const projects = ref<Project[]>([]);

/** 사업 목록 조회 중 여부 */
const projectsPending = ref(false);

/** 조회 완료 여부 (최초 조회 전에는 안내 문구 표시) */
const searched = ref(false);

/** 체크박스로 선택된 사업 목록 */
const selectedProjects = ref<Project[]>([]);

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

/* ── 미리보기 (생성 버튼 클릭 후) ── */
/** 미리보기 표시 여부 */
const previewVisible = ref(false);

/**
 * [조회] 버튼 클릭 핸들러
 * 입력된 대상년도로 정보화사업 목록을 조회합니다.
 */
const handleSearch = async () => {
    if (!plnYy.value || plnYy.value.length !== 4) {
        alert('대상년도를 올바르게 입력해주세요. (예: 2026)');
        return;
    }

    // 이전 선택 및 미리보기 초기화
    selectedProjects.value = [];
    previewVisible.value = false;

    projectsPending.value = true;
    try {
        const result = await $apiFetch<Project[]>(
            `${config.public.apiBase}/api/projects`,
            { query: { bgYy: plnYy.value } }
        );
        projects.value = result || [];
        searched.value = true;
    } catch (e) {
        console.error('사업 목록 조회 실패:', e);
        alert('사업 목록 조회 중 오류가 발생했습니다.');
    } finally {
        projectsPending.value = false;
    }
};

/** 예산 총계 */
const totalBudget = ref({ ttlBg: 0, cptBg: 0, mngc: 0 });

/** 부문(SVN_HDQ)별 그룹 */
const byDepartment = ref<{ svnHdq: string; projects: PlanProjectItem[] }[]>([]);

/** 사업유형(PRJ_TP)별 그룹 */
const byProjectType = ref<{ prjTp: string; projects: PlanProjectItem[] }[]>([]);

/** 생성 처리 중 여부 */
const generating = ref(false);

/**
 * [생성] 버튼 클릭 핸들러
 * 선택된 사업들의 상세 정보를 조회하여 예산 총계 및 그룹핑 미리보기를 표시합니다.
 */
const handleGenerate = async () => {
    if (selectedProjects.value.length === 0) {
        alert('대상사업을 1개 이상 선택해주세요.');
        return;
    }

    generating.value = true;
    try {
        // 선택된 사업들의 상세 정보 일괄 조회
        const prjMngNos = selectedProjects.value.map(p => p.prjMngNo);
        const details = await fetchProjectsBulk(prjMngNos);

        // 예산 총계 계산
        totalBudget.value = {
            ttlBg: details.reduce((sum, p) => sum + (p.prjBg || 0), 0),
            cptBg: details.reduce((sum, p) => sum + (p.assetBg || 0), 0),
            mngc: details.reduce((sum, p) => sum + (p.costBg || 0), 0),
        };

        // 프로젝트 스냅샷 변환
        const snapshots: PlanProjectItem[] = details.map(p => ({
            prjMngNo: p.prjMngNo,
            prjNm: p.prjNm,
            prjTp: p.prjTp,
            svnHdq: p.svnHdq || '미분류',
            svnDpm: p.svnDpm,
            svnDpmNm: p.svnDpmNm || '',
            prjBg: p.prjBg || 0,
            assetBg: p.assetBg || 0,
            costBg: p.costBg || 0,
        }));

        // 부문(SVN_HDQ)별 그룹핑
        const deptMap = new Map<string, PlanProjectItem[]>();
        for (const s of snapshots) {
            const key = s.svnHdq || '미분류';
            if (!deptMap.has(key)) deptMap.set(key, []);
            deptMap.get(key)!.push(s);
        }
        byDepartment.value = Array.from(deptMap.entries()).map(([svnHdq, projs]) => ({ svnHdq, projects: projs }));

        // 사업유형(PRJ_TP)별 그룹핑
        const typeMap = new Map<string, PlanProjectItem[]>();
        for (const s of snapshots) {
            const key = s.prjTp || '미분류';
            if (!typeMap.has(key)) typeMap.set(key, []);
            typeMap.get(key)!.push(s);
        }
        byProjectType.value = Array.from(typeMap.entries()).map(([prjTp, projs]) => ({ prjTp, projects: projs }));

        previewVisible.value = true;
    } catch (e) {
        console.error('사업 상세 조회 실패:', e);
        alert('사업 정보 조회 중 오류가 발생했습니다.');
    } finally {
        generating.value = false;
    }
};

/* ── 저장 처리 ── */
/** 저장 처리 중 여부 */
const saving = ref(false);

/**
 * [저장] 버튼 클릭 핸들러
 * 계획 정보와 대상 프로젝트 목록을 백엔드에 저장합니다.
 */
const handleSave = async () => {
    if (!plnYy.value || plnYy.value.length !== 4) {
        alert('대상년도를 올바르게 입력해주세요. (예: 2026)');
        return;
    }
    if (!plnTp.value) {
        alert('계획구분을 선택해주세요.');
        return;
    }
    if (selectedProjects.value.length === 0) {
        alert('대상사업을 1개 이상 선택해주세요.');
        return;
    }
    if (!previewVisible.value) {
        alert('[생성] 버튼을 먼저 클릭하여 미리보기를 확인해주세요.');
        return;
    }

    saving.value = true;
    try {
        await createPlan({
            plnYy: plnYy.value,
            plnTp: plnTp.value,
            prjMngNos: selectedProjects.value.map(p => p.prjMngNo),
        });
        alert('계획이 등록되었습니다.');
        await router.push('/info/plan');
        removeTab('/info/plan/form');
    } catch (e) {
        console.error('계획 저장 실패:', e);
        alert('계획 저장 중 오류가 발생했습니다.');
    } finally {
        saving.value = false;
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
                <!-- 뒤로가기 -->
                <Button label="목록" icon="pi pi-list" severity="secondary" outlined @click="router.push('/info/plan')" />
            </div>
        </div>

        <!-- ① 기본 정보 입력 -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">기본 정보</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                <!-- 대상년도 입력 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        대상년도 <span class="text-red-500">*</span>
                    </label>
                    <div class="flex gap-2">
                        <InputText
                            v-model="plnYy"
                            placeholder="예: 2026"
                            maxlength="4"
                            class="flex-1"
                            @keyup.enter="handleSearch"
                        />
                        <Button
                            label="조회"
                            icon="pi pi-search"
                            :loading="projectsPending"
                            @click="handleSearch"
                        />
                    </div>
                    <small class="text-zinc-400">YYYY 형식으로 입력 후 [조회]를 클릭하세요.</small>
                </div>

                <!-- 계획구분 선택 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        계획구분 <span class="text-red-500">*</span>
                    </label>
                    <Select
                        v-model="plnTp"
                        :options="plnTpOptions"
                        placeholder="계획구분 선택"
                        class="w-full"
                    />
                </div>
            </div>
        </div>

        <!-- ② 대상사업 선택 -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    대상사업 선택
                    <span class="ml-2 text-sm font-normal text-zinc-500">
                        ({{ plnYy }}년도 사업 목록 · 선택: {{ selectedProjects.length }}건)
                    </span>
                </h2>
                <!-- 생성 버튼 -->
                <Button
                    label="생성"
                    icon="pi pi-refresh"
                    severity="info"
                    :loading="generating"
                    :disabled="selectedProjects.length === 0"
                    @click="handleGenerate"
                />
            </div>

            <!-- 미조회 안내 -->
            <div v-if="!searched && !projectsPending" class="flex items-center justify-center gap-2 text-zinc-400 py-10">
                <i class="pi pi-info-circle text-lg" />
                대상년도를 입력하고 [조회] 버튼을 클릭하세요.
            </div>

            <!-- 로딩 표시 -->
            <div v-else-if="projectsPending" class="flex items-center gap-2 text-zinc-500 py-4">
                <i class="pi pi-spin pi-spinner" />
                사업 목록을 불러오는 중...
            </div>

            <!-- 사업 목록 테이블 -->
            <DataTable
                v-else
                :value="projects"
                v-model:selection="selectedProjects"
                dataKey="prjMngNo"
                paginator
                :rows="10"
                :rowsPerPageOptions="[10, 20, 50]"
                tableStyle="min-width: 50rem"
                :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }"
            >
                <!-- 다중 선택 체크박스 -->
                <Column selectionMode="multiple" headerStyle="width: 3rem" />

                <!-- 사업명 -->
                <Column field="prjNm" header="사업명" sortable headerClass="font-bold" />

                <!-- 사업유형 -->
                <Column field="prjTp" header="사업유형" sortable headerClass="font-bold" style="width: 8rem">
                    <template #body="slotProps">{{ getPrjTpName(slotProps.data.prjTp) }}</template>
                </Column>

                <!-- 주관부문 -->
                <Column field="svnHdq" header="주관부문" sortable headerClass="font-bold" style="width: 10rem" />

                <!-- 주관부서명 -->
                <Column field="svnDpmNm" header="주관부서" sortable headerClass="font-bold" style="width: 10rem" />

                <!-- 총예산 -->
                <Column field="prjBg" :header="`총예산 (${selectedUnit})`" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.prjBg) }}</span>
                    </template>
                </Column>

                <!-- 자본예산 -->
                <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.assetBg) }}</span>
                    </template>
                </Column>

                <!-- 일반관리비 -->
                <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.costBg) }}</span>
                    </template>
                </Column>

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                        {{ plnYy }}년도에 해당하는 사업이 없습니다.
                    </div>
                </template>
            </DataTable>
        </div>

        <!-- ③ 미리보기 (생성 버튼 클릭 후 표시) -->
        <template v-if="previewVisible">

            <!-- 예산 총계 카드 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">예산 총계</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- 총예산 -->
                    <div class="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-indigo-600 dark:text-indigo-300 font-medium mb-1">총예산</div>
                        <div class="text-2xl font-bold text-indigo-700 dark:text-indigo-200 tabular-nums">
                            {{ formatBudget(totalBudget.ttlBg) }}
                        </div>
                        <div class="text-xs text-indigo-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                    <!-- 자본예산 -->
                    <div class="bg-sky-50 dark:bg-sky-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-sky-600 dark:text-sky-300 font-medium mb-1">자본예산</div>
                        <div class="text-2xl font-bold text-sky-700 dark:text-sky-200 tabular-nums">
                            {{ formatBudget(totalBudget.cptBg) }}
                        </div>
                        <div class="text-xs text-sky-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                    <!-- 일반관리비 -->
                    <div class="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-emerald-600 dark:text-emerald-300 font-medium mb-1">일반관리비</div>
                        <div class="text-2xl font-bold text-emerald-700 dark:text-emerald-200 tabular-nums">
                            {{ formatBudget(totalBudget.mngc) }}
                        </div>
                        <div class="text-xs text-emerald-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                </div>
            </div>

            <!-- 부문(SVN_HDQ)별 사업목록 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">부문별 사업목록</h2>
                <div v-for="dept in byDepartment" :key="dept.svnHdq" class="space-y-2">
                    <div class="flex items-center gap-2">
                        <Tag :value="dept.svnHdq" severity="info" />
                        <span class="text-sm text-zinc-500">{{ dept.projects.length }}건</span>
                    </div>
                    <DataTable
                        :value="dept.projects"
                        dataKey="prjMngNo"
                        :pt="{
                            headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm' },
                            bodyRow: { class: 'text-sm' }
                        }"
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
                    </DataTable>
                </div>
            </div>

            <!-- 사업유형(PRJ_TP)별 사업목록 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">사업유형별 사업목록</h2>
                <div v-for="typeGroup in byProjectType" :key="typeGroup.prjTp" class="space-y-2">
                    <div class="flex items-center gap-2">
                        <Tag :value="getPrjTpName(typeGroup.prjTp)" severity="secondary" />
                        <span class="text-sm text-zinc-500">{{ typeGroup.projects.length }}건</span>
                    </div>
                    <DataTable
                        :value="typeGroup.projects"
                        dataKey="prjMngNo"
                        :pt="{
                            headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm' },
                            bodyRow: { class: 'text-sm' }
                        }"
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
                    </DataTable>
                </div>
            </div>
        </template>

        <!-- ④ 하단 저장/취소 버튼 -->
        <div class="flex justify-end gap-3 pb-8">
            <Button
                label="취소"
                icon="pi pi-times"
                severity="secondary"
                outlined
                @click="router.push('/info/plan')"
            />
            <Button
                label="저장"
                icon="pi pi-save"
                :loading="saving"
                :disabled="!previewVisible || saving"
                @click="handleSave"
            />
        </div>
    </div>
</template>
