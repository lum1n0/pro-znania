package com.knowledge.base.util

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.io.Decoders
import io.jsonwebtoken.security.Keys
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.Date

@Component
class JwtUtil(
    @Value("\${app.jwtSecret}")
    rawSecret: String
) {

    private val logger = LoggerFactory.getLogger(JwtUtil::class.java)

    private val secret: String = rawSecret.replace("\r", "").replace("\n", "").trim()
    private val expirationTime = 86400000L

    private val key = run {
        try {
            val bytes = Decoders.BASE64.decode(secret)
            require(bytes.size >= 32) { "JWT secret (base64) is too short; need >=32 bytes" }
            Keys.hmacShaKeyFor(bytes)
        } catch (e: IllegalArgumentException) {
            logger.warn("JWT secret is not valid base64; fallback to raw UTF-8 bytes.")
            val bytes = secret.toByteArray(StandardCharsets.UTF_8)
            require(bytes.size >= 32) { "JWT secret (raw) is too short; need >=32 bytes" }
            Keys.hmacShaKeyFor(bytes)
        }
    }

    fun generateToken(userDetails: UserDetails): String {
        val roles = userDetails.authorities.map { it.authority } // уже ASCII
        val now = Date()
        val exp = Date(System.currentTimeMillis() + expirationTime)
        val token = Jwts.builder()
            .setSubject(userDetails.username)
            .claim("roles", roles)
            .setIssuedAt(now)
            .setExpiration(exp)
            .signWith(key, SignatureAlgorithm.HS512)
            .compact()
        if (logger.isDebugEnabled) {
            logger.debug("JWT issued for '${userDetails.username}', head='${token.take(30)}...', len=${token.length}")
        }
        return token
    }

    fun validateToken(token: String, userDetails: UserDetails): Boolean {
        return try {
            val username = extractUsername(token)
            username == userDetails.username && !isTokenExpired(token)
        } catch (ex: Exception) {
            logger.debug("JWT validation failed: ${ex.message}")
            false
        }
    }

    fun extractUsername(token: String): String = extractClaims(token).subject
    @Suppress("UNCHECKED_CAST")
    fun extractRoles(token: String): List<String> =
        extractClaims(token).get("roles", List::class.java) as List<String>
    fun extractClaims(token: String): Claims =
        Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).body
    private fun isTokenExpired(token: String): Boolean =
        extractClaims(token).expiration.before(Date())
}