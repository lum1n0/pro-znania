// src/component/CategorySelectorTree.jsx
import React, { useState } from 'react';
import right from "../assets/right.svg";
import down from "../assets/down.svg";
import '../style/CreateArticlePage.css'; // Импортируем стили, так как они там определены

// Предполагается, что deltaToHtml определена глобально или импортирована
// Если нет, определите её здесь или импортируйте
const deltaToHtml = (delta) => {
  if (typeof delta === 'object' && delta.ops) {
    return delta.ops.map(op => typeof op.insert === 'string' ? op.insert : '').join('');
  } else if (typeof delta === 'string') {
    try {
      const parsed = JSON.parse(delta);
      return deltaToHtml(parsed);
    } catch {
      return delta;
    }
  }
  return '';
};

const CategorySelectorTree = ({ categories, selectedCategoryId, onSelect, disabled = false }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Функция для построения дерева категорий
  const buildTree = (categoriesList) => {
    const map = {};
    const roots = [];
    categoriesList.forEach(cat => {
      // Убедимся, что у нас есть поле description, если его нет, используем fallback
      const description = cat.description || cat.name || `Категория ${cat.id}`;
      map[cat.id] = { ...cat, description, children: [] };
    });
    categoriesList.forEach(cat => {
      const node = map[cat.id];
      if (cat.parentId) {
        const parent = map[cat.parentId];
        if (parent) {
          parent.children.push(node);
        } else {
          // Если родитель не найден, делаем корневым
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const tree = buildTree(categories);

  // Рекурсивный компонент для отображения узла дерева
  const TreeNode = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedCategoryId === String(node.id);
    const isExpanded = expandedNodes.has(node.id);
    const paddingLeft = `${level * 20 + 10}px`;

    const toggleExpand = (e) => {
        e.stopPropagation(); // Предотвращаем выбор категории при клике на иконку
        const newExpanded = new Set(expandedNodes);
        if (isExpanded) {
        newExpanded.delete(node.id);
        } else {
        newExpanded.add(node.id);
        }
        setExpandedNodes(newExpanded);
    };

    return (
      <div className="category-tree-node">
        <div
          className={`category-item-selector ${isSelected ? 'selected' : ''}`}
          onClick={() => !disabled && onSelect(String(node.id))}
          style={{ paddingLeft, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <span className="category-item-toggle" onClick={toggleExpand} style={{ cursor: 'pointer' }}>
            {hasChildren ? (
              isExpanded ? 
                <img src={down} alt="Свернуть" style={{ width: 16, height: 16 }} /> : 
                <img src={right} alt="Развернуть" style={{ width: 16, height: 16 }} />
            ) : (
              <span style={{ width: 16, height: 16, display: 'inline-block' }}></span>
            )}
          </span>
          <span className="category-item-folder" style={{ marginLeft: '5px', marginRight: '5px' }}>
            📁
          </span>
          <span className="category-item-name">{node.description}</span>
        </div>
        {hasChildren && (
          <div className={`category-children ${isExpanded ? 'expanded' : 'collapsed'}`}>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="category-tree">
      {tree.length > 0 ? (
        tree.map(rootNode => (
          <TreeNode key={rootNode.id} node={rootNode} />
        ))
       ) : (
        <div className="info-message">Нет доступных категорий</div>
       )}
    </div>
  );
};

export default CategorySelectorTree;