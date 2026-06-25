import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import type ReactQuillType from "react-quill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/services/imageUploadService";

const ReactQuillDynamic = dynamic(
  async () => {
    const { default: RQ } = await import("react-quill");
    const QuillWrapper = React.forwardRef<ReactQuillType, any>((props, ref) => {
      return <RQ ref={ref} {...props} />;
    });
    QuillWrapper.displayName = "QuillWrapper";
    return QuillWrapper;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 w-full items-center justify-center rounded-md border bg-gray-50 text-gray-400">
        A carregar editor...
      </div>
    ),
  },
);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const IMAGE_WIDTH_PRESETS = [160, 220, 280, 360];

function getImageWidth(image: HTMLImageElement): number | null {
  const widthAttribute = Number.parseInt(image.getAttribute("width") || "", 10);
  if (Number.isFinite(widthAttribute) && widthAttribute > 0) {
    return widthAttribute;
  }

  const inlineWidth = Number.parseInt(image.style.width || "", 10);
  if (Number.isFinite(inlineWidth) && inlineWidth > 0) {
    return inlineWidth;
  }

  const renderedWidth = Math.round(image.getBoundingClientRect().width);
  return renderedWidth > 0 ? renderedWidth : null;
}

function clampImageWidth(value: number): number {
  return Math.min(1200, Math.max(40, Math.round(value)));
}

