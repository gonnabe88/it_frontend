<!--
정보화사업 상세 화면의 사업 개요 섹션입니다.
Rich Text 설명과 현황/필요성/기대효과/미추진 시 문제점을 표시합니다.
-->
<script setup lang="ts">
import type { ProjectDetail } from '~/composables/useProjects'

defineProps<{
    project: ProjectDetail
    isOrdinary: boolean
    sanitizeHtml: (html: string) => string
}>()
</script>

<template>
    <section
        id="section-overview"
        class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6"
    >
        <div id="sub-overview-desc" class="scroll-mt-6">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                <i class="pi pi-info-circle text-indigo-500" />
                사업 개요
            </h3>
            <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md block mb-2">사업 주요내용</label>
            <div
                class="ql-editor p-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                style="height: 200px; overflow-y: auto;"
                v-html="sanitizeHtml(project.prjDes || '<span class=\'text-zinc-400 italic\'>내용 없음</span>')"
            />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div id="sub-overview-status" class="relative scroll-mt-6">
                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800" />
                <div class="relative pl-10">
                    <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <i class="pi pi-chart-bar text-sm" />
                    </div>
                    <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">현황</label>
                    <div class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 h-[100px] overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                        {{ project.saf || '-' }}
                    </div>
                </div>
            </div>

            <div id="sub-overview-need" class="relative scroll-mt-6">
                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800" />
                <div class="relative pl-10">
                    <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <i class="pi pi-question-circle text-sm" />
                    </div>
                    <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">필요성</label>
                    <div class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 h-[100px] overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                        {{ project.ncs || '-' }}
                    </div>
                </div>
            </div>

            <div v-if="!isOrdinary" id="sub-overview-expect" class="relative scroll-mt-6">
                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-50 dark:bg-indigo-900/20" />
                <div class="relative pl-10">
                    <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500">
                        <i class="pi pi-star text-sm" />
                    </div>
                    <label class="font-bold text-indigo-900 dark:text-indigo-100 text-md mb-3 block">기대효과</label>
                    <div class="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 h-[100px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {{ project.xptEff || '-' }}
                    </div>
                </div>
            </div>

            <div v-if="!isOrdinary" id="sub-overview-problem" class="relative scroll-mt-6">
                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-red-50 dark:bg-red-900/20" />
                <div class="relative pl-10">
                    <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                        <i class="pi pi-exclamation-triangle text-sm" />
                    </div>
                    <label class="font-bold text-red-900 dark:text-red-100 text-md mb-3 block">미추진 시 문제점</label>
                    <div class="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 h-[100px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {{ project.plm || '-' }}
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
