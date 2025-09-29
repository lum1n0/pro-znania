// src/main/kotlin/com/knowledge/base/controller/ChatRestController.kt
package com.knowledge.base.controller
import com.knowledge.base.service.ChatService
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/chat")
class ChatRestController(private val chatService: ChatService) {

    @DeleteMapping("/session/{sessionId}")
    fun deleteSessionMessages(@PathVariable sessionId: String) {
        chatService.deleteSessionMessages(sessionId)
    }
}