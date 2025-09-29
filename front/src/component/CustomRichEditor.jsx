import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { articleAPI } from '../api/apiServese';
import { ApiClient } from '../api/apiClient';
import '../style/CustomRichEditor.css';
import table from '../assets/table.svg'
import img from '../assets/image.svg'
import high from '../assets/high_index.svg'
import low from '../assets/low_index.svg'
import strikethrough from '../assets/strikethrough.svg'
import Underline from '../assets/Underline.svg'
import removeFormat from '../assets/removeFormat.svg'
import quote from '../assets/quote.svg'
import bold from '../assets/bold.svg'

const BASE_URL = ApiClient.defaults.baseURL || '';

const allowedPurifyConfig = {
  ALLOWED_TAGS: [
    'a', 'abbr', 'b', 'blockquote', 'br', 'cite', 'code', 'div', 'em', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'u', 'ul',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'figure', 'figcaption'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'id', 'name', 'class', 'style', 'src', 'width', 'height', 'rowspan', 'colspan', 'align', 'title', 'alt'
  ],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'style'],
  RETURN_TRUSTED_TYPE: false
};

// Дополнительная конфигурация для разрешения base64 изображений
const pastePurifyConfig = {
  ...allowedPurifyConfig,
  ADD_TAGS: ['img'],
  ADD_ATTR: ['src'],
  ALLOW_DATA_ATTR: true,
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: /^(img)$/i,
    attributeNameCheck: /^(src|alt|style|width|height)$/i,
    allowCustomizedBuiltInElements: true
  }
};

const btnTitle = {
  bold: 'Полужирный (Ctrl+B)',
  italic: 'Курсив (Ctrl+I)',
  underline: 'Подчёркивание (Ctrl+U)',
  strikeThrough: 'Зачёркивание',
  foreColor: 'Цвет текста',
  fontSize: 'Размер шрифта',
  justifyLeft: 'По левому краю',
  justifyCenter: 'По центру',
  justifyRight: 'По правому краю',
  justifyFull: 'По ширине',
  insertOrderedList: 'Нумерованный список',
  insertUnorderedList: 'Маркированный список',
  link: 'Вставить ссылку',
  image: 'Вставить изображение',
  table: 'Вставить таблицу',
  hr: 'Горизонтальная линия',
  blockquote: 'Цитата',
  code: 'Код',
  superscript: 'Верхний индекс',
  subscript: 'Нижний индекс',
  removeFormat: 'Очистить форматирование',
};

