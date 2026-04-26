<!--
================================================================================
[components/common/EmployeeInfoDialog.vue] 직원 정보 다이얼로그 컴포넌트
================================================================================
행번(ENO)을 기반으로 직원 상세 정보를 조회하여 표시하는 공용 다이얼로그입니다.
GET /api/users/{eno} API를 호출하여 본부/부문, 부서, 팀, 이름, 직책,
전자우편주소, 내선번호, 핸드폰번호, 상세 직무내용 등을 표시합니다.

[Props]
  - visible : 다이얼로그 표시 여부 (v-model)
  - eno     : 조회할 직원 행번

[Events]
  - update:visible : 다이얼로그 닫힘 시 visible 상태 동기화

[사용처]
  - pages/budget/status.vue : 예산 현황 담당자 이름 클릭 시
================================================================================
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

/** 직원 상세 정보 타입 (GET /api/users/{eno} 응답) */
interface EmployeeDetail {
    eno: string
    bbrC: string
    bbrNm: string | null
    temC: string | null
    temNm: string | null
    usrNm: string
    ptCNm: string | null
    etrMilAddrNm: string | null
    inleNo: string | null
    cpnTpn: string | null
    dtsDtlCone: string | null
    prlmHrkOgzCCone: string | null
    prlmHrkOgzCNm: string | null
}

const props = defineProps<{
    visible: boolean
    eno: string | null
}>()

const emit = defineEmits(['update:visible'])

const isVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit('update:visible', value)
})

const config = useRuntimeConfig()
const employee = ref<EmployeeDetail | null>(null)
const loading = ref(false)
const error = ref(false)

/** 행번이 변경되면 직원 정보 조회 */
watch(() => [props.visible, props.eno], async ([visible, eno]) => {
    if (!visible || !eno) return
    loading.value = true
    error.value = false
    employee.value = null
    try {
        const { $apiFetch } = useNuxtApp()
        employee.value = await $apiFetch<EmployeeDetail>(`${config.public.apiBase}/api/users/${eno}`)
    } catch {
        error.value = true
    } finally {
        loading.value = false
    }
}, { immediate: true })
</script>

<template>
    <Dialog v-model:visible="isVisible" header="직원 정보" modal :style="{ width: 'var(--dialog-md)' }">
        <!-- 로딩 -->
        <div v-if="loading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <!-- 에러 -->
        <div v-else-if="error" class="text-center py-8 text-zinc-500">
            직원 정보를 조회할 수 없습니다.
        </div>

        <!-- 직원 정보 -->
        <div v-else-if="employee" class="space-y-4">
            <!-- 이름 + 직책 헤더 -->
            <div class="flex items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-700">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900">
                    <i class="pi pi-user text-indigo-600 dark:text-indigo-300 text-xl" />
                </div>
                <div>
                    <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {{ employee.usrNm }}
                        <span v-if="employee.ptCNm" class="text-sm font-normal text-zinc-500 ml-1">{{ employee.ptCNm }}</span>
                    </div>
                    <div class="text-sm text-zinc-500">{{ employee.eno }}</div>
                </div>
            </div>

            <!-- 소속 정보 -->
            <div class="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                <span class="text-zinc-500">본부/부문</span>
                <span class="text-zinc-900 dark:text-zinc-100">{{ employee.prlmHrkOgzCNm || '-' }}</span>

                <span class="text-zinc-500">부서</span>
                <span class="text-zinc-900 dark:text-zinc-100">{{ employee.bbrNm || '-' }}</span>

                <span class="text-zinc-500">팀</span>
                <span class="text-zinc-900 dark:text-zinc-100">{{ employee.temNm || '-' }}</span>
            </div>

            <Divider />

            <!-- 연락처 정보 -->
            <div class="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                <span class="text-zinc-500">전자우편</span>
                <span class="text-zinc-900 dark:text-zinc-100">{{ employee.etrMilAddrNm || '-' }}</span>

                <span class="text-zinc-500">내선번호</span>
                <span class="text-zinc-900 dark:text-zinc-100">{{ employee.inleNo || '-' }}</span>

                <span class="text-zinc-500">핸드폰</span>
                <span class="text-zinc-900 dark:text-zinc-100">{{ employee.cpnTpn || '-' }}</span>
            </div>

            <!-- 상세 직무내용 -->
            <div v-if="employee.dtsDtlCone" class="mt-2">
                <Divider />
                <div class="text-sm">
                    <span class="text-zinc-500 block mb-1">상세 직무내용</span>
                    <div class="text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
                        {{ employee.dtsDtlCone }}
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <AppDialogFooter>
                <Button label="닫기" severity="secondary" outlined @click="isVisible = false" />
            </AppDialogFooter>
        </template>
    </Dialog>
</template>
