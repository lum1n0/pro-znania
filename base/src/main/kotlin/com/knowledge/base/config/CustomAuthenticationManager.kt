package com.knowledge.base.config

import com.knowledge.base.service.UserDetailsServiceImpl
import org.slf4j.LoggerFactory
import org.springframework.core.env.Environment
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.core.Authentication
import org.springframework.security.core.AuthenticationException
import org.springframework.security.ldap.authentication.LdapAuthenticationProvider
import org.springframework.security.ldap.authentication.ad.ActiveDirectoryLdapAuthenticationProvider
import org.springframework.stereotype.Component

@Component
class CustomAuthenticationManager(
    private val env: Environment,
    private val ldapProviderDev: LdapAuthenticationProvider?,
    private val ldapProviderProd: ActiveDirectoryLdapAuthenticationProvider?,
    private val daoProvider: DaoAuthenticationProvider,
    private val userDetailsService: UserDetailsServiceImpl
) : AuthenticationManager {

    private val logger = LoggerFactory.getLogger(CustomAuthenticationManager::class.java)

    // Локальные учётные — не ходим в LDAP никогда
    private val localOnlyUsers = setOf("admin@gmail.com")

    override fun authenticate(authentication: Authentication): Authentication {
        val raw = authentication.name
        val password = authentication.credentials
        logger.debug("CustomAuthenticationManager: start auth for '$raw'.")

        val isProd = env.activeProfiles.contains("prod")
        val normalized = normalizeLogin(raw, isProd)
        logger.debug("Normalized login for auth (sAM/uid): '$normalized'")

        // 1) Локальные — сразу DAO
        if (isLocalLoginCandidate(raw, normalized)) {
            logger.debug("Local-only candidate '$raw'. Trying DAO first, skipping LDAP.")
            return authenticateDao(raw, password)
        }

        // 2) Остальные — LDAP по профилю
        return if (isProd) {
            authenticateViaAdOrFail(raw, normalized, password)
        } else {
            authenticateViaDevLdapOrFail(raw, normalized, password)
        }
    }

    private fun authenticateDao(usernameRaw: String, password: Any?): Authentication {
        val daoToken = UsernamePasswordAuthenticationToken(usernameRaw, password)
        return try {
            val result = daoProvider.authenticate(daoToken)
            logger.info("DAO auth successful for '$usernameRaw'.")
            result
        } catch (e: AuthenticationException) {
            logger.warn("DAO auth failed for '$usernameRaw': ${e.message}")
            throw e
        }
    }

    private fun authenticateViaAdOrFail(raw: String, normalized: String, password: Any?): Authentication {
        if (ldapProviderProd == null) {
            logger.error("AD provider is null in prod profile. Check @Profile and bean creation.")
            throw BadCredentialsException("Authentication service unavailable")
        }
        val token = UsernamePasswordAuthenticationToken(normalized, password)
        return try {
            ldapProviderProd.authenticate(token)
            logger.info("AD auth successful for '$normalized'.")
            val userDetails = userDetailsService.loadUserByUsername(normalized)
            UsernamePasswordAuthenticationToken(userDetails, null, userDetails.authorities)
        } catch (e: AuthenticationException) {
            logger.warn("AD auth failed for '$normalized': ${e.message}")
            throw e
        }
    }

    private fun authenticateViaDevLdapOrFail(raw: String, normalized: String, password: Any?): Authentication {
        if (ldapProviderDev == null) {
            logger.error("Dev LDAP provider is null in dev profile.")
            if (raw.contains("@")) {
                return authenticateDao(raw, password)
            }
            throw BadCredentialsException("Authentication service unavailable (dev LDAP not configured)")
        }
        val token = UsernamePasswordAuthenticationToken(normalized, password)
        return try {
            ldapProviderDev.authenticate(token)
            logger.info("Dev LDAP auth successful for '$normalized'.")
            val userDetails = userDetailsService.loadUserByUsername(normalized)
            UsernamePasswordAuthenticationToken(userDetails, null, userDetails.authorities)
        } catch (e: AuthenticationException) {
            logger.warn("Dev LDAP auth failed for '$normalized': ${e.message}")
            if (raw.contains("@")) {
                return authenticateDao(raw, password)
            }
            throw e
        }
    }

    private fun isLocalLoginCandidate(raw: String, normalized: String): Boolean {
        if (localOnlyUsers.contains(raw.lowercase()) || localOnlyUsers.contains(normalized.lowercase())) return true
        return raw.contains("@")
    }

    private fun normalizeLogin(input: String, isProd: Boolean): String {
        val backslash = input.indexOf('\\')
        val base = if (backslash >= 0 && backslash < input.length - 1) {
            input.substring(backslash + 1)
        } else {
            input
        }
        // dev: email -> uid, prod: sAM как есть
        return if (!isProd && base.contains("@")) base.substringBefore("@") else base
    }
}

