<script setup lang="ts">
import { ref, computed } from 'vue';

definePageMeta({
    title: '사전진단'
});

const currentStep = ref(1);
const totalSteps = 10;
const showResult = ref(false);

interface Answers {

    workTypes: string[];
    userTypes: string[];
    serviceTypes: string[];
    isCore: string;
    integration: {
        required: string;
        target: string;
    };
    reasons: string[];
    concurrentUsers: string;
    dataScale: string;
    newTechs: string[];
    duration: string;
}

const answers = ref<Answers>({
    workTypes: [],
    userTypes: [],
    serviceTypes: [],
    isCore: '',
    integration: { required: '', target: '' },
    reasons: [],
    concurrentUsers: '',
    dataScale: '',
    newTechs: [],
    duration: ''
});

interface Question {
    id: number;
    title: string;
    description: string;
    type: string;
    model: keyof Answers;
    options?: string[];
}

const questions: Question[] = [
    {
        id: 1,
        title: '업무 유형',
        description: '어떤 업무 서비스를 기획하고 계신가요? (복수선택 가능)',
        type: 'checkbox',
        model: 'workTypes',
        options: ['여신', '수신', '트레이딩', '글로벌금융', '기타']
    },
    {
        id: 2,
        title: '사용자 유형',
        description: '어떤 사용자를 대상으로 하는 서비스인가요? (복수선택 가능)',
        type: 'checkbox',
        model: 'userTypes',
        options: ['대고객', '내부직원(전직원)', '내부직원(일부)', '파트너사']
    },
    {
        id: 3,
        title: '서비스 유형',
        description: '어떤 유형의 서비스를 생각하고 계신가요? (복수선택 가능)',
        type: 'checkbox',
        model: 'serviceTypes',
        options: ['기존 시스템 기능 추가', '신규 시스템 구축(웹)', '신규 시스템 구축(모바일)', '신규 시스템 구축(PC프로그램)']
    },
    {
        id: 4,
        title: '핵심업무 여부',
        description: '구축 대상 업무는 재해/재난 시 3시간 이내로 반드시 복구되어야 하는 업무인가요?',
        type: 'radio',
        model: 'isCore',
        options: ['예', '아니오 (6시간)', '아니오 (12시간)', '아니오 (24시간)', '아니오 (2일 이상)']
    },
    {
        id: 5,
        title: '연계 대상',
        description: '구축 대상 업무는 내부 다른 업무 또는 외부 기관과 연계가 필요한 업무인가요?',
        type: 'custom_integration',
        model: 'integration'
    },
    {
        id: 6,
        title: '구축 사유',
        description: '본 서비스 기획 배경은 무엇인가요? (복수선택 가능)',
        type: 'checkbox',
        model: 'reasons',
        options: ['법/규제', '편의성 개선', '경영진 지시', '관리체계 개선', '보안성 강화']
    },
    {
        id: 7,
        title: '예상 동시 접속자 수',
        description: '서비스 오픈 시 예상되는 최대 동시 접속자 수는 얼마인가요?',
        type: 'radio',
        model: 'concurrentUsers',
        options: ['100명 미만', '100명 ~ 1,000명', '1,000명 ~ 10,000명', '10,000명 이상']
    },
    {
        id: 8,
        title: '데이터 규모',
        description: '예상되는 데이터 저장 규모는 어느 정도인가요?',
        type: 'radio',
        model: 'dataScale',
        options: ['10GB 미만', '10GB ~ 1TB', '1TB ~ 10TB', '10TB 이상']
    },
    {
        id: 9,
        title: '신기술 활용',
        description: '활용하고자 하는 신기술이 있나요? (복수선택 가능)',
        type: 'checkbox',
        model: 'newTechs',
        options: ['AI/ML', '블록체인', '클라우드(Public)', '메타버스', 'RPA', '없음']
    },
    {
        id: 10,
        title: '희망 구축 기간',
        description: '생각하고 계신 프로젝트 구축 기간은 어느 정도인가요?',
        type: 'radio',
        model: 'duration',
        options: ['3개월 이내', '3개월 ~ 6개월', '6개월 ~ 1년', '1년 이상']
    }
];

const nextStep = () => {
    if (currentStep.value < totalSteps) {
        currentStep.value++;
    } else {
        calculateResult();
        showResult.value = true;
    }
};

const prevStep = () => {
    if (currentStep.value > 1) {
        currentStep.value--;
    }
};

const result = ref({
    team: '',
    budget: '',
    duration: ''
});

const calculateResult = () => {
    // Team Logic
    const techs = answers.value.newTechs;
    const work = answers.value.workTypes;
    
    if (techs.some(t => ['AI/ML', '블록체인', '메타버스'].includes(t))) {
        result.value.team = '디지털혁신팀';
    } else if (answers.value.reasons.includes('보안성 강화') || answers.value.workTypes.includes('정보보호')) {
        result.value.team = '정보보호팀';
    } else if (answers.value.serviceTypes.some(t => t.includes('신규'))) {
        if (answers.value.concurrentUsers === '10,000명 이상') {
            result.value.team = '정보전략팀'; // Large scale
        } else {
            result.value.team = 'IT운영팀'; // General dev
        }
    } else {
        result.value.team = 'IT운영팀';
    }

    // Budget Logic (Simple estimation)
    let baseBudget = 50000000; // 50M
    if (answers.value.serviceTypes.some(t => t.includes('신규'))) baseBudget += 100000000;
    if (answers.value.concurrentUsers === '1,000명 ~ 10,000명') baseBudget += 50000000;
    if (answers.value.concurrentUsers === '10,000명 이상') baseBudget += 150000000;
    if (answers.value.dataScale === '10TB 이상') baseBudget += 50000000;
    if (answers.value.newTechs.length > 0 && !answers.value.newTechs.includes('없음')) baseBudget += 50000000 * answers.value.newTechs.length;

    result.value.budget = (baseBudget / 100000000).toFixed(1) + '억원';

    // Duration Logic
    result.value.duration = answers.value.duration || '6개월';
};

