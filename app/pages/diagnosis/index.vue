<!--
================================================================================
[pages/diagnosis/index.vue] IT 사전진단 설문 페이지
================================================================================
IT 프로젝트 추진 전 사전 진단을 위한 10단계 설문 폼 페이지입니다.
설문 완료 후 입력값을 분석하여 추천 부서, 예상 예산, 예상 기간을 도출합니다.

[UI 구성]
  - 진행 표시줄: 현재 단계 / 전체 단계 및 진행률(%) 표시
  - 설문 단계별 렌더링: checkbox / radio / custom_integration 3가지 타입
  - 결과 화면: 설문 완료 후 추천 담당 부서, 예상 소요 예산, 예상 구축 기간 카드 표시

[설문 구성 (총 10단계)]
  Q1. 업무 유형 (checkbox)
  Q2. 사용자 유형 (checkbox)
  Q3. 서비스 유형 (checkbox)
  Q4. 핵심업무 여부 (radio) - 재해 복구 시간 기준
  Q5. 연계 대상 (custom_integration) - 예/아니오 + 연계 시스템 입력
  Q6. 구축 사유 (checkbox)
  Q7. 예상 동시 접속자 수 (radio)
  Q8. 데이터 규모 (radio)
  Q9. 신기술 활용 (checkbox)
  Q10. 희망 구축 기간 (radio)

[결과 계산 로직 (calculateResult)]
  - 추천 부서:
    * AI/ML, 블록체인, 메타버스 선택 → 디지털혁신팀
    * 보안성 강화 또는 정보보호 → 정보보호팀
    * 신규 시스템 + 10,000명 이상 → 정보전략팀
    * 그 외 → IT운영팀
  - 예상 예산: 기본 5천만원 + 항목별 가산 (신규사업, 접속자, 데이터, 신기술)
  - 예상 기간: 사용자가 선택한 duration 값 그대로 반환

[향후 개선]
  - API 연동을 통한 설문 결과 저장/조회 기능 추가 예정
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';

definePageMeta({
    title: '사전진단'
});

/** 현재 진행 단계 (1-based) */
const currentStep = ref(1);
/** 전체 설문 단계 수 */
const totalSteps = 10;
/** 결과 화면 표시 여부 */
const showResult = ref(false);

/**
 * [설문 답변 인터페이스]
 * 10개 설문 항목에 대한 사용자 입력값을 저장합니다.
 */
interface Answers {
    /** Q1. 업무 유형 (복수 선택) */
    workTypes: string[];
    /** Q2. 사용자 유형 (복수 선택) */
    userTypes: string[];
    /** Q3. 서비스 유형 (복수 선택) */
    serviceTypes: string[];
    /** Q4. 핵심업무 여부 (단일 선택) */
    isCore: string;
    /** Q5. 연계 대상 정보 (필수 여부 + 대상 시스템명) */
    integration: {
        required: string;
        target: string;
    };
    /** Q6. 구축 사유 (복수 선택) */
    reasons: string[];
    /** Q7. 예상 동시 접속자 수 (단일 선택) */
    concurrentUsers: string;
    /** Q8. 데이터 규모 (단일 선택) */
    dataScale: string;
    /** Q9. 신기술 활용 (복수 선택) */
    newTechs: string[];
    /** Q10. 희망 구축 기간 (단일 선택) */
    duration: string;
}

/** 사용자 설문 답변 상태 (초기값: 모두 빈 값) */
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

/**
 * [설문 문항 인터페이스]
 * 단계별 설문 문항의 구조를 정의합니다.
 */
interface Question {
    /** 문항 ID (1-based) */
    id: number;
    /** 문항 제목 */
    title: string;
    /** 문항 상세 설명 */
    description: string;
    /** 입력 타입: 'checkbox' | 'radio' | 'custom_integration' */
    type: string;
    /** answers 객체의 바인딩 키 */
    model: keyof Answers;
    /** 선택지 목록 (checkbox/radio 타입에서 사용) */
    options?: string[];
}