export function RichTextEditor({ value, onChange, placeholder, autoFocus = false }: RichTextEditorProps) {
  const quillRef = useRef<ReactQuillType | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageWidthInput, setImageWidthInput] = useState("");

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleEditorChange = useCallback((content: string) => {
    onChangeRef.current(content);
  }, []);

  const clearSelectedImage = useCallback(() => {
    setSelectedImage(null);
    setImageWidthInput("");
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        clearSelectedImage();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [clearSelectedImage]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      if (quillRef.current && typeof quillRef.current.getEditor === "function") {
        const quill = quillRef.current.getEditor();
        if (quill) {
          quill.focus();
          const selectionIndex = Math.max(0, quill.getLength() - 1);
          quill.setSelection(selectionIndex, 0);
        }
      }
    }, 150);

    return () => window.clearTimeout(focusTimer);
  }, [autoFocus]);

  const syncEditorHtml = useCallback(() => {
    if (quillRef.current && typeof quillRef.current.getEditor === "function") {
      const quill = quillRef.current.getEditor();
      if (quill) {
        onChangeRef.current(quill.root.innerHTML);
      }
    }
  }, []);

  const focusSelectedImage = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image) {
        clearSelectedImage();
        return;
      }

      const width = getImageWidth(image);
      setSelectedImage(image);
      setImageWidthInput(width ? String(width) : "");
    },
    [clearSelectedImage],
  );

  const applyImageWidth = useCallback(
    (valueToApply: number | null) => {
      if (!selectedImage) {
        return;
      }

      if (valueToApply === null) {
        selectedImage.removeAttribute("width");
        selectedImage.removeAttribute("height");
        selectedImage.style.removeProperty("width");
        selectedImage.style.removeProperty("height");
        setImageWidthInput("");
      } else {
        const nextWidth = clampImageWidth(valueToApply);
        selectedImage.setAttribute("width", String(nextWidth));
        selectedImage.removeAttribute("height");
        selectedImage.style.width = `${nextWidth}px`;
        setImageWidthInput(String(nextWidth));
      }

      selectedImage.style.maxWidth = "100%";
      selectedImage.style.height = "auto";
      syncEditorHtml();
    },
    [selectedImage, syncEditorHtml],
  );

  const handleApplyCustomWidth = useCallback(() => {
    if (!imageWidthInput.trim()) {
      applyImageWidth(null);
      return;
    }

    const parsedWidth = Number.parseInt(imageWidthInput, 10);
    if (!Number.isFinite(parsedWidth)) {
      toast({
        title: "Largura inválida",
        description: "Introduza uma largura válida em píxeis.",
        variant: "destructive",
      });
      return;
    }

    applyImageWidth(parsedWidth);
  }, [applyImageWidth, imageWidthInput, toast]);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ color: [] }, { background: [] }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: function (this: any) {
            const quill = this.quill || (quillRef.current && typeof quillRef.current.getEditor === "function" ? quillRef.current.getEditor() : null);
            if (!quill) {
              return;
            }

            const input = document.createElement("input");
            input.setAttribute("type", "file");
            input.setAttribute("accept", "image/*");
            input.click();

            input.onchange = async () => {
              if (!input.files || !input.files[0]) {
                return;
              }

              const file = input.files[0];
              const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
              if (file.size > maxSizeBytes) {
                toast({
                  title: "Imagem muito grande",
                  description:
                    "A imagem não pode ter mais de 5MB. Por favor, escolha uma imagem mais pequena.",
                  variant: "destructive",
                });
                return;
              }

              toast({
                title: "A carregar imagem...",
                description: "Por favor aguarde um momento.",
              });

              try {
                // Upload the image to Supabase Storage (using profile bucket so it's handled as a user asset)
                const result = await uploadImage(file, "profile");

                if (result.success && result.url) {
                  const range = quill.getSelection(true);
                  const index = range ? range.index : quill.getLength();

                  quill.insertEmbed(index, "image", result.url);
                  quill.setSelection(index + 1);

                  window.setTimeout(() => {
                    const images = quill.root.querySelectorAll("img");
                    const insertedImage = images.item(images.length - 1);

                    if (insertedImage instanceof HTMLImageElement) {
                      focusSelectedImage(insertedImage);
                    }

                    syncEditorHtml();
                  }, 0);
                  
                  toast({
                    title: "Sucesso",
                    description: "Imagem carregada com sucesso.",
                  });
                } else {
                  throw new Error(result.error || "Erro desconhecido no upload.");
                }
              } catch (error: any) {
                console.error("Upload error:", error);
                toast({
                  title: "Erro no upload",
                  description: "Não foi possível carregar a imagem: " + (error.message || "Erro desconhecido"),
                  variant: "destructive",
                });
              }
            };
          },
        },
      },
    }),
    [focusSelectedImage, syncEditorHtml, toast],
  );

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;

    if (target instanceof HTMLImageElement) {
      focusSelectedImage(target);
      return;
    }

    if (target instanceof HTMLElement && target.closest("[data-image-resize-toolbar='true']")) {
      return;
    }

    if (target instanceof HTMLElement && target.closest(".ql-toolbar")) {
      return;
    }

    clearSelectedImage();
  };

  return (
    <div ref={containerRef} className="rich-text-editor-container" onClick={handleEditorClick}>
      {selectedImage && (
        <div
          data-image-resize-toolbar="true"
          className="mb-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-950">Tamanho da imagem</p>
              <p className="text-xs text-blue-800">
                Clique na assinatura e ajuste a largura antes de guardar ou enviar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {IMAGE_WIDTH_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={imageWidthInput === String(preset) ? "default" : "outline"}
                  onClick={() => applyImageWidth(preset)}
                >
                  {preset}px
                </Button>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => applyImageWidth(null)}>
                Original
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-[160px]">
              <label className="mb-1 block text-xs font-medium text-blue-900">Largura personalizada</label>
              <Input
                type="number"
                min="40"
                max="1200"
                value={imageWidthInput}
                onChange={(event) => setImageWidthInput(event.target.value)}
                placeholder="Ex: 260"
              />
            </div>
            <Button type="button" size="sm" onClick={handleApplyCustomWidth}>
              Aplicar largura
            </Button>
          </div>
        </div>
      )}

      <ReactQuillDynamic
        ref={quillRef as any}
        theme="snow"
        value={value}
        onChange={handleEditorChange}
        modules={modules}
        placeholder={placeholder || "Escreva aqui..."}
        className="min-h-[260px] rounded-md bg-white"
      />

      <style jsx global>{`
        .rich-text-editor-container {
          width: 100%;
        }
        .rich-text-editor-container .ql-editor {
          min-height: 200px;
          flex: 1;
          font-family: inherit;
          font-size: 1rem;
        }
        .rich-text-editor-container .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          border-color: #e2e8f0;
          background-color: #f8fafc;
        }
        .rich-text-editor-container .ql-container {
          display: flex;
          min-height: 220px;
          flex-direction: column;
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
          border-color: #e2e8f0;
          background-color: #ffffff;
        }
        .rich-text-editor-container .ql-editor img {
          max-width: 100%;
          border-radius: 0.375rem;
          height: auto;
        }
      `}</style>
    </div>
  );
}