// src/main/kotlin/com/knowledge/base/repository/ArticleViewHitRepository.kt
package com.knowledge.base.repository

import com.knowledge.base.model.ArticleViewHit
import org.springframework.data.jpa.repository.JpaRepository

interface ArticleViewHitRepository : JpaRepository<ArticleViewHit, Long> {
    fun existsByArticleIdAndAccessJti(articleId: Long, accessJti: String): Boolean
}
