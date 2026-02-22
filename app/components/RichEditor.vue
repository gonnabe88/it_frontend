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
</script>

<template>
    <Editor 
        :modelValue="modelValue" 
        @update:modelValue="emit('update:modelValue', $event)" 
        :editorStyle="editorStyle" 
        class="w-full" 
        :placeholder="placeholder"
    >
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
