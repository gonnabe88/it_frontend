<!--
정보화사업 상세 화면의 진행 현황 타임라인 섹션입니다.
프로젝트 상태 문자열을 기준으로 완료/현재/예정 단계를 표시합니다.
-->
<script setup lang="ts">
import { PROJECT_STAGES } from '~/utils/common'

const props = defineProps<{
    status?: string
}>()

/**
 * 현재 프로젝트 상태의 단계 인덱스를 반환합니다.
 * 단계 목록에 없으면 진행선과 현재 표시를 비활성화합니다.
 */
const currentStageIndex = computed(() => {
    if (!props.status) return -1
    return PROJECT_STAGES.indexOf(props.status)
})

/**
 * 타임라인 진행선 너비입니다.
 * 첫 번째 원 중심에서 현재 단계 원 중심까지의 상대 너비를 계산합니다.
 */
const timelineProgressWidth = computed(() => {
    const idx = currentStageIndex.value
    if (idx <= 0) return '0%'
    const total = PROJECT_STAGES.length
    const fraction = idx / (total - 1)
    return `calc((100% - 100% / ${total}) * ${fraction})`
})
</script>

<template>
    <section
        id="section-progress"
        class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-visible"
    >
        <div class="flex items-center justify-between mb-8">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <i class="pi pi-step-forward-alt text-indigo-500" />
                사업 진행 현황
            </h3>
            <span
                class="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800"
            >
                {{ status }}
            </span>
        </div>

        <div class="relative w-full px-2">
            <div
                class="absolute h-[2px] bg-zinc-200 dark:bg-zinc-700"
                :style="{ top: '20px', left: `calc(100% / ${PROJECT_STAGES.length * 2})`, right: `calc(100% / ${PROJECT_STAGES.length * 2})` }"
            />
            <div
                class="absolute h-[2px] bg-indigo-500 transition-all duration-700"
                :style="{ top: '20px', left: `calc(100% / ${PROJECT_STAGES.length * 2})`, width: timelineProgressWidth }"
            />

            <div class="flex items-start justify-between w-full">
                <div
                    v-for="(step, index) in PROJECT_STAGES"
                    :key="index"
                    class="relative flex flex-col items-center flex-1 group"
                >
                    <div
                        class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 relative z-10 mb-3 shrink-0"
                        :class="[
                            currentStageIndex > Number(index)
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-400 dark:border-indigo-800 dark:bg-indigo-900/10 dark:text-indigo-500'
                                : currentStageIndex === Number(index)
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 scale-110 ring-4 ring-indigo-50 dark:ring-indigo-900/20'
                                    : 'border-zinc-200 text-zinc-300 dark:border-zinc-700 dark:text-zinc-600 bg-white dark:bg-zinc-900'
                        ]"
                    >
                        <i v-if="currentStageIndex > Number(index)" class="pi pi-check text-lg font-bold" />
                        <span v-else-if="currentStageIndex === Number(index)" class="text-[10px] font-bold tracking-tighter">진행</span>
                        <span v-else>{{ Number(index) + 1 }}</span>

                        <span
                            v-if="currentStageIndex === Number(index)"
                            class="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20"
                        />
                    </div>

                    <div class="h-10 flex items-start justify-center w-full">
                        <span
                            class="text-[10px] sm:text-xs font-medium text-center break-keep leading-tight px-0.5 transition-colors duration-300 w-full"
                            :class="[
                                currentStageIndex === Number(index)
                                    ? 'text-indigo-700 dark:text-indigo-400 font-bold'
                                    : currentStageIndex > Number(index)
                                        ? 'text-zinc-500 dark:text-zinc-500'
                                        : 'text-zinc-300 dark:text-zinc-600'
                            ]"
                        >
                            {{ step }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
