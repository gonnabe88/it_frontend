<script setup lang="ts">
import Quill from 'quill';

// Quill Configuration (Fonts & Sizes)
// Check if already registered to avoid re-registration warnings if possible, 
// though Quill.register(..., true) allows overwriting.
const Font = Quill.import('formats/font') as any;
Font.whitelist = ['notosanskr', 'sans-serif', 'serif', 'monospace'];
Quill.register(Font, true);

const Size: any = Quill.import('attributors/style/size');
Size.whitelist = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px'];
Quill.register(Size, true);

const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: ''
    },
    editorStyle: {
        type: String,
        default: 'height: 200px'
    }
});

const emit = defineEmits(['update:modelValue']);

/**
 * PrimeVue Editor(Quill) 컴포넌트 참조
 * onMounted에서 내부 DOM(.ql-editor)에 접근하기 위해 사용합니다.
 */
const editorRef = ref<any>(null);

/**
 * [한글 IME Placeholder 미사라짐 문제 수정]
 *
 * ── 문제 현상 ──
 * Quill 에디터의 placeholder는 CSS 기반으로 동작합니다:
 *   .ql-editor.ql-blank::before { content: attr(data-placeholder); }
 * 에디터가 비어있으면 'ql-blank' 클래스가 붙어 placeholder가 표시되고,
 * 내용이 입력되면 Quill이 'ql-blank'를 제거하여 placeholder가 사라집니다.
 *
 * 그런데 한글(예: 'ㅇ')을 입력하면 placeholder가 즉시 사라지지 않습니다.
 * 영문이나 숫자는 한 글자만 입력해도 바로 사라지는 것과 대비됩니다.
 *
 * ── 원인 ──
 * 한글은 IME(Input Method Editor) 조합 과정을 거칩니다:
 *   ㅇ → 아 → 안 → 안녕 (조합이 끝날 때까지 하나의 입력 세션)
 *
 * 브라우저는 조합 시작 시 'compositionstart', 끝날 때 'compositionend' 이벤트를 발생시킵니다.
 * Quill은 조합 중(composing)에는 콘텐츠 변경을 보류하기 때문에
 * 'ql-blank' 클래스가 제거되지 않아 placeholder가 그대로 남아있게 됩니다.
 *
 * 반면 영문/숫자는 IME 조합 없이 'input' 이벤트가 즉시 발생하므로
 * Quill이 바로 'ql-blank'를 제거하여 placeholder가 즉시 사라집니다.
 *
 * ── 해결 ──
 * compositionstart: 한글 조합이 시작되면 즉시 'ql-blank' 클래스를 제거합니다.
 * compositionend:   조합이 끝난 후 에디터가 비어있으면 'ql-blank'를 다시 추가합니다.
 *                   (입력을 시작했다가 모두 지운 경우 placeholder 복원 목적)
 */
/**
 * 언마운트 시 정리를 위해 editorEl과 MutationObserver 참조를 외부에서 유지합니다.
 * 익명 함수는 removeEventListener로 제거할 수 없으므로 핸들러도 참조를 보관합니다.
 */
let _editorEl: HTMLElement | null = null;
let _observer: MutationObserver | null = null;

const onCompositionStart = () => _editorEl?.classList.remove('ql-blank');
const onCompositionEnd = () => {
    // trim() 후 빈 문자열은 falsy이므로 !text 하나로 충분합니다.
    if (!_editorEl?.innerText?.trim()) _editorEl?.classList.add('ql-blank');
};

/**
 * IME composition 이벤트 리스너를 .ql-editor 요소에 등록하는 함수
 *
 * @param editorEl - Quill이 생성한 .ql-editor DOM 요소
 */
function attachCompositionHandlers(editorEl: HTMLElement) {
    _editorEl = editorEl;
    // 한글 조합 시작 → placeholder 즉시 숨김
    editorEl.addEventListener('compositionstart', onCompositionStart);
    // 한글 조합 종료 → 에디터가 비어있으면 placeholder 복원
    editorEl.addEventListener('compositionend', onCompositionEnd);
}

/**
 * PrimeVue Editor는 Quill 인스턴스를 비동기로 초기화합니다.
 * 따라서 onMounted 시점에 .ql-editor DOM이 아직 생성되지 않았을 수 있습니다.
 *
 * MutationObserver를 사용하여 .ql-editor가 DOM에 나타나는 시점을 감지하고,
 * 그때 compositionstart/compositionend 이벤트 리스너를 등록합니다.
 * 이미 존재하는 경우에는 즉시 등록합니다.
 */
onMounted(() => {
    const container = editorRef.value?.$el;
    if (!container) return;

    // 이미 .ql-editor가 렌더링된 경우 즉시 등록
    const existing = container.querySelector('.ql-editor');
    if (existing) {
        attachCompositionHandlers(existing as HTMLElement);
        return;
    }

    // 아직 렌더링되지 않은 경우 MutationObserver로 대기
    _observer = new MutationObserver(() => {
        const editorEl = container.querySelector('.ql-editor');
        if (editorEl) {
            attachCompositionHandlers(editorEl as HTMLElement);
            _observer?.disconnect(); // .ql-editor를 찾았으므로 감시 종료
            _observer = null;
        }
    });
    _observer.observe(container, { childList: true, subtree: true });
});

/**
 * 컴포넌트 언마운트 시 이벤트 리스너와 MutationObserver를 정리합니다.
 * .ql-editor가 나타나기 전에 언마운트된 경우 observer도 해제합니다.
 */
onBeforeUnmount(() => {
    _observer?.disconnect();
    _observer = null;
    if (_editorEl) {
        _editorEl.removeEventListener('compositionstart', onCompositionStart);
        _editorEl.removeEventListener('compositionend', onCompositionEnd);
        _editorEl = null;
    }
});
</script>

<template>
    <Editor ref="editorRef" :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)"
        :editorStyle="editorStyle" class="w-full" :placeholder="placeholder">
        <template #toolbar>
            <span class="ql-formats">
                <select class="ql-font">
                    <option value="notosanskr" selected>Noto Sans KR</option>
                    <option value="sans-serif">Sans Serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                </select>
                <select class="ql-size">
                    <option value="8px">8px</option>
                    <option value="10px">10px</option>
                    <option value="11px">11px</option>
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px" selected>16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                </select>
            </span>
            <span class="ql-formats">
                <button class="ql-bold"></button>
                <button class="ql-italic"></button>
                <button class="ql-underline"></button>
                <button class="ql-strike"></button>
            </span>
            <span class="ql-formats">
                <select class="ql-color"></select>
                <select class="ql-background"></select>
            </span>
            <span class="ql-formats">
                <select class="ql-align"></select>
            </span>
            <span class="ql-formats">
                <button class="ql-list" value="ordered"></button>
                <button class="ql-list" value="bullet"></button>
            </span>
        </template>
    </Editor>
</template>