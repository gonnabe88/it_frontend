<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from 'primevue/usetoast';


const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
// const toast = useToast(); // PrimeVue Toast (Optional)

    const { getProjectById, addProject, updateProject, getApprovalAuthority } = useProjects();

    const projectId = route.query.id ? Number(route.query.id) : null;
    const isEditMode = computed(() => !!projectId);

    const form = ref({
        name: '',
        prj_type: '신규',
        major_department: '',
        it_department: '',
        budget: 0,
        status: '예산 신청',
        sta_date: null as Date | null,
        end_date: null as Date | null,
        description: '',
        background: '',
        effect: '',
        // Managers
        major_expr_name: '', major_expr_position: '',
        major_mng_name: '', major_mng_position: '',
        it_expr_name: '', it_expr_position: '',
        it_mng_name: '', it_mng_position: '',
        // Items
        items: [] as ProjectItem[]
    });

    // Dropdown Options
    const prjTypeOptions = ['신규', '계속'];
    const statusOptions = ['예산 신청', '사전 협의', '정실협 진행중', '요건 상세화', '소요예산 산정', '과심위 진행중', '입찰/계약 진행중', '사업 진행중', '사업 완료', '대금지급 완료', '성과평가(대기)', '성과평가(완료)'];
    const itemCategories = ['기계장치', '기타무형자산', '개발비', '임차료', '유지보수료'];
    const currencyOptions = ['KRW(원)', 'USD($)', 'EUR(€)'];

    const exchangeRates = {
        'USD($)': 1450,
        'EUR(€)': 1550,
        'KRW(원)': 1
    };

    // Mock Departments (In real app, fetch from API)
    const majorDepartments = ['글로벌사업부문', '경영지원부문', 'IT운영부문', '정보보호부문', '디지털혁신부문'];
    const itDepartments = ['정보전략팀', '경영지원팀', 'IT운영팀', '정보보호팀', '디지털혁신팀', 'CS팀'];

    const approvalAuthority = computed(() => {
        return getApprovalAuthority(form.value.items);
    });

    onMounted(() => {
    if (isEditMode && projectId) {
        const project = getProjectById(projectId);
        if (project) {
            form.value = {
                name: project.name,
                prj_type: project.prj_type,
                major_department: project.major_department,
                it_department: project.it_department,
                budget: project.budget,
                status: project.status,
                sta_date: project.sta_date ? new Date(project.sta_date) : null,
                end_date: project.end_date ? new Date(project.end_date) : null,
                description: project.description,
                background: project.background || '',
                effect: project.effect || '',
                // Managers
                major_expr_name: project.managers?.major_expr?.name || '', major_expr_position: project.managers?.major_expr?.position || '',
                major_mng_name: project.managers?.major_mng?.name || '', major_mng_position: project.managers?.major_mng?.position || '',
                it_expr_name: project.managers?.it_expr?.name || '', it_expr_position: project.managers?.it_expr?.position || '',
                it_mng_name: project.managers?.it_mng?.name || '', it_mng_position: project.managers?.it_mng?.position || '',
                // Items
                items: project.items ? JSON.parse(JSON.stringify(project.items)) : [] // Deep copy to avoid reference issues
            };
        } else {
            confirm.require({
                message: '유효하지 않은 사업 ID입니다.',
                header: '오류',
                icon: 'pi pi-exclamation-circle',
                rejectProps: {
                    class: 'hidden'
                },
                acceptLabel: '확인',
                accept: () => {
                    router.push('/info/projects');
                }
            });
        }
    }
});

const calculatedTotalBudget = computed(() => {
    return form.value.items.reduce((sum, item) => {
        const currency = item.currency || 'KRW(원)';
        const amount = item.amount || 0;
        const quantity = item.quantity || 1;
        const rate = exchangeRates[currency as keyof typeof exchangeRates] || 1;
        return sum + (amount * quantity * rate);
    }, 0);
});

watch(calculatedTotalBudget, (newTotal) => {
    form.value.budget = newTotal;
});

const addItem = () => {
    form.value.items.push({
        category: '기계장치',
        name: '',
        quantity: 1,
        amount: 0,
        currency: 'KRW(원)',
        description: ''
    });
};

const removeItem = (index: number) => {
    form.value.items.splice(index, 1);
};

