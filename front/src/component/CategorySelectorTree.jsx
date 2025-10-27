
// src/component/CategorySelectorTree.jsx
import React, { useState, useEffect } from 'react';
import right from "../assets/right.svg";
import down from "../assets/down.svg";
import '../style/CreateArticlePage.css';
import {Folder} from "lucide-react";
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
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        return { roots, map };
    };

    // Функция для поиска пути к категории
    const findPathToCategory = (categoryId, categoriesMap) => {
        const path = [];
        let currentId = categoryId;

        // Преобразуем categoryId в число для корректного сравнения
        if (typeof currentId === 'string') {
            currentId = parseInt(currentId, 10);
        }

        while (currentId) {
            const category = categoriesMap[currentId];
            if (!category) break;

            path.unshift(currentId);
            currentId = category.parentId;
        }

        return path;
    };

    const { roots: tree, map: categoriesMap } = buildTree(categories);

    // Автоматически раскрываем путь к выбранной категории
    useEffect(() => {
        if (selectedCategoryId && categoriesMap) {
            // Преобразуем selectedCategoryId в число для корректного поиска
            const numericId = typeof selectedCategoryId === 'string'
                ? parseInt(selectedCategoryId, 10)
                : selectedCategoryId;

            if (categoriesMap[numericId]) {
                const path = findPathToCategory(numericId, categoriesMap);

                // Раскрываем все родительские категории (кроме самой выбранной)
                setExpandedNodes(prevExpanded => {
                    const newExpanded = new Set(prevExpanded);
                    path.forEach(categoryId => {
                        if (categoryId !== numericId) {
                            newExpanded.add(categoryId);
                        }
                    });
                    return newExpanded;
                });
            }
        }
    }, [selectedCategoryId, categories]);

    // Рекурсивный компонент для отображения узла дерева
    const TreeNode = ({ node, level = 0 }) => {
        const hasChildren = node.children && node.children.length > 0;
        const isSelected = selectedCategoryId === String(node.id);
        const isExpanded = expandedNodes.has(node.id);
        const paddingLeft = `${level * 20 + 10}px`;

        const toggleExpand = (e) => {
            e.stopPropagation();
            setExpandedNodes(prevExpanded => {
                const newExpanded = new Set(prevExpanded);
                if (isExpanded) {
                    newExpanded.delete(node.id);
                } else {
                    newExpanded.add(node.id);
                }
                return newExpanded;
            });
        };

        const handleSelect = () => {
            if (!disabled) {
                onSelect(String(node.id));
            }
        };

        return (
            <div key={node.id}>
                <div
                    className={`category-tree-item ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                    style={{ paddingLeft }}
                    onClick={handleSelect}
                >
                    {hasChildren && (
                        <img
                            src={isExpanded ? down : right}
                            alt={isExpanded ? 'Свернуть' : 'Развернуть'}
                            className="category-tree-icon"
                            onClick={toggleExpand}
                        />
                    )}
                    {!hasChildren && <span className="category-tree-spacer"></span>}
                    <span className="category-item-folder" style={{ marginLeft: '5px', marginRight: '5px' }}>
                        📁
                      </span>
                    <span className="category-tree-description">
            {deltaToHtml(node.description)}
          </span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="category-tree-children">
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
            {tree.map(node => (
                <TreeNode key={node.id} node={node} level={0} />
            ))}
        </div>
    );
};

export default CategorySelectorTree;