// Иконки в стиле Word
const Icons = {
  Bold: (
    <img src={bold} alt="" />
  ),
  Italic: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 3v1h2.3l-1.7 8H4v1h4v-1H5.7l1.7-8H10V3H6z" />
    </svg>
  ),
  Underline: (
    <img src={Underline} width="16" height="16" alt="" />
  ),
  Strike: (
    <img src={strikethrough} width="16" height="16" alt="" />
  ),
  AlignLeft: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3v1h12V3H2zm0 3v1h12V6H2zm0 3v1h12V9H2zm0 3v1h12v-1H2z" />
    </svg>
  ),
  AlignCenter: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3v1h12V3H2zm2 3v1h8V6H4zm-2 3v1h12V9H2zm2 3v1h8v-1H4z" />
    </svg>
  ),
  AlignRight: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3v1h12V3H2zm4 3v1h8V6H6zm-4 3v1h12V9H2zm4 3v1h8v-1H6z" />
    </svg>
  ),
  AlignJustify: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3v1h12V3H2zm0 3v1h12V6H2zm0 3v1h12V9H2zm0 3v1h12v-1H2z" />
    </svg>
  ),
  ListOl: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3v1h1v-1H3zm2 0v1h9V3H5zm-2 3v1h1V6H3zm2 0v1h9V6H5zm-2 3v1h1V9H3zm2 0v1h9V9H5zm-2 3v1h1v-1H3zm2 0v1h9v-1H5z" />
    </svg>
  ),
  ListUl: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 4c0-.6.4-1 1-1s1 .4 1 1-.4 1-1 1-1-.4-1-1zm0 4c0-.6.4-1 1-1s1 .4 1 1-.4 1-1 1-1-.4-1-1zm0 4c0-.6.4-1 1-1s1 .4 1 1-.4 1-1 1-1-.4-1-1zm3-8v1h9V3H6zm0 4v1h9V7H6zm0 4v1h9v-1H6z" />
    </svg>
  ),
  Link: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.9 10.1l1.4-1.4c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0L3.8 9.4c-.8.8-.8 2 0 2.8.8.8 2 .8 2.8 0l.7-.7.7.7-.7.7c-1.2 1.2-3.1 1.2-4.2 0-1.2-1.2-1.2-3.1 0-4.2l2.1-2.1c1.2-1.2 3.1-1.2 4.2 0 .6.6.9 1.4.9 2.2 0 .8-.3 1.6-.9 2.2l-1.4 1.4zm4.2-4.2l-1.4 1.4c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l2.1-2.1c.8-.8.8-2 0-2.8-.8-.8-2-.8-2.8 0l-.7.7-.7-.7.7-.7c1.2-1.2 3.1-1.2 4.2 0 1.2 1.2 1.2 3.1 0 4.2l-2.1 2.1c-1.2 1.2-3.1 1.2-4.2 0-.6-.6-.9-1.4-.9-2.2 0-.8.3-1.6.9-2.2l1.4-1.4z" />
    </svg>
  ),
  Image: (
    <img src={img} alt="" />
  ),
  Table: (
    <img src={table} alt="" />
  ),
  HR: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 8v1h12V8H2z" />
    </svg>
  ),
  Blockquote: (
    <img src={quote} alt="" />
  ),
  Code: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 4l-3 4 3 4 1-1-2-3 2-3-1-1zm6 0l-1 1 2 3-2 3 1 1 3-4-3-4z" />
    </svg>
  ),
  Superscript: (
    <img src={high} width="16" height="16" alt="" />
  ),
  Subscript: (
    <img src={low} width="16" height="16" alt="" />
  ),
  RemoveFormat: (
    <img src={removeFormat} alt="" />
  ),
};