const executeSave = () => {
    const projectData = {
        name: form.value.name,
        prj_type: form.value.prj_type,
        major_department: form.value.major_department,
        it_department: form.value.it_department,
        budget: form.value.budget,
        // Set default status for new projects if not provided (though form.status is used)
        status: isEditMode.value ? form.value.status : '예산 신청', 
        sta_date: form.value.sta_date ? form.value.sta_date.toISOString().split('T')[0] : '',
        end_date: form.value.end_date ? form.value.end_date.toISOString().split('T')[0] : '',
        description: form.value.description,
        background: form.value.background,
        effect: form.value.effect,
        managers: {
            major_expr: { name: form.value.major_expr_name, position: form.value.major_expr_position },
            major_mng: { name: form.value.major_mng_name, position: form.value.major_mng_position },
            it_expr: { name: form.value.it_expr_name, position: form.value.it_expr_position },
            it_mng: { name: form.value.it_mng_name, position: form.value.it_mng_position }
        },
        items: form.value.items
    };

    if (isEditMode.value && projectId) {
        updateProject(projectId, projectData);
        confirm.require({
            message: '수정되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            rejectProps: {
                class: 'hidden'
            },
            acceptLabel: '확인',
            accept: () => {
                router.push(`/info/projects/${projectId}`);
            }
        });
    } else {
        const newProject = addProject(projectData as any); // Type assertion needed for now or partial
        confirm.require({
            message: '등록되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            rejectProps: {
                class: 'hidden'
            },
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/projects');
            }
        });
    }
};

const saveProject = () => {
    if (!form.value.name) {
        confirm.require({
            message: '사업명을 입력해주세요.',
            header: '입력 확인',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: {
                class: 'hidden'
            },
            acceptLabel: '확인'
        });
        return;
    }

    if (form.value.items.length === 0) {
        confirm.require({
            message: '등록된 품목이 없습니다. 품목 없이 저장하시겠습니까?',
            header: '저장 확인',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '예',
            rejectLabel: '아니오',
            accept: () => {
                setTimeout(() => {
                    executeSave();
                }, 300); // 300ms delay to allow previous dialog to close
            }
        });
        return;
    }

    executeSave();
};

const cancel = () => {
    router.back();
};

const getCurrencyCode = (label: string) => {
    if (!label) return 'KRW';
    if (label.includes('USD')) return 'USD';
    if (label.includes('EUR')) return 'EUR';
    return 'KRW';
};

