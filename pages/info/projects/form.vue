<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useRouter, useRoute } from 'vue-router'; // Ensure useRouter and useRoute are imported
import { useProjects } from '~/composables/useProjects'; // Assuming useProjects is in composables

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchProject, createProject, updateProject } = useProjects();

const projectId = route.query.id ? (route.query.id as string) : null;
const isEditMode = computed(() => !!projectId);

const form = ref({
    prjNm: '',
    prjTp: '신규',
    svnDpm: '',
    itDpm: '',
    prjBg: 0,
    prjSts: '예산 신청',
    sttDt: null as Date | null,
    endDt: null as Date | null,
    prjDes: '',
    pulRsn: '', // 추진사유
    xptEff: '', // 기대효과
    svnHdq: '', // 주관부문

    // New Fields
    bzDtt: '', // 업무구분
    dplYn: 'N', // 중복여부
    edrt: '', // 전결권
    hrfPln: '', // 향후계획
    itDpmCgpr: '', // 정보전략팀 담당자
    itDpmTlr: '', // IT팀장
    lblFsgTlm:  null as Date | null, // 의무완료기한
    mnUsr: '', // 주요사용자
    ncs: '', // 필요성
    plm: '', // 문제
    prjPulPtt: '', // 프로젝트추진가능성
    prjRng: '', // 사업범위
    pulPsg: '', // 추진경과
    rprSts: '', // 보고상태
    saf: '', // 현황
    svnDpmCgpr: '', // 주관부서 담당자
    svnDpmTlr: '', // 주관부서 팀장
    tchnTp: '', // 기술유형
    resourceItems: [] as any[] // 소요자원 상세내용
});

// Resource Options
const resourceCategoryOptions = ['개발비', '기계장치', '기타무형자산', '전산임차료', '전산제비'];
const currencyOptions = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];
const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];

// Dropdown Options
const prjTypeOptions = ['신규', '계속'];
const statusOptions = ['예산 신청', '사전 협의', '정실협 진행중', '요건 상세화', '소요예산 산정', '과심위 진행중', '입찰/계약 진행중', '사업 진행중', '사업 완료', '대금지급 완료', '성과평가(대기)', '성과평가(완료)', '완료'];

// Mock Departments
const majorHdqs = ['글로벌사업부문', '경영지원부문', 'IT운영부문', '정보보호부문', '디지털혁신부문'];
const majorDepartments = ['글로벌사업부', '경영지원부', 'IT운영부', '정보보호부', '디지털혁신부'];
const itDepartments = ['정보전략팀', '경영지원팀', 'IT운영팀', '정보보호팀', '디지털혁신팀', 'CS팀'];