export default function CustomRichEditor({ value, onChange, placeholder = 'Введите текст...', disabled = false }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const tableButtonRef = useRef(null);
  const fontSizeRef = useRef(null);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [fontSize, setFontSize] = useState('16');
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 0, cols: 0 });
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tableButtonRef.current && !tableButtonRef.current.contains(e.target) &&
        !e.target.closest('.cre-table-dropdown')) {
        setShowTableMenu(false);
      }
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target) &&
        !e.target.closest('.cre-font-size-dropdown')) {
        setShowFontSizeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    // Обрабатываем входящее значение правильно
    let initialHtml = '';
    if (typeof value === 'string') {
      initialHtml = value;
    } else if (value && typeof value === 'object' && value.html !== undefined) {
      initialHtml = value.html === null ? '' : String(value.html);
    }

    const safe = DOMPurify.sanitize(initialHtml || '', allowedPurifyConfig);
    if (el.innerHTML !== safe) el.innerHTML = safe;
  }, [value]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
          case 'B':
            e.preventDefault();
            applyExec('bold');
            break;
          case 'i':
          case 'I':
            e.preventDefault();
            applyExec('italic');
            break;
          case 'u':
          case 'U':
            e.preventDefault();
            applyExec('underline');
            break;
          default:
            break;
        }
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('keydown', handleKeyDown);
      return () => editor.removeEventListener('keydown', handleKeyDown);
    }
  }, [disabled]);

  const focusEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
  };

  const applyExec = (cmd, val = null) => {
    if (disabled) return;
    focusEditor();
    document.execCommand(cmd, false, val);
    emitChange();
  };

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = DOMPurify.sanitize(el.innerHTML, allowedPurifyConfig);
    // ВАЖНО: Отправляем ТОЛЬКО строку HTML, а не объект
    onChange?.(sanitized);
  };

  const handleInput = () => {
    emitChange();
  };

  const handlePaste = async (e) => {
    e.preventDefault();

    // Получаем данные из буфера обмена
    const clipboardData = e.clipboardData || window.clipboardData;

    // Проверяем наличие HTML данных
    if (clipboardData.types.includes('text/html')) {
      const html = clipboardData.getData('text/html');
      if (html) {
        // Очищаем HTML с разрешением base64 изображений
        const cleaned = DOMPurify.sanitize(html, pastePurifyConfig);
        applyExec('insertHTML', cleaned);
        return;
      }
    }

    // Если HTML нет, пробуем текст
    const text = clipboardData.getData('text/plain');
    if (text) {
      applyExec('insertHTML', text.replace(/\n/g, '<br>'));
      return;
    }

    // Если есть файлы (например, изображения)
    if (clipboardData.files && clipboardData.files.length > 0) {
      const file = clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        await handleImageFile(file);
        return;
      }
    }
  };

  // Функция для определения активного состояния blockquote
  const isBlockquoteActive = () => {
    if (disabled) return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    
    // Проверяем, находится ли курсор/выделение внутри blockquote
    const parentElement = commonAncestor.nodeType === 3 
      ? commonAncestor.parentElement 
      : commonAncestor;
    
    const closestBlockquote = parentElement.closest('blockquote');
    return closestBlockquote !== null;
  };

  const applyColor = (color) => {
    setCurrentColor(color);
    applyExec('foreColor', color);
  };

  // Обновленная функция applyFontSize для сохранения точного размера в px
  const applyFontSize = (size) => {
    setFontSize(size);
    
    if (disabled) return;
    focusEditor();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
      // Если ничего не выделено, создаем span с font-size
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      // Добавляем невидимый символ, чтобы span не был пустым
      span.appendChild(document.createTextNode('\u200B')); 
      range.insertNode(span);
      
      // Устанавливаем курсор после символа
      const newRange = document.createRange();
      newRange.setStart(span.firstChild, 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      // Если есть выделение, оборачиваем его в span с font-size
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      range.surroundContents(span);
      
      // Устанавливаем выделение на обернутый контент
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    
    emitChange();
    setShowFontSizeDropdown(false);
  };

  const insertLink = () => {
    if (disabled) return;
    const url = prompt('Введите URL (https://...)', 'https://');
    if (!url) return;
    const blank = confirm('Открывать в новой вкладке?');
    focusEditor();
    if (blank) {
      const sel = window.getSelection();
      const text = sel && !sel.isCollapsed ? sel.toString() : url;
      const html = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      applyExec('insertHTML', html);
    } else {
      applyExec('createLink', url);
    }
  };

  const insertAnchor = () => {
    if (disabled) return;
    const id = prompt('Введите идентификатор якоря (латиница/цифры/дефисы):', 'yakor-1');
    if (!id) return;
    const html = `<a id="${id}"></a>`;
    applyExec('insertHTML', html);
  };

  const handleTableHover = (rows, cols) => {
    setTableSize({ rows, cols });
  };

  const insertTable = (rows, cols) => {
    if (disabled || !rows || !cols || rows < 1 || cols < 1) return;
    setShowTableMenu(false);

    let html = '<figure class="table"><table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td>&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></figure>';
    
    if (disabled) return;
    focusEditor();
    
    const editor = editorRef.current;
    if (!editor) return;
    
    // Вставляем таблицу в конец содержимого
    const selection = window.getSelection();
    const range = document.createRange();
    
    // Устанавливаем диапазон в конец редактора
    range.selectNodeContents(editor);
    range.collapse(false); // false означает конец контента
    
    // Вставляем таблицу
    const tableWrapper = document.createElement('div');
    tableWrapper.innerHTML = html;
    const tableElement = tableWrapper.firstChild;
    
    range.insertNode(tableElement);
    
    // Перемещаем курсор после таблицы
    range.setStartAfter(tableElement);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    emitChange();
  };

  const onPickImageFile = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  // Обработчик для загрузки изображения
  const handleImageFile = async (file) => {
    if (!file) return;

    try {
      // Если это base64 данные или локальный файл, загружаем на сервер
      if (file.type.startsWith('image/')) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await articleAPI.uploadImage(fd);
        const url = res.data?.url || '';
        const absolute = url.startsWith('http') ? url : `${BASE_URL}${url}`;
        const html = `<img src="${absolute}" alt="image" style="max-width: 100%; height: auto;" />`;
        applyExec('insertHTML', html);
      }
    } catch (err) {
      console.error('Ошибка загрузки изображения:', err);
      // Если загрузка не удалась, вставляем как base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const html = `<img src="${e.target.result}" alt="image" style="max-width: 100%; height: auto;" />`;
        applyExec('insertHTML', html);
      };
      reader.readAsDataURL(file);
    }
  };

  const onImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    await handleImageFile(file);
  };

  // Функция для определения активного состояния кнопки форматирования
  const isFormatActive = (format) => {
    if (disabled) return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const parentElement = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
    return document.queryCommandState(format) || parentElement.closest(format) !== null;
  };

  // Размеры шрифта от 8px до 36px
  const fontSizes = [
    { value: '8', label: '8px' },
    { value: '10', label: '10px' },
    { value: '12', label: '12px' },
    { value: '14', label: '14px' },
    { value: '16', label: '16px' },
    { value: '18', label: '18px' },
    { value: '20', label: '20px' },
    { value: '24', label: '24px' },
    { value: '28', label: '28px' },
    { value: '32', label: '32px' },
    { value: '36', label: '36px' }
  ];

  return (
    <div className="cre-root glass-container">
      <div className="cre-toolbar glass-toolbar">
        {/* Блок форматирования текста */}
        <div className="cre-toolbar-group">
          <button
            type="button"
            title={btnTitle.bold}
            onClick={() => applyExec('bold')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('bold') ? 'active' : ''}`}
          >
            {Icons.Bold}
          </button>
          <button
            type="button"
            title={btnTitle.italic}
            onClick={() => applyExec('italic')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('italic') ? 'active' : ''}`}
          >
            {Icons.Italic}
          </button>
          <button
            type="button"
            title={btnTitle.underline}
            onClick={() => applyExec('underline')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('underline') ? 'active' : ''}`}
          >
            {Icons.Underline}
          </button>
          <button
            type="button"
            title={btnTitle.strikeThrough}
            onClick={() => applyExec('strikeThrough')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('strikeThrough') ? 'active' : ''}`}
          >
            {Icons.Strike}
          </button>
        </div>

        <div className="cre-sep" />

        {/* Блок размера шрифта */}
        <div className="cre-toolbar-group" ref={fontSizeRef}>
          <button
            type="button"
            title={btnTitle.fontSize}
            onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
            disabled={disabled}
            className="cre-btn cre-dropdown-btn"
          >
            <span className="cre-font-size-label">{fontSize}px</span>
            <span className="cre-dropdown-arrow">▼</span>
          </button>

          {showFontSizeDropdown && (
            <div className="cre-font-size-dropdown glass-dropdown">
              {fontSizes.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  className="cre-font-size-option"
                  onClick={() => applyFontSize(size.value)}
                >
                  {size.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cre-sep" />

        {/* Блок выравнивания */}
        <div className="cre-toolbar-group">
          <button
            type="button"
            title={btnTitle.justifyLeft}
            onClick={() => applyExec('justifyLeft')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('justifyLeft') ? 'active' : ''}`}
          >
            {Icons.AlignLeft}
          </button>
          <button
            type="button"
            title={btnTitle.justifyCenter}
            onClick={() => applyExec('justifyCenter')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('justifyCenter') ? 'active' : ''}`}
          >
            {Icons.AlignCenter}
          </button>
          <button
            type="button"
            title={btnTitle.justifyRight}
            onClick={() => applyExec('justifyRight')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('justifyRight') ? 'active' : ''}`}
          >
            {Icons.AlignRight}
          </button>
          <button
            type="button"
            title={btnTitle.justifyFull}
            onClick={() => applyExec('justifyFull')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('justifyFull') ? 'active' : ''}`}
          >
            {Icons.AlignJustify}
          </button>
        </div>

        <div className="cre-sep" />

        {/* Блок списков */}
        <div className="cre-toolbar-group">
          <button
            type="button"
            title={btnTitle.insertOrderedList}
            onClick={() => applyExec('insertOrderedList')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('insertOrderedList') ? 'active' : ''}`}
          >
            {Icons.ListOl}
          </button>
          <button
            type="button"
            title={btnTitle.insertUnorderedList}
            onClick={() => applyExec('insertUnorderedList')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('insertUnorderedList') ? 'active' : ''}`}
          >
            {Icons.ListUl}
          </button>
        </div>

        <div className="cre-sep" />

        {/* Блок других элементов */}
        <div className="cre-toolbar-group">
          <button
            type="button"
            title={btnTitle.link}
            onClick={insertLink}
            disabled={disabled}
            className="cre-btn"
          >
            {Icons.Link}
          </button>
          <button
            type="button"
            title={btnTitle.image}
            onClick={onPickImageFile}
            disabled={disabled}
            className="cre-btn"
          >
            {Icons.Image}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="cre-hidden"
            onChange={onImageFileChange}
          />

          <div className="cre-table-wrapper" ref={tableButtonRef}>
            <button
              type="button"
              title={btnTitle.table}
              onClick={() => setShowTableMenu(!showTableMenu)}
              disabled={disabled}
              className={`cre-btn ${showTableMenu ? 'active' : ''}`}
            >
              {Icons.Table}
            </button>

            {showTableMenu && (
              <div className="cre-table-dropdown glass-dropdown">
                <div className="cre-table-grid">
                  {Array.from({ length: 8 }, (_, row) => (
                    <div key={row} className="cre-table-row">
                      {Array.from({ length: 8 }, (_, col) => (
                        <div
                          key={col}
                          className={`cre-table-cell ${row < tableSize.rows && col < tableSize.cols ? 'active' : ''
                            }`}
                          onMouseEnter={() => handleTableHover(row + 1, col + 1)}
                          onClick={() => insertTable(row + 1, col + 1)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="cre-table-size">
                  {tableSize.rows} × {tableSize.cols}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="cre-sep" />

        {/* Блок дополнительных функций */}
        <div className="cre-toolbar-group">
          <button
            type="button"
            title={btnTitle.blockquote}
            onClick={() => {
              if (disabled) return;
              focusEditor();
              
              if (isBlockquoteActive()) {
                // Удаляем форматирование цитаты
                document.execCommand('formatBlock', false, '<div>');
              } else {
                // Применяем форматирование цитаты
                document.execCommand('formatBlock', false, '<blockquote>');
              }
              emitChange(); // Обязательно уведомляем о изменении
            }}
            disabled={disabled}
            className={`cre-btn ${isBlockquoteActive() ? 'active' : ''}`}
          >
            {Icons.Blockquote}
          </button>

          <button
            type="button"
            title={btnTitle.superscript}
            onClick={() => applyExec('superscript')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('superscript') ? 'active' : ''}`}
          >
            {Icons.Superscript}
          </button>

          <button
            type="button"
            title={btnTitle.subscript}
            onClick={() => applyExec('subscript')}
            disabled={disabled}
            className={`cre-btn ${isFormatActive('subscript') ? 'active' : ''}`}
          >
            {Icons.Subscript}
          </button>
          <button
            type="button"
            title={btnTitle.removeFormat}
            onClick={() => applyExec('removeFormat')}
            disabled={disabled}
            className="cre-btn"
          >
            {Icons.RemoveFormat}
          </button>
        </div>
      </div>

      <div
        ref={editorRef}
        className="cre-editor glass-editor"
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}