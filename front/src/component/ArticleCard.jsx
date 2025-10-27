import React, { useEffect, useState } from 'react';
import '../style/ArticleCard.css';
import { Link } from 'react-router-dom';
import { profileAPI } from '../api/apiServese';
// Импорты для FontAwesome - звезды
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';

const deltaToHtml = (delta) => {
    if (!delta || !Array.isArray(delta.ops)) return '';
    let html = '';
    delta.ops.forEach(op => { if (typeof op.insert === 'string') html += op.insert; });
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
    return cleanText.length <= maxLength ? cleanText : cleanText.substring(0, maxLength) + '...';
};

const getTextFromDelta = (delta) => {
    if (!delta) return '';
    if (typeof delta === 'object' && delta.ops) return truncateText(stripHtmlTags(deltaToHtml(delta)));
    if (typeof delta === 'string') return truncateText(stripHtmlTags(delta));
    return '';
};

// Кэш избранного
const FAVORITES_CACHE_KEY = 'favoriteIds';
const readFavoriteIds = () => {
    try {
        const raw = localStorage.getItem(FAVORITES_CACHE_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        return Array.isArray(arr) ? arr : null;
    } catch {
        return null;
    }
};

const writeFavoriteIds = (ids) => {
    try {
        localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(Array.from(new Set(ids))));
    } catch {}
};

// Простая мемоизация, чтобы не дергать API многократно на сетке карточек
let favoritesLoadPromise = null;
const ensureFavoritesLoaded = async () => {
    const cached = readFavoriteIds();
    if (cached) return cached;
    if (!favoritesLoadPromise) {
        favoritesLoadPromise = profileAPI.getFavorites()
            .then(resp => {
                const ids = Array.isArray(resp.data) ? resp.data.map(f => Number(f.article?.id)).filter(Boolean) : [];
                writeFavoriteIds(ids);
                return ids;
            })
            .catch(() => [])
            .finally(() => { favoritesLoadPromise = null; });
    }
    return favoritesLoadPromise;
};

export default function ArticleCard({ article }) {
    const [favPending, setFavPending] = useState(false);
    const [added, setAdded] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!article?.id) return;
            try {
                const ids = await ensureFavoritesLoaded();
                if (mounted) setAdded(ids.includes(Number(article.id)));
            } catch { if (mounted) setAdded(false); }
        })();
        return () => { mounted = false; };
    }, [article?.id]);

    const stopLinkEarly = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const toggleFavorite = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!article?.id || favPending) return;
        setFavPending(true);
        const id = Number(article.id);
        const current = readFavoriteIds() || [];
        try {
            if (added) {
                await profileAPI.removeFavorite(id);
                writeFavoriteIds(current.filter(x => x !== id));
                setAdded(false);
            } else {
                await profileAPI.addFavorite(id);
                writeFavoriteIds([...current, id]);
                setAdded(true);
            }
        } catch (err) {
            console.error('Ошибка переключения избранного:', err);
        } finally {
            setFavPending(false);
        }
    };

    return (
        <Link className="knowledgehub-article-card-link" to={`/article/${article.id}`}>
            <article className="knowledgehub-article-tile">
                <div className="knowledgehub-article-content-body">

                    <div className="title_and_pinned">
                        <h3 className="knowledgehub-article-heading">
                            {article.title}
                        </h3>
                        <div className="knowledgehub-article-footer-bar">
                            <button
                                type="button"
                                className={`article-card__btn article-card__star-btn ${added ? 'is-favorite' : ''}`}
                                onMouseDown={stopLinkEarly}
                                onClick={toggleFavorite}
                                disabled={favPending}
                                title={added ? "Убрать из избранного" : "Добавить в избранное"}
                                aria-pressed={added}
                            >
                                {favPending ? (
                                    <span className="article-card__loading">...</span>
                                ) : (
                                    <FontAwesomeIcon
                                        icon={added ? faStarSolid : faStarRegular}
                                        className="article-card__star-icon"
                                    />
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="knowledgehub-article-excerpt-preview">
                        {getTextFromDelta(article.description)}
                    </p>

                </div>
            </article>
        </Link>
    );
}
