import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './quotation-builder.css';

const modules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
  ],
};

const formats = ['bold', 'italic', 'underline', 'list', 'bullet'];

export default function QuotationRichTextEditor({ value, onChange, placeholder }) {
  return (
    <ReactQuill
      className="quotation-rich-editor"
      theme="snow"
      value={value || ''}
      onChange={onChange}
      modules={modules}
      formats={formats}
      placeholder={placeholder}
    />
  );
}
