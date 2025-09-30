// src/main/kotlin/com/knowledge/base/service/ModerationService.kt
package com.knowledge.base.service

import com.fasterxml.jackson.databind.JsonNode
import com.knowledge.base.dto.ArticleProposalDto
import com.knowledge.base.dto.ArticleDto
import com.knowledge.base.mapper.ArticleMapper
import com.knowledge.base.model.Article
import com.knowledge.base.model.ArticleProposal
import com.knowledge.base.model.ModerationStatus
import com.knowledge.base.repository.*
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.Instant

@Service
class ModerationService(
    private val articleRepository: ArticleRepository,
    private val articleProposalRepository: ArticleProposalRepository,
    private val categoryRepository: CategoryRepository,
    private val userRepository: UserRepository,
    private val writerPermissionService: WriterPermissionService,
    private val fileStorageService: FileStorageService,
    private val indexingService: IndexingService,
    private val articleVersionService: ArticleVersionService
) {

    private fun toDto(p: ArticleProposal) = ArticleProposalDto(
        id = p.id,
        articleId = p.articleId,
        title = p.title,
        description = p.description,
        categoryId = p.categoryId,
        videoPath = p.videoPath,
        filePath = p.filePath,
        authorId = p.authorId,
        authorEmail = p.authorEmail,
        authorName = p.authorName,
        status = p.status,
        reviewedById = p.reviewedById,
        reviewedByEmail = p.reviewedByEmail,
        reviewedByName = p.reviewedByName,
        reviewedAt = p.reviewedAt,
        rejectReason = p.rejectReason,
        action = p.action,
        createdAt = p.createdAt
    )

    @Transactional
    fun submitCreate(
        currentUserEmail: String,
        title: String,
        description: JsonNode?,
        categoryId: Long,
        videoFile: MultipartFile?,
        files: List<MultipartFile>?
    ): ArticleProposalDto {
        val user = userRepository.findByEmail(currentUserEmail) ?: throw AccessDeniedException("Forbidden")
        val category = categoryRepository.findById(categoryId).orElseThrow { IllegalArgumentException("Категория не найдена") }

        // WRITER должен иметь право редактировать эту категорию
        when (user.role.title) {
            "ADMIN", "MODERATOR" -> throw AccessDeniedException("Для ADMIN/MODERATOR публикация идёт напрямую, без заявок")
            "WRITER" -> {
                val allowed = writerPermissionService.checkWriterCanEditCategory(user.id, category)
                if (!allowed) throw AccessDeniedException("Forbidden")
            }
            else -> throw AccessDeniedException("Forbidden")
        }

        val storedVideo = videoFile?.let { listOf(fileStorageService.saveFile(it, "videos")) }
        val storedFiles = files?.map { fileStorageService.saveFile(it, "files") }

        val proposal = articleProposalRepository.save(
            ArticleProposal(
                articleId = null,
                title = title,
                description = description,
                categoryId = category.id,
                videoPath = storedVideo,
                filePath = storedFiles,
                authorId = user.id,
                authorEmail = user.email,
                authorName = "${user.firstName} ${user.lastName}".trim(),
                status = ModerationStatus.PENDING,
                action = "CREATE",
                createdAt = Instant.now()
            )
        )
        return toDto(proposal)
    }

    @Transactional
    fun submitUpdate(
        currentUserEmail: String,
        articleId: Long,
        title: String,
        description: JsonNode?,
        categoryId: Long,
        videoFile: MultipartFile?,
        files: List<MultipartFile>?
    ): ArticleProposalDto {
        val user = userRepository.findByEmail(currentUserEmail) ?: throw AccessDeniedException("Forbidden")
        val article = articleRepository.findById(articleId).orElseThrow { IllegalArgumentException("Статья не найдена") }
        val newCategory = categoryRepository.findById(categoryId).orElseThrow { IllegalArgumentException("Категория не найдена") }

        when (user.role.title) {
            "ADMIN", "MODERATOR" -> throw AccessDeniedException("Для ADMIN/MODERATOR публикация идёт напрямую, без заявок")
            "WRITER" -> {
                val allowed = writerPermissionService.checkWriterCanEditCategory(user.id, article.category)
                if (!allowed) throw AccessDeniedException("Forbidden")
            }
            else -> throw AccessDeniedException("Forbidden")
        }

        val storedVideo = videoFile?.let { listOf(fileStorageService.saveFile(it, "videos")) }
        val storedFiles = files?.map { fileStorageService.saveFile(it, "files") }

        val proposal = articleProposalRepository.save(
            ArticleProposal(
                articleId = article.id,
                title = title,
                description = description,
                categoryId = newCategory.id,
                videoPath = storedVideo,
                filePath = storedFiles,
                authorId = user.id,
                authorEmail = user.email,
                authorName = "${user.firstName} ${user.lastName}".trim(),
                status = ModerationStatus.PENDING,
                action = "UPDATE",
                createdAt = Instant.now()
            )
        )
        return toDto(proposal)
    }

    @Transactional(readOnly = true)
    fun listPending(): List<ArticleProposalDto> =
        articleProposalRepository.findAllByStatusOrderByCreatedAtDesc(ModerationStatus.PENDING).map { toDto(it) }

    @Transactional(readOnly = true)
    fun listMyWork(currentUserEmail: String): List<ArticleProposalDto> {
        val user = userRepository.findByEmail(currentUserEmail) ?: throw AccessDeniedException("Forbidden")
        return articleProposalRepository.findAllByAuthorIdOrderByCreatedAtDesc(user.id).map { toDto(it) }
    }

    @Transactional
    fun approve(proposalId: Long, moderatorEmail: String, comment: String? = null): ArticleProposalDto {
        val moderator = userRepository.findByEmail(moderatorEmail) ?: throw AccessDeniedException("Forbidden")
        if (moderator.role.title != "ADMIN" && moderator.role.title != "MODERATOR") {
            throw AccessDeniedException("Forbidden")
        }
        val p = articleProposalRepository.findById(proposalId).orElseThrow { IllegalArgumentException("Заявка не найдена") }
        if (p.status != ModerationStatus.PENDING) throw IllegalStateException("Заявка уже обработана")

        val savedArticle = if (p.action == "CREATE") {
            val category = categoryRepository.findById(p.categoryId).orElseThrow { IllegalArgumentException("Категория не найдена") }
            val created = articleRepository.save(
                Article(
                    id = 0,
                    title = p.title,
                    description = p.description,
                    isDelete = false,
                    category = category,
                    videoPath = p.videoPath,
                    filePath = p.filePath
                )
            )
            indexingService.indexArticle(created)
            created
        } else {
            val article = articleRepository.findById(p.articleId!!).orElseThrow { IllegalArgumentException("Статья не найдена") }
            val category = categoryRepository.findById(p.categoryId).orElseThrow { IllegalArgumentException("Категория не найдена") }
            val updated = article.copy(
                title = p.title,
                description = p.description,
                category = category,
                videoPath = p.videoPath ?: article.videoPath,
                filePath = p.filePath ?: article.filePath
            )
            val saved = articleRepository.save(updated)
            indexingService.updateArticle(saved)
            saved
        }

        // Снимок принятой публикации
        articleVersionService.createSnapshot(savedArticle, moderator, "approved proposal #${p.id}")

        val updatedProposal = p.copy(
            status = ModerationStatus.APPROVED,
            reviewedById = moderator.id,
            reviewedByEmail = moderator.email,
            reviewedByName = "${moderator.firstName} ${moderator.lastName}".trim(),
            reviewedAt = Instant.now(),
            rejectReason = comment
        )
        return toDto(articleProposalRepository.save(updatedProposal))
    }

    @Transactional
    fun reject(proposalId: Long, moderatorEmail: String, reason: String): ArticleProposalDto {
        val moderator = userRepository.findByEmail(moderatorEmail) ?: throw AccessDeniedException("Forbidden")
        if (moderator.role.title != "ADMIN" && moderator.role.title != "MODERATOR") {
            throw AccessDeniedException("Forbidden")
        }
        val p = articleProposalRepository.findById(proposalId).orElseThrow { IllegalArgumentException("Заявка не найдена") }
        if (p.status != ModerationStatus.PENDING) throw IllegalStateException("Заявка уже обработана")

        val updated = p.copy(
            status = ModerationStatus.REJECTED,
            reviewedById = moderator.id,
            reviewedByEmail = moderator.email,
            reviewedByName = "${moderator.firstName} ${moderator.lastName}".trim(),
            reviewedAt = Instant.now(),
            rejectReason = reason
        )
        return toDto(articleProposalRepository.save(updated))
    }

    @Transactional(readOnly = true)
    fun getProposal(proposalId: Long): ArticleProposalDto =
        toDto(articleProposalRepository.findById(proposalId).orElseThrow { IllegalArgumentException("Заявка не найдена") })
}
