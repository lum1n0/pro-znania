package com.knowledge.base.service

import com.knowledge.base.dto.UserDto
import com.knowledge.base.mapper.UserMapper
import com.knowledge.base.model.User
import com.knowledge.base.repository.AccessRoleRepository
import com.knowledge.base.repository.RoleRepository
import com.knowledge.base.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class UserService(
    private val userRepository: UserRepository,
    private val roleRepository: RoleRepository,
    private val accessRoleRepository: AccessRoleRepository,
    private val passwordEncoder: PasswordEncoder,
    private val userMapper: UserMapper
) {

    private val logger = LoggerFactory.getLogger(UserService::class.java)

    fun findOrCreateShadowUser(samAccountName: String): User {
        val existing = userRepository.findByEmail(samAccountName)
        if (existing != null) {
            if (existing.isFromLdap) {
                val accessUser = accessRoleRepository.findByTitle("USER")
                    ?: throw IllegalStateException("Database is not seeded with 'USER' access role.")
                val accessGuest = accessRoleRepository.findByTitle("GUEST")
                    ?: throw IllegalStateException("Database is not seeded with 'GUEST' access role.")
                var changed = false
                if (existing.accessRoles.none { it.title == "USER" }) {
                    existing.accessRoles.add(accessUser); changed = true
                }
                if (existing.accessRoles.none { it.title == "GUEST" }) {
                    existing.accessRoles.add(accessGuest); changed = true
                }
                if (changed) {
                    logger.info("Shadow user '{}' missing base access roles; adding USER/GUEST.", existing.email)
                    return userRepository.save(existing)
                }
            }
            return existing
        }
        return createShadowUser(samAccountName)
    }

    private fun createShadowUser(email: String): User {
        logger.info("User '{}' not found locally. Creating shadow user from LDAP.", email)
        val defaultRole = roleRepository.findByTitle("USER")
            ?: throw IllegalStateException("Database is not seeded with default 'USER' role.")
        val accessUser = accessRoleRepository.findByTitle("USER")
            ?: throw IllegalStateException("Database is not seeded with default 'USER' access role.")
        val accessGuest = accessRoleRepository.findByTitle("GUEST")
            ?: throw IllegalStateException("Database is not seeded with default 'GUEST' access role.")
        val newUser = User(
            firstName = email.substringBefore('@'),
            lastName = "",
            email = email,
            password = null,
            role = defaultRole,
            accessRoles = mutableListOf(accessUser, accessGuest),
            isDelete = false,
            isFromLdap = true
        )
        return userRepository.save(newUser).also {
            logger.info("Shadow user '{}' created from LDAP.", it.email)
        }
    }

    fun createUser(userDto: UserDto): UserDto {
        logger.info("Creating local user with DTO: {}", userDto)
        if (userRepository.findByEmail(userDto.email) != null) {
            throw IllegalStateException("User with email ${userDto.email} already exists.")
        }
        val role = roleRepository.findByTitle(userDto.roleDto.title)
            ?: throw RuntimeException("Role not found: ${userDto.roleDto.title}")
        val accessRoles = userDto.accessRolesDto.map {
            accessRoleRepository.findById(it.id).orElseThrow { RuntimeException("AccessRole not found: ${it.id}") }
        }.toMutableList()
        val user = User(
            firstName = userDto.firstName ?: "",
            lastName = userDto.lastName,
            email = userDto.email,
            password = passwordEncoder.encode(userDto.password),
            role = role,
            accessRoles = accessRoles,
            isFromLdap = false
        )
        return userMapper.toDto(userRepository.save(user))
    }

    @Transactional
    fun updateUser(id: Long, userDto: UserDto): UserDto? {
        val exUser = userRepository.findById(id).orElse(null) ?: return null
        logger.info("Updating user with ID: {}, DTO: {}", id, userDto)

        val newEmail = when {
            exUser.isFromLdap -> exUser.email
            userDto.email.isNullOrBlank() -> exUser.email
            else -> userDto.email
        }
        if (!exUser.isFromLdap && newEmail != exUser.email) {
            if (userRepository.findByEmail(newEmail) != null) {
                throw IllegalStateException("User with email $newEmail already exists.")
            }
        }

        val role = roleRepository.findByTitle(userDto.roleDto.title)
            ?: throw RuntimeException("Role not found: ${userDto.roleDto.title}")
        val accessRoles = userDto.accessRolesDto.map {
            accessRoleRepository.findById(it.id).orElseThrow { RuntimeException("AccessRole not found: ${it.id}") }
        }.toMutableList()

        val updatedUser = exUser.copy(
            firstName = userDto.firstName ?: exUser.firstName,
            lastName = userDto.lastName,
            email = newEmail,
            password = if (userDto.password.isNotBlank() && !exUser.isFromLdap) passwordEncoder.encode(userDto.password) else exUser.password,
            role = role,
            accessRoles = accessRoles,
            isDelete = userDto.isDelete
        )
        return userMapper.toDto(userRepository.save(updatedUser))
    }

    fun restoreUser(id: Long): UserDto? {
        val exUser = userRepository.findById(id).orElse(null) ?: return null
        val restoredUser = exUser.copy(isDelete = false)
        return userMapper.toDto(userRepository.save(restoredUser))
    }

    @Transactional(readOnly = true)
    fun findByEmail(email: String): UserDto? = userRepository.findByEmail(email)?.let { userMapper.toDto(it) }

    fun findByFirstName(firstName: String) =
        userRepository.findByFirstName(firstName).map { userMapper.toDto(it) }

    fun findByLastName(lastName: String) =
        userRepository.findByLastName(lastName).map { userMapper.toDto(it) }

    fun getAllUsers(pageable: Pageable): Page<UserDto> {
        val pageUser: Page<User> = userRepository.findAll(pageable)
        return pageUser.map { userMapper.toDto(it) }
    }

    @Transactional(readOnly = true)
    fun getAllUserIsDeleteFalse(pageable: Pageable): Page<UserDto> {
        val pageUser = userRepository.findAllByIsDeleteFalse(pageable)
        return pageUser.map { userMapper.toDto(it) }
    }

    @Transactional(readOnly = true)
    fun getAllUserIsDeleteTrue(pageable: Pageable): Page<UserDto> {
        val pageUser = userRepository.findAllByIsDeleteTrue(pageable)
        return pageUser.map { userMapper.toDto(it) }
    }

    @Transactional(readOnly = true)
    fun getUsersFromLdap(pageable: Pageable): Page<UserDto> {
        val pageUser = userRepository.findAllByIsFromLdapTrue(pageable)
        return pageUser.map { userMapper.toDto(it) }
    }

    fun getUserById(id: Long): UserDto? {
        val user = userRepository.findById(id)
        return user.map { userMapper.toDto(it) }.orElse(null)
    }

    // Новый метод фильтрации
    @Transactional(readOnly = true)
    fun getUsersFiltered(
        pageable: Pageable,
        lastName: String?,
        email: String?,
        isFromLdap: Boolean?,
        isDelete: Boolean?
    ): Page<UserDto> {

        // Если нет ни одного фильтра — используем нативную пагинацию JPA
        val noFilters =
            (lastName.isNullOrBlank()) &&
                    (email.isNullOrBlank()) &&
                    (isFromLdap == null) &&
                    (isDelete == null)

        if (noFilters) {
            val pageUser = userRepository.findAll(pageable)
            return pageUser.map { userMapper.toDto(it) }
        }

        // Базовая выборка по isDelete, чтобы не тянуть все записи
        val base: List<User> = when (isDelete) {
            true  -> userRepository.findAllByIsDeleteTrue(Pageable.unpaged()).content
            false -> userRepository.findAllByIsDeleteFalse(Pageable.unpaged()).content
            else  -> userRepository.findAll(Pageable.unpaged()).content
        }

        // Применяем остальные фильтры ДО пагинации
        val filtered: List<User> = base.asSequence()
            .filter { u ->
                lastName?.takeIf { it.isNotBlank() }?.let { ln ->
                    (u.lastName ?: "").contains(ln, ignoreCase = true)
                } ?: true
            }
            .filter { u ->
                email?.takeIf { it.isNotBlank() }?.let { em ->
                    (u.email ?: "").contains(em, ignoreCase = true)
                } ?: true
            }
            .filter { u ->
                isFromLdap?.let { flag -> u.isFromLdap == flag } ?: true
            }
            .toList()

        // Корректная пагинация поверх уже отфильтрованных данных
        val total = filtered.size
        val fromIndex = (pageable.pageNumber * pageable.pageSize).coerceAtMost(total)
        val toIndex = (fromIndex + pageable.pageSize).coerceAtMost(total)
        val pageSlice = if (fromIndex < toIndex) filtered.subList(fromIndex, toIndex) else emptyList()

        return PageImpl(
            pageSlice.map { userMapper.toDto(it) },
            pageable,
            total.toLong()
        )
    }

}