const itemTotalSummary = computed(() => {
    if (form.value.items.length === 0) return '0';
    
    const totals: Record<string, number> = {};
    form.value.items.forEach(item => {
        const curr = item.currency || 'KRW(원)';
        const amount = item.amount || 0;
        const quantity = item.quantity || 1;
        
        if (!totals[curr]) totals[curr] = 0;
         totals[curr] += (amount * quantity);
    });

    return Object.entries(totals)
        .map(([curr, amount]) => `${amount.toLocaleString()} ${curr}`)
        .join(' + ');
});

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
                    <InputText v-model="form.name" placeholder="사업명을 입력하세요" fluid />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">사업 유형</label>
                    <Select v-model="form.prj_type" :options="prjTypeOptions" placeholder="유형 선택" fluid />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">주관 부서</label>
                     <Select v-model="form.major_department" :options="majorDepartments" placeholder="주관 부서 선택" editable fluid />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">IT 부서</label>
                     <Select v-model="form.it_department" :options="itDepartments" placeholder="IT 부서 선택" editable fluid />
                </div>

                 <div class="flex flex-col gap-2">
                    <div class="flex justify-between items-center">
                        <label class="font-semibold">예산 (원)</label>
                        <div v-if="form.items.length > 0" class="flex items-center gap-2">
                             <span class="text-xs text-zinc-500">({{ approvalAuthority.reason }})</span>
                             <Tag :value="approvalAuthority.authority" severity="info" class="text-sm" />
                        </div>
                    </div>
                    <InputNumber v-model="form.budget" mode="currency" currency="KRW" locale="ko-KR" placeholder="품목 합계 자동 계산" fluid disabled />
                    <small class="text-zinc-500">
                        * 품목 상세 내역의 합계(원화 환산)로 자동 계산됩니다.
                        (환율 적용: 1 USD = 1,450원, 1 EUR = 1,550원)
                    </small>
                </div>
            </div>

            <!-- 수정 시 active (신규 등록 시 hidden) -->
            <div v-if="isEditMode" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">진행 상태</label>
                    <Select v-model="form.status" :options="statusOptions" placeholder="상태 선택" fluid />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">시작일</label>
                    <DatePicker v-model="form.sta_date" showIcon fluid dateFormat="yy-mm-dd" />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold">종료일</label>
                    <DatePicker v-model="form.end_date" showIcon fluid dateFormat="yy-mm-dd" />
                </div>
            </div>

            <Divider />

            <!-- Detailed Info -->
            <div class="space-y-6">
                 <div class="flex flex-col gap-2">
                    <label class="font-semibold">상세 설명</label>
                    <RichEditor v-model="form.description" editorStyle="height: 320px" placeholder="사업 상세 내용을 입력하세요." />
                </div>

                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">추진 배경</label>
                        <RichEditor v-model="form.background" editorStyle="height: 200px" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">기대 효과</label>
                        <RichEditor v-model="form.effect" editorStyle="height: 200px" />
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
                        <InputText v-model="form.major_expr_name" placeholder="이름" fluid />
                        <InputText v-model="form.major_expr_position" placeholder="직급" fluid />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당자</div>
                        <InputText v-model="form.major_mng_name" placeholder="이름" fluid />
                        <InputText v-model="form.major_mng_position" placeholder="직급" fluid />
                    </div>
                </div>

                <div class="space-y-4">
                    <h4 class="font-semibold text-zinc-600 dark:text-zinc-400">IT 부서</h4>
                     <div class="grid grid-cols-2 gap-2">
                        <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당 팀장</div>
                        <InputText v-model="form.it_expr_name" placeholder="이름" fluid />
                        <InputText v-model="form.it_expr_position" placeholder="직급" fluid />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                         <div class="font-medium text-sm text-center col-span-2 text-zinc-500">담당자</div>
                        <InputText v-model="form.it_mng_name" placeholder="이름" fluid />
                        <InputText v-model="form.it_mng_position" placeholder="직급" fluid />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- Project Items -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <h3 class="text-lg font-bold">품목 정보</h3>
                    <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                        합계 : {{ itemTotalSummary }}
                    </span>
                </div>
                <Button label="행 추가" icon="pi pi-plus" size="small" outlined @click="addItem" />
            </div>
            
            <div class="overflow-x-auto">
                <DataTable :value="form.items" :pt="{ table: { style: 'min-width: 50rem' } }">
                    <Column field="category" header="비목" style="width: 15%">
                        <template #body="{ data }">
                            <Select v-model="data.category" :options="itemCategories" placeholder="선택" fluid />
                        </template>
                    </Column>
                    <Column field="name" header="품목명" style="width: 20%">
                        <template #body="{ data }">
                            <InputText v-model="data.name" fluid />
                        </template>
                    </Column>
                    <Column field="quantity" header="수량" style="width: 10%">
                        <template #body="{ data }">
                            <InputNumber v-model="data.quantity" fluid />
                        </template>
                    </Column>
                    <Column field="amount" header="금액" style="width: 15%">
                        <template #body="{ data }">
                            <InputNumber v-model="data.amount" mode="currency" :currency="getCurrencyCode(data.currency)" locale="ko-KR" fluid />
                        </template>
                    </Column>
                    <Column field="currency" header="화폐단위" style="width: 10%">
                        <template #body="{ data }">
                             <Select v-model="data.currency" :options="currencyOptions" fluid />
                        </template>
                    </Column>
                    <Column field="description" header="주요기능" style="width: 20%">
                        <template #body="{ data }">
                            <InputText v-model="data.description" fluid />
                        </template>
                    </Column>
                    <Column style="width: 10%; text-align: center">
                        <template #body="{ index }">
                            <Button icon="pi pi-trash" text severity="danger" @click="removeItem(index)" />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="text-center p-4 text-zinc-500">등록된 품목이 없습니다.</div>
                    </template>
                </DataTable>
            </div>


            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-4">
                <Button label="취소" severity="secondary" @click="cancel" />
                <Button label="저장" @click="saveProject" />
            </div>

        </div>
    </div>
</template>