onMounted(async () => {
    if (isEditMode.value && projectId) {
        try {
            const { data, error } = await fetchProject(projectId);
            if (data.value) {
                const project = data.value;
                form.value = {
                    ...form.value,
                    ...project,
                    sttDt: project.sttDt ? new Date(project.sttDt) : null,
                    endDt: project.endDt ? new Date(project.endDt) : null,
                    lblFsgTlm: project.lblFsgTlm ? new Date(project.lblFsgTlm) : null,
                };
            } else if (error.value) {
                console.error('Failed to load project', error.value);
                confirm.require({
                    message: '사업 정보를 불러오는데 실패했습니다.',
                    header: '오류',
                    icon: 'pi pi-exclamation-circle',
                    acceptLabel: '확인',
                    accept: () => { router.push('/info/projects'); }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
});

// Date formatting helper
const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
};

// 저장
const executeSave = async () => {
    const payload = {
        ...form.value,
        prjMngNo: projectId,
        sttDt: formatDate(form.value.sttDt),
        endDt: formatDate(form.value.endDt),
        lblFsgTlm: formatDate(form.value.lblFsgTlm),
    };

    try {
        let response;
        if (isEditMode.value && projectId) {
            response = await updateProject(projectId, payload);
        } else {
            response = await createProject(payload);
        }

        confirm.require({
            message: isEditMode.value ? '수정되었습니다.' : '등록되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/projects');
            }
        });
    } catch (error) {
        console.error('Save failed', error);
        confirm.require({
            message: '저장 중 오류가 발생했습니다.',
            header: '오류',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
    }
};

const saveProject = () => {
    if (!form.value.prjNm) {
        confirm.require({
            message: '사업명을 입력해주세요.',
            header: '입력 확인',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
        return;
    }
    executeSave();
};

// Resource Item Logic
const addResourceRow = () => {
    form.value.resourceItems.push({
        category: '개발비',
        item: '',
        quantity: 0,
        unitPrice: 0,
        currency: 'KRW',
        subtotal: 0,
        basis: '',
        introDate: null,
        paymentCycle: '',
        infoProtection: 'N',
        integratedInfra: 'N'
    });
};

const removeResourceRow = (index: number) => {
    form.value.resourceItems.splice(index, 1);
};

// Watcher for unit price calculation
watch(() => form.value.resourceItems, (items) => {
    if (!items) return;
    items.forEach(item => {
        if (item.quantity > 0 && item.subtotal > 0) {
            item.unitPrice = Math.round(item.subtotal / item.quantity);
        } else {
            item.unitPrice = 0;
        }
    });
}, { deep: true });

const cancel = () => {
    router.back();
};

definePageMeta({
    title: '사업 정보 입력'
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {{ isEditMode ? '사업 정보 수정' : '신규 사업 등록' }}
            </h1>
        </div>

        <div
            class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <h3 class="text-xl font-semibold">사업명</h3>
            <!-- 사업명 -->
            <div class="flex gap-6">

                <!-- 수정 시 active (신규 등록 시 hidden) -->
                <div v-if="isEditMode" class="grid grid-cols gap-2">
                    <Select v-model="form.prjSts" :options="statusOptions" placeholder="상태 선택" class="w-80" />
                </div>
                <div class="flex flex-col gap-2">
                    <Select v-model="form.prjTp" :options="prjTypeOptions" placeholder="유형 선택" class="w-40" />
                </div>

                <div class="flex flex-col gap-2 flex-1">
                    <InputText v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid />
                </div>
            </div>

            <Divider />

            <!-- 사업 개요 -->
            <div class="space-y-6">
                <h3 class="text-xl font-semibold">사업 개요</h3>
                <div class="flex flex-col gap-2">
                    <RichEditor v-model="form.prjDes" editorStyle="height: 150px" placeholder="사업 상세 내용을 입력하세요." />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">현황</label>
                        <Textarea v-model="form.saf" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">필요성</label>
                        <Textarea v-model="form.ncs" style="height: 150px;" />
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">기대효과</label>
                        <Textarea v-model="form.xptEff" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">미추진 시 문제점</label>
                        <Textarea v-model="form.plm" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">사업범위</span>
                    <span class="text-sm text-zinc-500">전산 요구사항</span>
                </div>
                <!-- 사업범위 -->
                <div class="flex flex-col gap-2">
                    <RichEditor v-model="form.prjRng" editorStyle="height: 150px" />
                </div>
            </div>

            <Divider />

            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">진행상황</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">추진 경과</label>
                        <Textarea v-model="form.pulPsg" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">향후 계획</label>
                        <Textarea v-model="form.hrfPln" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">사업구분</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">업무 구분</label>
                        <InputText v-model="form.bzDtt" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">사업 유형</label>
                        <InputText v-model="form.prjTp" fluid />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">기술 유형</label>
                        <InputText v-model="form.tchnTp" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주요 사용자</label>
                        <InputText v-model="form.mnUsr" fluid />
                    </div>
                </div>
            </div>

            <Divider />

            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">편성기준</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">중복 여부 (Y/N)</label>
                        <Select v-model="form.dplYn" :options="['Y', 'N']" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">법규상 완료시기</label>
                        <DatePicker v-model="form.lblFsgTlm" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- Basic Info -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">담당부서</span>
                </div>

                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주관부문</label>
                        <Select v-model="form.svnHdq" :options="majorHdqs" placeholder="주관부문 선택" editable
                            class="w-80" />
                    </div>
                </div>

                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주관부서</label>
                        <Select v-model="form.svnDpm" :options="majorDepartments" placeholder="주관 부서 선택" editable
                            class="w-40" />
                    </div>
                    <div class="flex flex-col  gap-2 flex-1">
                        <label class="font-semibold">담당팀장</label>
                        <InputText v-model="form.svnDpmTlr" placeholder="이름" fluid />
                    </div>
                    <div class="flex flex-col  gap-2 flex-1">
                        <label class="font-semibold">담당자</label>
                        <InputText v-model="form.svnDpmCgpr" placeholder="이름" fluid />
                    </div>
                </div>

                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">IT부서</label>
                        <Select v-model="form.itDpm" :options="itDepartments" placeholder="IT부서 선택" editable
                            class="w-40" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당팀장</label>
                        <InputText v-model="form.itDpmTlr" placeholder="이름" fluid />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당자</label>
                        <InputText v-model="form.itDpmCgpr" placeholder="이름" fluid />
                    </div>
                </div>

            </div>

            <Divider />

            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">추진시기 및 소요예산</span>
                </div>

                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">예산 (원)</label>
                        <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR"
                            placeholder="예산 입력" fluid />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">전결권</label>
                        <InputText v-model="form.edrt" fluid />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">보고상태</label>
                        <InputText v-model="form.rprSts" fluid />
                    </div>
                </div>

                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">시작일</label>
                        <DatePicker v-model="form.sttDt" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>

                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">종료일</label>
                        <DatePicker v-model="form.endDt" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>

                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">사업추진 가능성</label>
                        <InputText v-model="form.prjPulPtt" fluid />
                    </div>
                </div>
                <Divider />

                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-semibold">소요자원 상세내용</h3>
                        <Button label="품목 추가" icon="pi pi-plus" size="small" @click="addResourceRow" />
                    </div>

                    <div class="overflow-x-auto">
                        <DataTable :value="form.resourceItems" resizableColumns columnResizeMode="fit" showGridlines
                            size="small" class="resource-table">
                            <template #empty>
                                <div class="text-center text-zinc-500 py-4">
                                    등록된 소요자원이 없습니다. 품목 추가 버튼을 눌러 등록해주세요.
                                </div>
                            </template>

                            <Column header="구분" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 120px">
                                <template #body="{ data }">
                                    <Select v-model="data.category" :options="resourceCategoryOptions" placeholder="선택"
                                        class="w-full" />
                                </template>
                            </Column>

                            <Column header="항목" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 200px">
                                <template #body="{ data }">
                                    <Textarea v-model="data.item" rows="1" autoResize class="w-full" />
                                </template>
                            </Column>

                            <Column header="수량" headerClass="text-center justify-center [&>div]:justify-center" style="width: 80px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.quantity" :min="0" class="w-full" />
                                </template>
                            </Column>

                            <Column header="단가" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 120px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.unitPrice" mode="currency"
                                        :currency="data.currency || 'KRW'" locale="ko-KR" readonly
                                        class="w-full bg-zinc-100 dark:bg-zinc-800" />
                                </template>
                            </Column>

                            <Column header="통화" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 100px">
                                <template #body="{ data }">
                                    <Select v-model="data.currency" :options="currencyOptions" class="w-full" />
                                </template>
                            </Column>

                            <Column header="소계" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 120px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.subtotal" mode="currency"
                                        :currency="data.currency || 'KRW'" locale="ko-KR" class="w-full" />
                                </template>
                            </Column>

                            <Column header="산정근거" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 200px">
                                <template #body="{ data }">
                                    <Textarea v-model="data.basis" rows="1" autoResize class="w-full" />
                                </template>
                            </Column>

                            <Column header="도입시기/지급주기" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 150px">
                                <template #body="{ data }">
                                    <div v-if="['개발비', '기계장치', '기타무형자산'].includes(data.category)">
                                        <DatePicker v-model="data.introDate" view="month" dateFormat="yy-mm" showIcon
                                            fluid placeholder="도입시기" class="w-full" />
                                    </div>
                                    <div v-else-if="['전산임차료', '전산제비'].includes(data.category)">
                                        <Select v-model="data.paymentCycle" :options="paymentCycleOptions"
                                            placeholder="지급주기" class="w-full" />
                                    </div>
                                </template>
                            </Column>

                            <Column header="정보보호" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 80px">
                                <template #body="{ data }">
                                    <Select v-model="data.infoProtection" :options="ynOptions" class="w-full" />
                                </template>
                            </Column>

                            <Column header="통합인프라" headerClass="text-center justify-center [&>div]:justify-center" style="min-width: 80px">
                                <template #body="{ data }">
                                    <Select v-model="data.integratedInfra" :options="ynOptions" class="w-full" />
                                </template>
                            </Column>

                            <Column header="" headerClass="text-center justify-center [&>div]:justify-center" style="width: 50px">
                                <template #body="{ index }">
                                    <Button icon="pi pi-trash" text severity="danger"
                                        @click="removeResourceRow(index)" />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex justify-end gap-2 pt-4">
                    <Button label="취소" severity="secondary" @click="cancel" />
                    <Button label="저장" @click="saveProject" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
:deep(.resource-table .p-datatable-thead > tr > th) {
    background-color: #f4f4f5 !important; /* zinc-100 */
}
:deep(.dark .resource-table .p-datatable-thead > tr > th) {
    background-color: #27272a !important; /* zinc-800 */
}
:deep(.resource-table .p-datatable-thead > tr > th .p-column-header-content) {
    justify-content: center;
}
</style>