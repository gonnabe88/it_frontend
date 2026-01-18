<template>
    <div class="space-y-6">
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">IT 자체감사 대시보드</h1>
        
        <div class="bg-gradient-to-r from-zinc-800 to-zinc-900 text-white p-8 rounded-2xl shadow-lg">
            <div class="flex flex-col md:flex-row justify-between items-center">
                <div>
                   <h2 class="text-3xl font-bold mb-2">2026년 정기 감사 진행 중</h2>
                   <p class="text-zinc-400">현재 1분기 보안 감사가 진행 중입니다. 제출 기한을 확인하세요.</p>
                </div>
                <div class="mt-6 md:mt-0 flex gap-3">
                    <Button label="감사 자료 제출" severity="info" />
                    <Button label="가이드라인 보기" severity="secondary" outlined class="text-white border-white hover:bg-white/10" />
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 class="font-bold text-lg mb-2 text-red-600">조치 필요</h3>
                <div class="text-4xl font-bold">3</div>
                <p class="text-sm text-zinc-500 mt-2">지적 사항 미조치 건수</p>
            </div>
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 class="font-bold text-lg mb-2 text-yellow-600">진행 중</h3>
                <div class="text-4xl font-bold">8</div>
                <p class="text-sm text-zinc-500 mt-2">현재 진행중인 감사 항목</p>
            </div>
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                 <h3 class="font-bold text-lg mb-2 text-green-600">완료</h3>
                <div class="text-4xl font-bold">142</div>
                <p class="text-sm text-zinc-500 mt-2">금년 누적 감사 완료</p>
            </div>
        </div>
    </div>
</template>