const restart = () => {
    currentStep.value = 1;
    showResult.value = false;
    answers.value = {
        workTypes: [],
        userTypes: [],
        serviceTypes: [],
        isCore: '',
        integration: { required: '', target: '' },
        reasons: [],
        concurrentUsers: '',
        dataScale: '',
        newTechs: [],
        duration: ''
    };
};
</script>

<template>
    <div class="max-w-3xl mx-auto py-10 px-4">
        <div v-if="!showResult" class="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
            <div class="mb-8">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Question {{ currentStep }} / {{ totalSteps }}</span>
                    <span class="text-sm text-zinc-500">{{ Math.round((currentStep / totalSteps) * 100) }}% Completed</span>
                </div>
                <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-300" :style="{ width: `${(currentStep / totalSteps) * 100}%` }"></div>
                </div>
            </div>

            <div class="min-h-[300px]">
                <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{{ questions[currentStep - 1].title }}</h2>
                <p class="text-zinc-600 dark:text-zinc-400 mb-8">{{ questions[currentStep - 1].description }}</p>

                <div class="space-y-4">
                    <!-- Checkbox -->
                    <div v-if="questions[currentStep - 1].type === 'checkbox'" class="flex flex-col gap-3">
                        <div v-for="option in questions[currentStep - 1].options" :key="option" class="flex items-center">
                            <Checkbox v-model="answers[questions[currentStep - 1].model]" :inputId="option" :name="questions[currentStep - 1].title" :value="option" />
                            <label :for="option" class="ml-3 cursor-pointer text-zinc-700 dark:text-zinc-300">{{ option }}</label>
                        </div>
                    </div>

                    <!-- Radio -->
                    <div v-if="questions[currentStep - 1].type === 'radio'" class="flex flex-col gap-3">
                        <div v-for="option in questions[currentStep - 1].options" :key="option" class="flex items-center">
                            <RadioButton v-model="answers[questions[currentStep - 1].model]" :inputId="option" :name="questions[currentStep - 1].title" :value="option" />
                            <label :for="option" class="ml-3 cursor-pointer text-zinc-700 dark:text-zinc-300">{{ option }}</label>
                        </div>
                    </div>

                    <!-- Custom Integration -->
                    <div v-if="questions[currentStep - 1].type === 'custom_integration'" class="space-y-4">
                        <div class="flex items-center gap-4">
                            <div class="flex items-center">
                                <RadioButton v-model="answers.integration.required" inputId="int_yes" name="integration" value="예" />
                                <label for="int_yes" class="ml-3 cursor-pointer text-zinc-700 dark:text-zinc-300">예</label>
                            </div>
                            <div class="flex items-center">
                                <RadioButton v-model="answers.integration.required" inputId="int_no" name="integration" value="아니오" />
                                <label for="int_no" class="ml-3 cursor-pointer text-zinc-700 dark:text-zinc-300">아니오</label>
                            </div>
                        </div>
                        <div v-if="answers.integration.required === '예'" class="mt-2">
                            <InputText v-model="answers.integration.target" placeholder="연계 대상 시스템을 입력해주세요 (예: 내부 회계, 외부 금결원)" class="w-full" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Button label="이전" icon="pi pi-arrow-left" @click="prevStep" :disabled="currentStep === 1" severity="secondary" text />
                <Button :label="currentStep === totalSteps ? '결과 보기' : '다음'" icon="pi pi-arrow-right" iconPos="right" @click="nextStep" />
            </div>
        </div>

        <div v-else class="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 text-center animate-fade-in">
            <div class="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="pi pi-check-circle text-4xl text-indigo-600 dark:text-indigo-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">사전 진단 결과</h2>
            <p class="text-zinc-600 dark:text-zinc-400 mb-10">입력하신 정보를 바탕으로 분석된 결과입니다.</p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div class="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div class="text-sm text-zinc-500 mb-2">추천 담당 부서</div>
                    <div class="text-xl font-bold text-indigo-600 dark:text-indigo-400">{{ result.team }}</div>
                </div>
                <div class="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div class="text-sm text-zinc-500 mb-2">예상 소요 예산</div>
                    <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100">{{ result.budget }}</div>
                </div>
                <div class="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div class="text-sm text-zinc-500 mb-2">예상 구축 기간</div>
                    <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100">{{ result.duration }}</div>
                </div>
            </div>

            <div class="flex justify-center gap-4">
                <Button label="다시 진단하기" icon="pi pi-refresh" severity="secondary" @click="restart" />
                <Button label="사업 등록 신청" icon="pi pi-file-edit" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.5s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
