import type { EditorView } from '@tiptap/pm/view';

interface UseTiptapImageInsertionOptions {
    /** 이미지 파일 업로드 핸들러. 없으면 base64 삽입으로 동작합니다. */
    imageUploadFn: () => ((file: File) => Promise<string>) | undefined;
}

/** Tiptap 에디터의 이미지 붙여넣기/드롭 삽입 동작을 관리합니다. */
export const useTiptapImageInsertion = (options: UseTiptapImageInsertionOptions) => {
    const isDragOver = ref(false);
    let dragCounter = 0;

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const replaceImageSrc = (view: EditorView, fromSrc: string, toSrc: string): boolean => {
        let imagePos: number | null = null;

        view.state.doc.descendants((node, pos) => {
            if (imagePos !== null) return false;
            if (node.type.name === 'image' && node.attrs.src === fromSrc) {
                imagePos = pos;
                return false;
            }
            return true;
        });

        if (imagePos === null) return false;

        const imageNode = view.state.doc.nodeAt(imagePos);
        if (!imageNode) return false;

        view.dispatch(view.state.tr.setNodeMarkup(imagePos, undefined, {
            ...imageNode.attrs,
            src: toSrc,
        }));

        return true;
    };

    const insertImageFile = async (view: EditorView, file: File, insertPos: number): Promise<number> => {
        const imageType = view.state.schema.nodes.image;
        if (!imageType) return 0;

        const uploadFn = options.imageUploadFn();
        if (uploadFn) {
            const tempUrl = URL.createObjectURL(file);
            const imageNode = imageType.create({ src: tempUrl, alt: file.name || '스크린샷' });
            view.dispatch(view.state.tr.insert(insertPos, imageNode));

            uploadFn(file)
                .then((url) => {
                    if (replaceImageSrc(view, tempUrl, url)) URL.revokeObjectURL(tempUrl);
                })
                .catch((e: unknown) => {
                    console.error('[TiptapEditor] 이미지 업로드 실패:', e);
                });

            return imageNode.nodeSize;
        }

        const src = await fileToBase64(file);
        const imageNode = imageType.create({ src, alt: file.name || '스크린샷' });
        view.dispatch(view.state.tr.insert(insertPos, imageNode));
        return imageNode.nodeSize;
    };

    const resetDragOver = () => {
        dragCounter = 0;
        isDragOver.value = false;
    };

    const handleDOMEvents = {
        dragenter: (_view: EditorView, event: DragEvent) => {
            if (event.dataTransfer?.types.includes('Files')) {
                dragCounter++;
                isDragOver.value = true;
            }
            return false;
        },
        dragleave: () => {
            dragCounter--;
            if (dragCounter <= 0) resetDragOver();
            return false;
        },
        drop: () => {
            resetDragOver();
            return false;
        }
    };

    const handlePaste = (view: EditorView, event: ClipboardEvent) => {
        const files = Array.from(event.clipboardData?.files ?? [])
            .filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return false;

        event.preventDefault();

        let insertPos = view.state.selection.from;
        files.reduce(
            (chain, file) => chain.then(async () => {
                const insertedSize = await insertImageFile(view, file, insertPos);
                insertPos += insertedSize;
            }),
            Promise.resolve()
        ).catch((e: unknown) => {
            console.error('[TiptapEditor] 붙여넣기 이미지 처리 실패:', e);
        });

        return true;
    };

    const handleDrop = (view: EditorView, event: DragEvent, moved: boolean) => {
        if (moved) return false;

        const files = Array.from(event.dataTransfer?.files ?? [])
            .filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return false;

        event.preventDefault();

        const dropCoords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        let currentInsertPos = dropCoords?.pos ?? view.state.doc.content.size;
        files.reduce(
            (chain, file) => chain.then(async () => {
                const insertedSize = await insertImageFile(view, file, currentInsertPos);
                currentInsertPos += insertedSize;
            }),
            Promise.resolve()
        ).catch((e: unknown) => {
            console.error('[TiptapEditor] 드래그&드롭 이미지 처리 실패:', e);
        });

        return true;
    };

    return {
        isDragOver,
        handleDOMEvents,
        handlePaste,
        handleDrop,
    };
};
