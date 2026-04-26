<!--
================================================================================
[components/common/AppDialogHeader.vue] 다이얼로그 표준 헤더
================================================================================
모든 Dialog의 #header 슬롯 안에 사용합니다.
blue-900 배경 + 흰 글씨 + 좌측 타이틀 + 우측 닫기 버튼을 표준화합니다.

[사용법]
  <Dialog
      v-model:visible="visible"
      modal
      :closable="false"
      :pt="{ header: { class: 'bg-blue-900 !rounded-t-xl' } }"
      :style="{ width: 'var(--dialog-md)' }"
  >
      <template #header>
          <AppDialogHeader title="다이얼로그 제목" @close="visible = false">
              <template #actions>
                  <!-- 헤더 우측 추가 버튼 (옵션) -->
              </template>
          </AppDialogHeader>
      </template>
      ...
  </Dialog>

[Props]
  title    : 헤더 좌측 타이틀 텍스트 (선택)
  closable : false 전달 시 닫기 버튼 숨김 (기본: true)

[Emits]
  close : 닫기 버튼 클릭 시 발생

[Slots]
  title   : title prop 대신 커스텀 h1/span 직접 작성 (인라인 배지 등 복합 마크업)
  actions : 헤더 우측 닫기 버튼 앞에 위치할 추가 액션 버튼들

[참고: Dialog :pt 설정]
  - `header: { class: 'bg-blue-900 !rounded-t-xl' }` 을 Dialog에 추가해야
    헤더 배경이 blue-900으로 표시됩니다.
  - Dialog 자체의 :closable="false" 설정으로 PrimeVue 기본 닫기 버튼을
    비활성화하고, 이 컴포넌트의 닫기 버튼을 사용합니다.
================================================================================
-->
<script setup lang="ts">
withDefaults(
    defineProps<{
        /** 헤더 좌측 타이틀 */
        title?: string;
        /** false 전달 시 닫기 버튼 숨김 */
        closable?: boolean;
    }>(),
    { closable: true }
);

defineEmits<{
    (e: 'close'): void;
}>();
</script>

<template>
    <div class="flex w-full items-center justify-between gap-3">
        <!-- 좌측: 커스텀 슬롯 또는 prop 타이틀 -->
        <slot name="title">
            <span class="font-semibold text-white text-base truncate">{{ title }}</span>
        </slot>

        <!-- 우측: 추가 액션 + 닫기 버튼 -->
        <div class="flex items-center gap-1 shrink-0">
            <slot name="actions" />
            <Button
                v-if="closable"
                icon="pi pi-times"
                text
                rounded
                size="small"
                class="!text-white !w-7 !h-7 hover:!bg-white/20"
                @click="$emit('close')"
            />
        </div>
    </div>
</template>
