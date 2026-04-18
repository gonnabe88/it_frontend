<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useCost } from '~/composables/useCost';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const { fetchCost, deleteCost } = useCost();

const id = route.params.id as string;
definePageMeta({ title: '금융정보단말기 상세' });

const { data: cost, error, refresh: refreshCost } = await fetchCost(id);

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(() => refreshCost());

const handleDelete = () => {
    confirm.require({
        message: '정말로 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteCost(id);
                if (window.history.length > 1) { router.back(); } else { router.push('/info/cost'); }
            } catch (err) {
                console.error('Failed to delete cost:', err);
            }
        }
    });
};

const formatCurrency = (value: number | undefined, currency: string = 'KRW') => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(value);
};
</script>

<template>
    <div v-if="cost" class="space-y-8 pb-20 max-w-[1440px] mx-auto p-4">
        <!-- 헤더 -->
        <div class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div class="flex items-center gap-4">
                <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <Tag value="금융정보단말기" severity="info" rounded />
                        <span class="text-sm font-mono text-zinc-500">#{{ cost.itMngcNo }}</span>
                    </div>
                    <h1 class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{{ cost.cttNm }}</h1>
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="돌아가기" icon="pi pi-arrow-left" severity="secondary" outlined @click="router.back()" />
                <Button label="삭제" icon="pi pi-trash" severity="danger" outlined @click="handleDelete" />
                <Button label="수정" icon="pi pi-pencil" @click="navigateTo(`/info/cost/terminal/form?id=${cost.itMngcNo}`)" />
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- 기본 정보 & 단말기 목록 -->
            <div class="lg:col-span-2 space-y-8">
                <!-- 마스터 정보 -->
                <section class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                        <i class="pi pi-info-circle text-blue-500"/> 기본 계약 정보
                    </h2>
                    <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div class="space-y-1">
                            <label class="text-sm text-zinc-500">계약상대처</label>
                            <p class="font-semibold text-lg">{{ cost.cttOpp || '-' }}</p>
                        </div>
                        <div class="space-y-1">
                            <label class="text-sm text-zinc-500">지급주기</label>
                            <p class="font-semibold text-lg">{{ cost.dfrCle || '-' }}</p>
                        </div>
                        <div class="space-y-1">
                            <label class="text-sm text-zinc-500">최초지급일</label>
                            <p class="font-semibold text-lg">{{ cost.fstDfrDt || '-' }}</p>
                        </div>
                        <div class="space-y-1">
                            <label class="text-sm text-zinc-500">정보보호여부</label>
                            <p class="font-semibold text-lg">{{ cost.infPrtYn === 'Y' ? '대상' : '비대상' }}</p>
                        </div>
                    </div>
                </section>

                <!-- 단말기 상세 목록 -->
                <section class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                        <i class="pi pi-list text-indigo-500"/> 단말기 상세 내역 ({{ cost.terminals?.length || 0 }}대)
                    </h2>
                    <StyledDataTable :value="cost.terminals" class="p-datatable-sm" responsive-layout="scroll">
                        <Column field="tmnNm" header="단말기명" />
                        <Column field="tmnTuzManr" header="이동방법" />
                        <Column field="tmnUsg" header="용도" />
                        <Column field="tmlAmt" header="금액">
                            <template #body="slotProps">
                                {{ formatCurrency(slotProps.data.tmlAmt, slotProps.data.cur) }}
                            </template>
                        </Column>
                    </StyledDataTable>
                </section>
            </div>

            <!-- 우측 요약 정보 -->
            <div class="space-y-6">
                <div class="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl space-y-6 sticky top-24">
                    <h3 class="text-lg font-bold border-b border-zinc-700 pb-2">예산 요약</h3>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-zinc-400 text-sm">총 소요예산 (원)</label>
                            <p class="text-3xl font-black text-blue-400">
                                {{ formatCurrency(cost.itMngcBg) }}
                            </p>
                        </div>
                        <Divider class="before:border-zinc-700" />
                        <div class="flex justify-between">
                            <span class="text-zinc-400">담당부서</span>
                            <span class="font-bold">{{ cost.biceDpmNm || '-' }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-zinc-400">담당자</span>
                            <span class="font-bold">{{ cost.cgprNm || '-' }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
