package com.knowledge.base.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.knowledge.base.dto.ArticleDto
import com.knowledge.base.dto.CategoryDto
import com.knowledge.base.mapper.ArticleMapper
import com.knowledge.base.mapper.CategoryMapper
import com.knowledge.base.model.User
import com.knowledge.base.repository.AccessRoleRepository
import com.knowledge.base.repository.ArticleRepository
import com.knowledge.base.repository.ArticleViewHitRepository
import com.knowledge.base.repository.CategoryRepository
import com.knowledge.base.repository.UserRepository
import jakarta.annotation.PostConstruct
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
    private val objectMapper: ObjectMapper,
    private val articleViewHitRepository: ArticleViewHitRepository,
    private val articleVersionService: ArticleVersionService,
    private val notificationService: NotificationService // добавьте эту зависимость
) {

    @PostConstruct
    fun init() {
        fixImageUrlsOnStartup()
    }

    /**
     * Автоматически исправляет URL изображений при запуске приложения
     * Заменяет абсолютные пути на относительные
     */
    @Transactional
    fun fixImageUrlsOnStartup() {
        try {
            val articles = articleRepository.findAll()
            var fixedCount = 0

            articles.forEach { article ->
                val fixedDescription = fixImageUrlsInJson(article.description)
                if (fixedDescription != article.description) {
                    articleRepository.save(article.copy(description = fixedDescription))
                    fixedCount++
                    println("Исправлены URL в статье ID: ${article.id}")
                }
            }

            if (fixedCount > 0) {
                println("✅ Исправлено URL изображений в $fixedCount статьях")
            } else {
                println("ℹ️  Не найдено статей с абсолютными путями для исправления")
            }
        } catch (e: Exception) {
            println("❌ Ошибка при исправлении URL изображений: ${e.message}")
            e.printStackTrace()
        }
    }

    /**
     * Ручной вызов для исправления URL изображений
     */
    @Transactional
    fun fixImageUrls(): String {
        val articles = articleRepository.findAll()
        var fixedCount = 0

        articles.forEach { article ->
            val fixedDescription = fixImageUrlsInJson(article.description)
            if (fixedDescription != article.description) {
                articleRepository.save(article.copy(description = fixedDescription))
                fixedCount++
            }// <-- добавить
        }

        return "Исправлено URL изображений в $fixedCount статьях"
    }

    /**
     * Исправляет URL изображений в JSON описании статьи
     * Заменяет абсолютные пути на относительные
     */
    private fun fixImageUrlsInJson(json: JsonNode?): JsonNode? {
        if (json == null) return json

        return try {
            var jsonString = json.toString()

            // Сохраняем оригинальную строку для сравнения
            val originalString = jsonString

            // Заменяем все абсолютные пути на относительные
            // Паттерн для поиска: http://любой_домен:порт/images/файл
            val absolutePathPattern = Regex("""http://[^"/]+:?\d*/images/([^"]+)""")

            jsonString = absolutePathPattern.replace(jsonString) { matchResult ->
                val fileName = matchResult.groupValues[1]
                println("Найден абсолютный путь: ${matchResult.value} -> заменяем на: /images/$fileName")
                "/images/$fileName"
            }

            // Дополнительно: заменяем варианты с localhost и конкретными IP
            jsonString = jsonString
                .replace("http://localhost:8080/images/", "/images/")
                .replace("http://10.15.22.141:8080/images/", "/images/")
                .replace("http://pro-znania:8080/images/", "/images/")
                .replace("http://pro-znania/images/", "/images/")
                .replace("http://pro-znania-test/images/", "/images/")

            // Если строка изменилась, создаем новый JsonNode
            if (jsonString != originalString) {
                objectMapper.readTree(jsonString)
            } else {
                json // возвращаем оригинальный, если изменений не было
            }
        } catch (e: Exception) {
            println("❌ Ошибка при обработке JSON: ${e.message}")
            e.printStackTrace()
            json // Возвращаем оригинальный JSON в случае ошибки
        }
    }
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
        articleVersionService.createSnapshot(savedArticle, currentUser, "created")

        // НОВОЕ: отправляем уведомление о новой статье
        notificationService.notifyAboutNewArticle(savedArticle, currentUser)

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
        articleVersionService.createSnapshot(savedArticle, currentUser, "updated")

        // НОВОЕ: отправляем уведомление об обновлении статьи
        notificationService.notifyAboutArticleUpdate(savedArticle, currentUser)

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
    fun softDeleteArticle(currentUserEmail: String, id: Long, isDelete: Boolean): ArticleDto {
        val currentUser = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")
        val article = articleRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Статья с ID $id не найдена") }

        assertCanEditCategory(currentUser, article.category)

        val saved = articleRepository.save(article.copy(isDelete = isDelete))

        // снимок версии (как и было)
        articleVersionService.createSnapshot(
            saved,
            currentUser,
            if (isDelete) "soft-delete" else "restore"
        )

        // ВАЖНО: вызывать индексацию по ID
        indexingService.indexArticleById(saved.id)

        return articleMapper.toDto(saved)
    }

    @Transactional
    fun deleteArticleById(currentUserEmail: String, id: Long) {
        val currentUser = userRepository.findByEmail(currentUserEmail)
            ?: throw AccessDeniedException("Forbidden")
        val article = articleRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Статья не найдена") }
        assertCanEditCategory(currentUser, article.category)

        val videoPaths = article.videoPath ?: emptyList()
        val filePaths = article.filePath ?: emptyList()

        // 1) удаляем зависимые записи просмотров
        articleViewHitRepository.deleteByArticleId(id)

        // 2) удаляем статью
        articleRepository.delete(article)

        // 3) удаляем физические файлы
        videoPaths.forEach { fileStorageService.deleteFile(it) }
        filePaths.forEach { fileStorageService.deleteFile(it) }

        // 4) чистим индексы (асинхронно) после успешного удаления
        indexingService.deleteArticle(id)
    }
}
