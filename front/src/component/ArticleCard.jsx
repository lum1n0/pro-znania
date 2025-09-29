import React from 'react';
import "../style/ArticleCard.css"
import { Link } from 'react-router-dom';

const deltaToHtml = (delta) => {
  if (!delta || !Array.isArray(delta.ops)) return '';

  let html = '';

  delta.ops.forEach(op => {
    if (typeof op.insert === 'string') {
      let text = op.insert;
      html += text;
    }
  });

  return html;
};

const stripHtmlTags = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const truncateText = (text, maxLength = 120) => {
  if (!text) return '';
  const cleanText = text.trim();
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substring(0, maxLength) + '...';
};

const getTextFromDelta = (delta) => {
  if (!delta) return '';
  
  // Если delta уже объект с ops
  if (typeof delta === 'object' && delta.ops) {
    const html = deltaToHtml(delta);
    const text = stripHtmlTags(html);
    return truncateText(text);
  }
  
  // Если delta - строка (уже HTML)
  if (typeof delta === 'string') {
    const text = stripHtmlTags(delta);
    return truncateText(text);
  }
  
  return '';
};

const ArticleCard = ({ article }) => {
  const imageUrl = article.imageUrl || '/images/default-article.jpg';

  return (
    <Link to={`/article/${article.id}`} className="knowledgehub-article-card-link">
      <article className="knowledgehub-article-tile">
        <div className="knowledgehub-article-content-body">
          <h3 className="knowledgehub-article-heading">{article.title}</h3>
          <p className="knowledgehub-article-excerpt-preview">
            {getTextFromDelta(article.description)}
          </p>
          <div className="knowledgehub-article-footer-bar">
            <span className="knowledgehub-article-read-action">Читать далее →</span>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default ArticleCard;