/** 10개 설문 문항 정의 */
const questions: Question[] = [
    {
        id: 1,
        title: '업무 유형',
        description: '어떤 업무 서비스를 기획하고 계신나요? (복수선택 가능)',
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
        type: 'custom_integration', // 예/아니오 + 조건부 텍스트 입력
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

/**
 * 현재 단계의 설문 문항 (non-null 보장)
 * template에서 questions[currentStep - 1] 인덱스 접근 시 undefined 타입 오류를 방지합니다.
 */
const currentQuestion = computed(() => questions[currentStep.value - 1]!);

/**
 * 다음 단계로 이동
 * 마지막 단계(10)에서 호출 시 결과를 계산하고 결과 화면으로 전환합니다.
 */
const nextStep = () => {
    if (currentStep.value < totalSteps) {
        currentStep.value++;
    } else {
        /* 마지막 단계: 결과 계산 후 결과 화면 표시 */
        calculateResult();
        showResult.value = true;
    }
};

/**
 * 이전 단계로 이동
 * 첫 번째 단계에서는 아무 동작도 하지 않습니다.
 */
const prevStep = () => {
    if (currentStep.value > 1) {
        currentStep.value--;
    }
};

/** 설문 진단 결과 상태 */
const result = ref({
    /** 추천 담당 부서 */
    team: '',
    /** 예상 소요 예산 (억원 단위) */
    budget: '',
    /** 예상 구축 기간 */
    duration: ''
});

/**
 * 설문 답변 기반 진단 결과 계산
 *
 * [추천 부서 결정 로직]
 * 1. AI/ML, 블록체인, 메타버스 → 디지털혁신팀
 * 2. 보안성 강화 / 정보보호 업무 → 정보보호팀
 * 3. 신규 시스템 + 10,000명 이상 → 정보전략팀
 * 4. 기타 → IT운영팀
 *
 * [예상 예산 계산 로직]
 * - 기본: 5천만원
 * - 신규 시스템 포함: +1억원
 * - 접속자 1,000~10,000명: +5천만원
 * - 접속자 10,000명 이상: +1.5억원
 * - 데이터 10TB 이상: +5천만원
 * - 신기술 항목 각각: +5천만원
 */
const calculateResult = () => {
    const techs = answers.value.newTechs;

    /* 추천 부서 결정 */
    if (techs.some(t => ['AI/ML', '블록체인', '메타버스'].includes(t))) {
        result.value.team = '디지털혁신팀';
    } else if (answers.value.reasons.includes('보안성 강화') || answers.value.workTypes.includes('정보보호')) {
        result.value.team = '정보보호팀';
    } else if (answers.value.serviceTypes.some(t => t.includes('신규'))) {
        if (answers.value.concurrentUsers === '10,000명 이상') {
            result.value.team = '정보전략팀'; // 대규모 서비스
        } else {
            result.value.team = 'IT운영팀'; // 일반 개발
        }
    } else {
        result.value.team = 'IT운영팀';
    }

    /* 예상 예산 계산 (기본 5천만원 기준 가산) */
    let baseBudget = 50000000; // 5천만원
    if (answers.value.serviceTypes.some(t => t.includes('신규'))) baseBudget += 100000000;
    if (answers.value.concurrentUsers === '1,000명 ~ 10,000명') baseBudget += 50000000;
    if (answers.value.concurrentUsers === '10,000명 이상') baseBudget += 150000000;
    if (answers.value.dataScale === '10TB 이상') baseBudget += 50000000;
    if (answers.value.newTechs.length > 0 && !answers.value.newTechs.includes('없음')) baseBudget += 50000000 * answers.value.newTechs.length;

    result.value.budget = (baseBudget / 100000000).toFixed(1) + '억원';

    /* 예상 구축 기간: 사용자 선택값 그대로 반환 */
    result.value.duration = answers.value.duration || '6개월';
};

/**
 * 설문 초기화 및 처음부터 다시 시작
 * 모든 답변과 단계를 초기 상태로 리셋합니다.
 */
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

        <!-- 설문 진행 중 화면 -->
        <div v-if="!showResult" class="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">

            <!-- 진행률 표시 영역 -->
            <div class="mb-8">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Question {{ currentStep }} / {{ totalSteps }}</span>
                    <span class="text-sm text-zinc-500">{{ Math.round((currentStep / totalSteps) * 100) }}% Completed</span>
                </div>
                <!-- 진행률 바 (현재 단계 비율로 너비 조절) -->
                <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-300" :style="{ width: `${(currentStep / totalSteps) * 100}%` }"></div>
                </div>
            </div>

            <!-- 설문 문항 영역 (최소 높이 고정으로 레이아웃 안정화) -->
            <div class="min-h-[300px]">
                <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{{ currentQuestion.title }}</h2>
                <p class="text-zinc-600 dark:text-zinc-400 mb-8">{{ currentQuestion.description }}</p>

                <div class="space-y-4">
                    <!-- 체크박스 타입: 복수 선택 -->
                    <div v-if="currentQuestion.type === 'checkbox'" class="flex flex-col gap-3">
                        <div v-for="option in currentQuestion.options" :key="option" class="flex items-center">
                            <Checkbox v-model="answers[currentQuestion.model]" :inputId="option" :name="currentQuestion.title" :value="option" />
                            <label :for="option" class="ml-3 cursor-pointer text-zinc-700 dark:text-zinc-300">{{ option }}</label>
                        </div>
                    </div>

                    <!-- 라디오 타입: 단일 선택 -->
                    <div v-if="currentQuestion.type === 'radio'" class="flex flex-col gap-3">
                        <div v-for="option in currentQuestion.options" :key="option" class="flex items-center">
                            <RadioButton v-model="answers[currentQuestion.model]" :inputId="option" :name="currentQuestion.title" :value="option" />
                            <label :for="option" class="ml-3 cursor-pointer text-zinc-700 dark:text-zinc-300">{{ option }}</label>
                        </div>
                    </div>

                    <!-- 연계 대상 커스텀 타입: 예/아니오 + 조건부 텍스트 입력 -->
                    <div v-if="currentQuestion.type === 'custom_integration'" class="space-y-4">
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
                        <!-- '예' 선택 시 연계 시스템 입력 필드 표시 -->
                        <div v-if="answers.integration.required === '예'" class="mt-2">
                            <InputText v-model="answers.integration.target" placeholder="연계 대상 시스템을 입력해주세요 (예: 내부 회계, 외부 금결원)" class="w-full" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- 네비게이션 버튼 (이전 / 다음 or 결과 보기) -->
            <div class="flex justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Button label="이전" icon="pi pi-arrow-left" @click="prevStep" :disabled="currentStep === 1" severity="secondary" text />
                <Button :label="currentStep === totalSteps ? '결과 보기' : '다음'" icon="pi pi-arrow-right" iconPos="right" @click="nextStep" />
            </div>
        </div>

        <!-- 설문 결과 화면 (설문 완료 후 표시) -->
        <div v-else class="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 text-center animate-fade-in">
            <!-- 완료 아이콘 -->
            <div class="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="pi pi-check-circle text-4xl text-indigo-600 dark:text-indigo-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">사전 진단 결과</h2>
            <p class="text-zinc-600 dark:text-zinc-400 mb-10">입력하신 정보를 바탕으로 분석된 결과입니다.</p>

            <!-- 결과 카드 3개 (추천 부서 / 예상 예산 / 예상 기간) -->
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

            <!-- 결과 화면 액션 버튼 -->
            <div class="flex justify-center gap-4">
                <Button label="다시 진단하기" icon="pi pi-refresh" severity="secondary" @click="restart" />
                <Button label="사업 등록 신청" icon="pi pi-file-edit" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/** 결과 화면 등장 페이드인 애니메이션 */
.animate-fade-in {
    animation: fadeIn 0.5s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
