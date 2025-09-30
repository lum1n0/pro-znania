package com.knowledge.base.service

import com.knowledge.base.dto.ArticleDto
import com.knowledge.base.dto.CategoryDto
import com.knowledge.base.mapper.ArticleMapper
import com.knowledge.base.mapper.CategoryMapper
import com.knowledge.base.model.User
import com.knowledge.base.repository.AccessRoleRepository
import com.knowledge.base.repository.ArticleRepository
import com.knowledge.base.repository.CategoryRepository
import com.knowledge.base.repository.UserRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile

@Service
class ArticleService(
    private val articleRepository: ArticleRepository,
    private val categoryRepository: CategoryRepository,
    private val articleMapper: ArticleMapper,
    private val categoryMapper: CategoryMapper,
    private val fileStorageService: FileStorageService,
    private val accessRoleRepository: AccessRoleRepository,
    private val userRepository: UserRepository,
    private val writerPermissionService: WriterPermissionService,
    private val indexingService: IndexingService,
    // добавлено: сервис версий
    private val articleVersionService: ArticleVersionService
) {

    @Transactional(readOnly = true)
    fun getGuestArticlesByCategory(categoryId: Long): List<ArticleDto> {
        val category = categoryRepository.findById(categoryId).orElse(null)
            ?: return emptyList()
        val guestRole = accessRoleRepository.findByTitle("GUEST")
            ?: throw IllegalArgumentException("GUEST role not found")
        if (category.accessRoles.any { it.id == guestRole.id }) {
            val articles = articleRepository.findAllByCategoryAndIsDeleteFalse(category)
            return articles.map { articleMapper.toDto(it) }
        }
        return emptyList()
    }

    @Transactional(readOnly = true)
    fun getGuestArticleById(id: Long): ArticleDto? {
        val article = articleRepository.findById(id).orElse(null) ?: return null
        val category = article.category
        val guestRole = accessRoleRepository.findByTitle("GUEST")
            ?: throw IllegalArgumentException("GUEST role not found")
        return if (category.accessRoles.any { it.id == guestRole.id } && !article.isDelete) {
            articleMapper.toDto(article)
        } else {
            null
        }
    }

    @Transactional(readOnly = true)
    fun searchGuestArticles(description: String): List<ArticleDto> {
        val guestRole = accessRoleRepository.findByTitle("GUEST")
            ?: throw IllegalArgumentException("GUEST role not found")
        val categories = categoryRepository.findAllByIsDeleteFalse()
            .filter { category -> category.accessRoles.any { it.id == guestRole.id } }
        val articles = articleRepository.findByTitleContainingIgnoreCaseAndIsDeleteFalse(description)
            .filter { article -> categories.any { it.id == article.category.id } }
        return articles.map { articleMapper.toDto(it) }
    }

    // Новый helper: проверка прав редактирования для текущего пользователя и категории
    private fun assertCanEditCategory(currentUser: User, categoryId: Long) {
        val category = categoryRepository.findById(categoryId)
            .orElseThrow { IllegalArgumentException("Категория не найдена") }
        when (currentUser.role.title) {
            "ADMIN", "MODERATOR" -> return
            "WRITER" -> {
                val allowed = writerPermissionService.checkWriterCanEditCategory(currentUser.id, category)
                if (!allowed) throw AccessDeniedException("Forbidden")
            }
            else -> throw AccessDeniedException("Forbidden")
        }
    }

    // Перегрузка для случая, когда уже есть категория
    private fun assertCanEditCategory(currentUser: User, category: com.knowledge.base.model.Category) {
        when (currentUser.role.title) {
            "ADMIN", "MODERATOR" -> return
            "WRITER" -> {
                val allowed = writerPermissionService.checkWriterCanEditCategory(currentUser.id, category)
                if (!allowed) throw AccessDeniedException("Forbidden")
            }
            else -> throw AccessDeniedException("Forbidden")
        }
    }

    @Transactional
    fun addArticle(currentUserEmail: String, articleDto: ArticleDto, videoFile: MultipartFile?, files: List<MultipartFile>?): ArticleDto {
        val currentUser = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")
        assertCanEditCategory(currentUser, articleDto.categoryDto.id)

        val category = categoryRepository.findById(articleDto.categoryDto.id)
            .orElseThrow { IllegalArgumentException("Категория не найдена") }

        val videoPath = videoFile?.let { listOf(fileStorageService.saveFile(it, "videos")) }
        val filePaths = files?.map { fileStorageService.saveFile(it, "files") }

        val article = articleMapper.toEntity(articleDto).copy(
            category = category,
            videoPath = videoPath,
            filePath = filePaths
        )

        val savedArticle = articleRepository.save(article)
        indexingService.indexArticle(savedArticle)

        // Снимок версии после создания
        articleVersionService.createSnapshot(savedArticle, currentUser, "created")

        return articleMapper.toDto(savedArticle)
    }

    @Transactional
    fun updateArticle(currentUserEmail: String, id: Long, articleDto: ArticleDto, videoFile: MultipartFile?, files: List<MultipartFile>?): ArticleDto {
        val currentUser = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")

        val existingArticle = articleRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Статья с ID $id не найдена") }

        val newCategory = categoryRepository.findById(articleDto.categoryDto.id)
            .orElseThrow { IllegalArgumentException("Категория не найдена") }

        // Проверяем по новой категории (куда перемещаем/обновляем)
        assertCanEditCategory(currentUser, newCategory)

        var newVideoPath = existingArticle.videoPath
        if (videoFile != null) {
            existingArticle.videoPath?.firstOrNull()?.let { fileStorageService.deleteFile(it) }
            newVideoPath = listOf(fileStorageService.saveFile(videoFile, "videos"))
        }

        var newFilePaths = existingArticle.filePath
        if (files != null && files.isNotEmpty()) {
            existingArticle.filePath?.forEach { fileStorageService.deleteFile(it) }
            newFilePaths = files.map { fileStorageService.saveFile(it, "files") }
        }

        val updatedArticle = existingArticle.copy(
            title = articleDto.title,
            description = articleDto.description,
            category = newCategory,
            videoPath = newVideoPath,
            filePath = newFilePaths
        )

        val savedArticle = articleRepository.save(updatedArticle)
        indexingService.updateArticle(savedArticle)

        // Снимок версии после обновления
        articleVersionService.createSnapshot(savedArticle, currentUser, "updated")

        return articleMapper.toDto(savedArticle)
    }

    fun getCategoryDtoById(categoryId: Long): CategoryDto {
        val category = categoryRepository.findById(categoryId)
            .orElseThrow { IllegalArgumentException("Категория с ID $categoryId не найдена") }
        return categoryMapper.toDto(category)
    }

    fun getAllArticle(pageable: Pageable): Page<ArticleDto> {
        val pageArticle = articleRepository.findAll(pageable)
        return pageArticle.map { articleMapper.toDto(it) }
    }

    fun getArticleByCategoryId(categoryId: Long): List<ArticleDto> {
        val category = categoryRepository.findById(categoryId).orElse(null)
            ?: return emptyList()
        val activeArticles = articleRepository.findAllByCategoryAndIsDeleteFalse(category)
        return activeArticles.map { articleMapper.toDto(it) }
    }

    @Transactional(readOnly = true)
    fun getAllArticlesByCategoryForAdmin(currentUserEmail: String, categoryId: Long): List<ArticleDto> {
        val category = categoryRepository.findById(categoryId).orElse(null)
            ?: return emptyList()
        val user = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")

        when (user.role.title) {
            "ADMIN", "MODERATOR" -> {
                val articles = articleRepository.findAllByCategory(category)
                return articles.map { articleMapper.toDto(it) }
            }
            "WRITER" -> {
                val allowed = writerPermissionService.checkWriterCanEditCategory(user.id, category)
                if (!allowed) throw AccessDeniedException("Forbidden")
                val articles = articleRepository.findAllByCategory(category)
                return articles.map { articleMapper.toDto(it) }
            }
            else -> throw AccessDeniedException("Forbidden")
        }
    }

    fun findArticleByTitle(description: String): List<ArticleDto> {
        val articles = articleRepository.findByTitleContainingIgnoreCaseAndIsDeleteFalse(description)
        return articles.map { articleMapper.toDto(it) }
    }

    fun findArticleByTitleToAdmin(description: String): List<ArticleDto> {
        val articles = articleRepository.findByTitleContainingIgnoreCase(description)
        return articles.map { articleMapper.toDto(it) }
    }

    fun getArticleById(id: Long): ArticleDto? {
        val article = articleRepository.findById(id).orElse(null)
        return article?.let { articleMapper.toDto(it) }
    }

    fun getArticleEntityById(id: Long) = articleRepository.findById(id).orElse(null)

    @Transactional
    fun softDeleteArticle(currentUserEmail: String, id: Long, isDelete: Boolean): ArticleDto? {
        val currentUser = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")
        val article = articleRepository.findById(id).orElse(null) ?: return null
        assertCanEditCategory(currentUser, article.category)

        val updatedArticle = article.copy(isDelete = isDelete)
        val savedArticle = articleRepository.save(updatedArticle)

        if (isDelete) {
            indexingService.deleteArticle(id)
        } else {
            indexingService.indexArticle(savedArticle)
        }

        // Снимок факта изменения флага удаления
        articleVersionService.createSnapshot(savedArticle, currentUser, "soft-delete=$isDelete")

        return articleMapper.toDto(savedArticle)
    }

    @Transactional
    fun deleteArticleById(currentUserEmail: String, id: Long) {
        val currentUser = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")
        val article = articleRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Статья не найдена") }
        assertCanEditCategory(currentUser, article.category)

        // Сохраняем пути до удаления из БД
        val videoPaths: List<String> = article.videoPath ?: emptyList()
        val filePaths: List<String> = article.filePath ?: emptyList()

        // 1) Удаляем запись из БД
        articleRepository.delete(article)

        // 2) Пытаемся удалить физические файлы
        videoPaths.forEach { path -> fileStorageService.deleteFile(path) }
        filePaths.forEach { path -> fileStorageService.deleteFile(path) }

        indexingService.deleteArticle(id)
        // Примечание: версии не удаляем здесь умышленно; при необходимости можно добавить каскадную очистку версий отдельным сервисом
    }
}
