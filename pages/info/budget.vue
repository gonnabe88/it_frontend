<script setup lang="ts">
import { ref } from 'vue';

const selectedProject = ref();
const projects = ref([
    { name: '차세대 정보시스템 구축', code: 'PJ-2026-001' },
    { name: '노후 PC 교체 사업', code: 'PJ-2026-002' },
    { name: '정보보호 컨설팅', code: 'PJ-2026-003' }
]);

const amount = ref();
const description = ref('');
const type = ref();
const types = ref(['S/W 구입', 'H/W 구입', '용역비', '기타']);
</script>

<template>
    <div class="flex flex-col h-[calc(100vh-10rem)] space-y-4">
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">예산 신청</h1>
        
        <!-- Top: Selection -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
            <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
                <i class="pi pi-search bg-primary-50 text-primary-600 p-1.5 rounded-lg text-sm"></i>
                대상 사업 선택
            </h2>
            <div class="flex flex-col md:flex-row gap-4 items-end md:items-center">
                <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                         <label class="text-sm text-zinc-500">사업명</label>
                         <Select v-model="selectedProject" :options="projects" optionLabel="name" placeholder="사업을 선택하세요" class="w-full" />
                    </div>
                     <div class="flex flex-col gap-2">
                         <label class="text-sm text-zinc-500">예산 비목</label>
                         <Select v-model="type" :options="types" placeholder="비목 선택" class="w-full" />
                    </div>
                </div>
                <Button label="조회" icon="pi pi-search" class="w-full md:w-auto" />
            </div>
        </div>

        <!-- Bottom: Input Form -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-1 overflow-auto">
             <h2 class="text-lg font-semibold mb-6 flex items-center gap-2">
                <i class="pi pi-pencil bg-primary-50 text-primary-600 p-1.5 rounded-lg text-sm"></i>
                신청 내역 입력
             </h2>
             
             <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="space-y-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-medium text-zinc-700 dark:text-zinc-300">신청 금액</label>
                        <InputNumber v-model="amount" mode="currency" currency="KRW" locale="ko-KR" placeholder="0" class="w-full" inputClass="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-medium text-zinc-700 dark:text-zinc-300">집행 예상일</label>
                        <DatePicker showIcon fluid iconDisplay="input" />
                    </div>
                     <div class="flex flex-col gap-2">
                        <label class="font-medium text-zinc-700 dark:text-zinc-300">관련 문서</label>
                        <FileUpload mode="basic" name="demo[]" url="/api/upload" accept="image/*" :maxFileSize="1000000" chooseLabel="파일 첨부" class="w-full" />
                    </div>
                </div>

                <div class="space-y-6 h-full flex flex-col">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-medium text-zinc-700 dark:text-zinc-300">산출 내역 및 사유</label>
                        <Textarea v-model="description" class="w-full h-full min-h-[150px]" placeholder="상세 내용을 입력하세요." />
                    </div>
                </div>
             </div>

             <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button label="초기화" severity="secondary" text />
                <Button label="신청하기" icon="pi pi-send" />
             </div>
        </div>
    </div>
</template>
