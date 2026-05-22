import React, { useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import { useToast } from '@/hooks/use-toast';
import type ReactQuillType from 'react-quill';

// Dynamically import ReactQuill and forward the ref properly to prevent SSR issues and TypeScript errors
const ReactQuillDynamic = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill');
    const QuillWrapper = React.forwardRef<ReactQuillType, any>((props, ref) => {
      return <RQ ref={ref} {...props} />;
    });
    QuillWrapper.displayName = 'QuillWrapper';
    return QuillWrapper;
  },
  { 
    ssr: false,
    loading: () => <div className="h-40 w-full flex items-center justify-center border rounded-md bg-gray-50 text-gray-400">A carregar editor...</div>
  }
);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const quillRef = useRef<any>(null);
  const { toast } = useToast();

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: function(this: any) {
          const quill = this.quill || quillRef.current?.getEditor();
          if (!quill) return;

          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();

          input.onchange = async () => {
            if (input.files && input.files[0]) {
              const file = input.files[0];
              
              // Strict file size limit to prevent server bloating (Max 1MB)
              const maxSizeBytes = 1 * 1024 * 1024; // 1MB
              if (file.size > maxSizeBytes) {
                toast({
                  title: "Imagem muito grande",
                  description: "Para poupar espaço no servidor e nos emails dos clientes, a imagem não pode ter mais de 1MB. Por favor, redimensione-a e tente novamente.",
                  variant: "destructive"
                });
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                const base64String = reader.result as string;
                
                // Safely get index even if editor lost focus during file selection
                const range = quill.getSelection(true);
                const index = range ? range.index : quill.getLength();
                
                quill.insertEmbed(index, 'image', base64String);
                quill.setSelection(index + 1);
              };
              reader.onerror = () => {
                toast({
                  title: "Erro",
                  description: "Não foi possível ler a imagem.",
                  variant: "destructive"
                });
              };
              reader.readAsDataURL(file);
            }
          };
        }
      }
    }
  }), []);

  return (
    <div className="rich-text-editor-container">
      <ReactQuillDynamic 
        ref={quillRef}
        theme="snow" 
        value={value} 
        onChange={onChange} 
        modules={modules}
        placeholder={placeholder || "Escreva aqui..."}
        className="bg-white rounded-md"
      />
      <style jsx global>{`
        .rich-text-editor-container .ql-editor {
          min-height: 200px;
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
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
          border-color: #e2e8f0;
        }
        .rich-text-editor-container .ql-editor img {
          max-width: 100%;
          border-radius: 0.375rem;
        }
      `}</style>
    </div>
  );
}