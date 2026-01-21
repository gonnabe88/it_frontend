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
    xptEff: '',
    
    // New Fields
    bzDtt: '', // 업무구분
    dplYn: 'N', // 중복여부
    edrt: '', // 전결권
    hrfPln: '', // 향후계획
    itDpmCgpr: '', // 정보전략팀 담당자
    itDpmTlr: '', // IT팀장
    lblFsgTlm: '', // 의무완료기한
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
    tchnTp: '' // 기술유형
});

// Dropdown Options
const prjTypeOptions = ['신규', '계속'];
const statusOptions = ['예산 신청', '사전 협의', '정실협 진행중', '요건 상세화', '소요예산 산정', '과심위 진행중', '입찰/계약 진행중', '사업 진행중', '사업 완료', '대금지급 완료', '성과평가(대기)', '성과평가(완료)', '완료'];

// Mock Departments
const majorDepartments = ['글로벌사업부문', '경영지원부문', 'IT운영부문', '정보보호부문', '디지털혁신부문'];
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

const executeSave = async () => {
    const payload = {
        ...form.value,
        prjMngNo: projectId,
        sttDt: form.value.sttDt ? form.value.sttDt.toISOString().split('T')[0] : '',
        endDt: form.value.endDt ? form.value.endDt.toISOString().split('T')[0] : '',
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

        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            
            <!-- Basic Info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col gap-2 col-span-2">
                    <label class="font-semibold">사업명 <span class="text-red-500">*</span></label>
                    <InputText v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">사업 유형</label>
                    <Select v-model="form.prjTp" :options="prjTypeOptions" placeholder="유형 선택" fluid />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">주관 부서</label>
                     <Select v-model="form.svnDpm" :options="majorDepartments" placeholder="주관 부서 선택" editable fluid />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">IT 부서</label>
                     <Select v-model="form.itDpm" :options="itDepartments" placeholder="IT 부서 선택" editable fluid />
                </div>

                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">예산 (원)</label>
                    <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR" placeholder="예산 입력" fluid />
                </div>
            </div>

            <!-- 수정 시 active (신규 등록 시 hidden) -->
            <div v-if="isEditMode" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">진행 상태</label>
                    <Select v-model="form.prjSts" :options="statusOptions" placeholder="상태 선택" fluid />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">시작일</label>
                    <DatePicker v-model="form.sttDt" showIcon fluid dateFormat="yy-mm-dd" />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">종료일</label>
                    <DatePicker v-model="form.endDt" showIcon fluid dateFormat="yy-mm-dd" />
                </div>
            </div>
            
            <!-- Additional Info Fields -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">업무 구분</label>
                    <InputText v-model="form.bzDtt" fluid />
                </div>
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">기술 유형</label>
                    <InputText v-model="form.tchnTp" fluid />
                </div>
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">전결권</label>
                    <InputText v-model="form.edrt" fluid />
                </div>
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">사업 범위</label>
                    <InputText v-model="form.prjRng" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">주요 사용자</label>
                    <InputText v-model="form.mnUsr" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">의무 완료 기한</label>
                    <InputText v-model="form.lblFsgTlm" fluid />
                </div>
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">중복 여부 (Y/N)</label>
                    <Select v-model="form.dplYn" :options="['Y', 'N']" fluid />
                </div>
            </div>

            <Divider />

            <!-- Detailed Info -->
            <div class="space-y-6">
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">사업 설명</label>
                    <RichEditor v-model="form.prjDes" editorStyle="height: 320px" placeholder="사업 상세 내용을 입력하세요." />
                </div>

                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">추진 사유</label>
                        <RichEditor v-model="form.pulRsn" editorStyle="height: 200px" />
                    </div>
                     <div class="flex flex-col gap-2">
                        <label class="font-semibold">필요성</label>
                        <InputText v-model="form.ncs" fluid />
                    </div>
                    <div class="flex flex-col gap-2 col-span-2">
                        <label class="font-semibold">기대 효과</label>
                        <RichEditor v-model="form.xptEff" editorStyle="height: 200px" />
                    </div>
                     <div class="flex flex-col gap-2 col-span-2">
                        <label class="font-semibold">문제점</label>
                        <InputText v-model="form.plm" fluid />
                    </div>
                     <div class="flex flex-col gap-2 col-span-2">
                        <label class="font-semibold">현황</label>
                        <InputText v-model="form.saf" fluid />
                    </div>
                     <div class="flex flex-col gap-2 col-span-2">
                        <label class="font-semibold">향후 계획</label>
                        <InputText v-model="form.hrfPln" fluid />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- Manager Info -->
            <h3 class="text-lg font-bold">담당자 정보</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg">
                <div class="space-y-4">
                    <h4 class="font-semibold text-zinc-600 dark:text-zinc-400">주관 부서</h4>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당 팀장</div>
                        <InputText v-model="form.svnDpmTlr" placeholder="이름" fluid class="col-span-2"/>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당자</div>
                        <InputText v-model="form.svnDpmCgpr" placeholder="이름" fluid class="col-span-2"/>
                    </div>
                </div>

                <div class="space-y-4">
                    <h4 class="font-semibold text-zinc-600 dark:text-zinc-400">IT 부서</h4>
                     <div class="grid grid-cols-2 gap-2">
                        <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당 팀장</div>
                        <InputText v-model="form.itDpmTlr" placeholder="이름" fluid class="col-span-2"/>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                         <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당자</div>
                        <InputText v-model="form.itDpmCgpr" placeholder="이름" fluid class="col-span-2"/>
                    </div>
                </div>
            </div>

            <Divider />

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-4">
                <Button label="취소" severity="secondary" @click="cancel" />
                <Button label="저장" @click="saveProject" />
            </div>

        </div>
    </div>
</template>
