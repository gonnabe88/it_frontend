<!--
================================================================================
[pages/info/index.vue] 정보화사업 대시보드 (홈)
================================================================================
정보화사업 메인 대시보드 페이지입니다.
현재는 주요 지표 카드, 공지사항, 주요 일정을 정적 데이터로 표시합니다.

[UI 구성]
  - 상단: 페이지 제목 + 빠른 액션 버튼 (사업 등록, 보고서 다운로드)
  - 중간: 4개 KPI 카드 (진행중인 사업 / 집행예산 / 접수된 요청 / 시스템 가동률)
  - 하단: 공지사항 목록 + 주요 일정 리스트

[향후 개선]
  - KPI 수치를 API에서 실시간으로 가져오는 기능 추가 예정
  - 공지사항/일정 데이터를 백엔드 API로 연결 예정
================================================================================
-->
<script setup lang="ts">
/* 페이지 탭 제목 설정 (useTabs composable이 이 값을 읽어 탭 이름으로 사용) */
const title = '정보화 홈';
definePageMeta({
    title
});
</script>

<template>
    <div class="flex flex-col xl:flex-row gap-6">
        <!-- 메인 콘텐츠 영역 -->
        <div class="flex-1 space-y-6 min-w-0">

            <!-- KPI 요약 카드 (4개 그리드) -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <!-- 진행중인 사업 수 -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-zinc-500 font-medium">진행중인 사업</span>
                        <i class="pi pi-briefcase text-primary-500 bg-primary-50 p-2 rounded-lg"/>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">12</div>
                    <div class="mt-2 text-sm text-green-600 flex items-center">
                        <i class="pi pi-arrow-up text-xs mr-1"/>
                        <span>전월 대비 2건 증가</span>
                    </div>
                </div>

                <!-- 금년 집행 예산 -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-zinc-500 font-medium">금년 집행 예산</span>
                        <i class="pi pi-wallet text-indigo-500 bg-indigo-50 p-2 rounded-lg"/>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">8.4억</div>
                    <div class="mt-2 text-sm text-zinc-500">
                        <span>전체 예산의 42%</span>
                    </div>
                </div>

                <!-- 접수된 요청 수 (처리지연 경고 포함) -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-zinc-500 font-medium">접수된 요청</span>
                        <i class="pi pi-inbox text-orange-500 bg-orange-50 p-2 rounded-lg"/>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">5</div>
                    <div class="mt-2 text-sm text-orange-600 flex items-center">
                        <i class="pi pi-exclamation-circle text-xs mr-1"/>
                        <span>3건 처리지연</span>
                    </div>
                </div>

                <!-- 시스템 가동률 -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-zinc-500 font-medium">시스템 가동률</span>
                        <i class="pi pi-server text-green-500 bg-green-50 p-2 rounded-lg"/>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">99.9%</div>
                    <div class="mt-2 text-sm text-green-600">
                        <span>정상 운영 중</span>
                    </div>
                </div>
            </div>

            <!-- 하단: 공지사항 + 주요 일정 (2열 그리드) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <!-- 공지사항 목록 -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96">
                    <h3 class="font-bold text-lg mb-4">공지사항</h3>
                    <div class="space-y-3">
                        <!-- 임시 데이터 (5개 반복), 추후 API 연결 예정 -->
                        <div
v-for="i in 5" :key="i"
                            class="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors">
                            <div class="flex items-center gap-3">
                                <span class="w-2 h-2 rounded-full bg-primary-500"/>
                                <span class="text-zinc-700 dark:text-zinc-300">2026년 정보화 사업 계획 수립 안내</span>
                            </div>
                            <span class="text-xs text-zinc-400">2026.01.15</span>
                        </div>
                    </div>
                </div>

                <!-- 주요 일정 목록 -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96">
                    <h3 class="font-bold text-lg mb-4">주요 일정</h3>
                    <div class="space-y-4">
                        <!-- 일정 항목 1: 정보화실무협의회 -->
                        <div class="flex gap-4">
                            <div
                                class="w-16 h-16 bg-primary-50 dark:bg-zinc-800 rounded-lg flex flex-col items-center justify-center text-primary-600 font-bold">
                                <span class="text-xs uppercase">JAN</span>
                                <span class="text-xl">20</span>
                            </div>
                            <div>
                                <div class="font-bold text-zinc-900 dark:text-zinc-100">정보화실무협의회</div>
                                <div class="text-sm text-zinc-500 mt-1">14:00 - 16:00 | 대회의실</div>
                            </div>
                        </div>
                        <!-- 일정 항목 2: 차세대 시스템 오픈식 -->
                        <div class="flex gap-4">
                            <div
                                class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-600 font-bold">
                                <span class="text-xs uppercase">JAN</span>
                                <span class="text-xl">25</span>
                            </div>
                            <div>
                                <div class="font-bold text-zinc-900 dark:text-zinc-100">차세대 시스템 오픈식</div>
                                <div class="text-sm text-zinc-500 mt-1">10:00 - 11:30 | 본관 로비</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div> <!-- 메인 콘텐츠 영역 닫기 -->

        <!-- 우측 바로가기 패널 -->
        <div class="w-full xl:w-80 flex-shrink-0">
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <!-- [주석] 바로가기 영역은 자주 사용하는 메뉴 및 각 항목의 중요도(숫자)를 표시합니다. -->
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                    <i class="pi pi-star-fill text-yellow-500"/>
                    바로가기
                </h3>
                <div class="space-y-3">
                    <!-- [주석] 사업 가이드: 중요도 10 -->
                    <NuxtLink
to="/guide"
                        class="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                <i class="pi pi-book"/>
                            </div>
                            <span class="font-medium text-zinc-700 dark:text-zinc-200">사업 가이드</span>
                        </div>
                        <span
                            class="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold px-2 py-1 rounded-full"
                            title="중요도: 10">10</span>
                    </NuxtLink>

                    <!-- [주석] 요구사항 작성기: 중요도 5 -->
                    <NuxtLink
to="/info/documents"
                        class="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <i class="pi pi-file-edit"/>
                            </div>
                            <span class="font-medium text-zinc-700 dark:text-zinc-200">요구사항 작성기</span>
                        </div>
                        <span
                            class="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded-full"
                            title="중요도: 5">5</span>
                    </NuxtLink>

                    <!-- [주석] 사전진단: 중요도 5 -->
                    <NuxtLink
to="/diagnosis"
                        class="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all cursor-pointer group">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-300 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                <i class="pi pi-check-square"/>
                            </div>
                            <span class="font-medium text-zinc-700 dark:text-zinc-200">사전진단</span>
                        </div>
                        <span
                            class="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded-full"
                            title="중요도: 5">5</span>
                    </NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>
