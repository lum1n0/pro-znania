package com.knowledge.base.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.itextpdf.io.font.PdfEncodings
import com.itextpdf.io.image.ImageDataFactory
import com.itextpdf.kernel.colors.ColorConstants
import com.itextpdf.kernel.font.PdfFont
import com.itextpdf.kernel.font.PdfFontFactory
import com.itextpdf.kernel.pdf.PdfDocument
import com.itextpdf.kernel.pdf.PdfWriter
import com.itextpdf.layout.Document
import com.itextpdf.layout.borders.SolidBorder
import com.itextpdf.layout.element.*
import com.itextpdf.layout.properties.HorizontalAlignment
import com.itextpdf.layout.properties.TextAlignment
import com.itextpdf.layout.properties.UnitValue
import com.knowledge.base.model.Article
import org.jsoup.Jsoup
import org.jsoup.nodes.Document as HtmlDoc
import org.jsoup.nodes.Element
import org.jsoup.nodes.Node
import org.jsoup.nodes.TextNode
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.net.URL
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Paths
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Base64

@Service
class PDFService(
    private val objectMapper: ObjectMapper
) {
    @Value("\${file.upload-dir}")
    private lateinit var uploadDir: String

    // HTTP префиксы, которые маппятся на локальные файлы uploads/images
    private val imageBaseHttpPrefixes = listOf(
        "http://localhost:8080/images/",
        "https://localhost:8080/images/",
        "http://10.15.23.244:8080/images/",
        "https://10.15.23.244:8080/images/"
    )

    // Пакет шрифтов и helper для стилизованного текста
    private data class Fonts(
        val regular: PdfFont,
        val bold: PdfFont,
        val italic: PdfFont?,       // может быть null
        val boldItalic: PdfFont?    // может быть null
    )

    private fun loadFontFromResources(path: String): PdfFont? {
        return try {
            val res = ClassPathResource(path)
            if (!res.exists()) return null
            // IDENTITY_H для кириллицы, iText сам предпочтёт встраивание для TTF
            PdfFontFactory.createFont(res.inputStream.readAllBytes(), PdfEncodings.IDENTITY_H)
        } catch (_: Exception) {
            null
        }
    }

    private fun loadFonts(): Fonts {
        // Обязательно: DejaVuSans.ttf и DejaVuSans-Bold.ttf должны лежать в resources/fonts
        val regular = loadFontFromResources("fonts/DejaVuSans.ttf")
            ?: error("fonts/DejaVuSans.ttf not found")
        val bold = loadFontFromResources("fonts/DejaVuSans-Bold.ttf")
            ?: regular
        // Опционально (если положишь файлы в ресурсы)
        val italic = loadFontFromResources("fonts/DejaVuSans-Oblique.ttf")
        val boldItalic = loadFontFromResources("fonts/DejaVuSans-BoldOblique.ttf")
        return Fonts(regular, bold, italic, boldItalic)
    }

    private fun styledText(text: String, fonts: Fonts, bold: Boolean = false, italic: Boolean = false, underline: Boolean = false): Text {
        val font = when {
            bold && italic && fonts.boldItalic != null -> fonts.boldItalic
            bold -> fonts.bold
            italic && fonts.italic != null -> fonts.italic
            else -> fonts.regular
        }!!
        val t = Text(text).setFont(font)
        // Если наклонного TTF нет, имитируем курсив свойством
        if (italic && (font == fonts.regular || font == fonts.bold)) t.setItalic()
        if (underline) t.setUnderline()
        return t
    }

    fun generateArticlePdf(article: Article): ByteArray {
        val out = ByteArrayOutputStream()
        val writer = PdfWriter(out)
        val pdf = PdfDocument(writer)
        val doc = Document(pdf)

        // Загружаем шрифты один раз на документ
        val fonts = loadFonts()

        try {
            // Заголовок, мета
            doc.add(
                Paragraph(article.title)
                    .setFont(fonts.bold).setFontSize(24f)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(20f)
                    .setFontColor(ColorConstants.DARK_GRAY)
            )
            doc.add(
                Paragraph("Категория: ${article.category.description}")
                    .setFont(fonts.regular).setFontSize(12f)
                    .setMarginBottom(10f)
                    .setFontColor(ColorConstants.GRAY)
            )
            doc.add(
                Paragraph("Дата создания: ${LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))}")
                    .setFont(fonts.regular).setFontSize(10f)
                    .setMarginBottom(30f)
                    .setFontColor(ColorConstants.GRAY)
            )
            doc.add(
                Paragraph("─".repeat(80))
                    .setFont(fonts.regular)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(20f)
                    .setFontColor(ColorConstants.LIGHT_GRAY)
            )

            // Контент
            val desc = article.description
            if (desc != null) {
                if (desc.has("ops")) {
                    processDelta(doc, desc, fonts)
                } else {
                    val raw = desc.asText()
                    val html = unescapeHtmlKeepingTags(raw).trim()
                    if (looksLikeHtml(html)) processHtml(doc, html, fonts)
                    else addText(doc, raw, fonts.regular)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            doc.add(
                Paragraph("Ошибка при обработке содержимого статьи: ${e.message}")
                    .setFont(loadFonts().regular)
                    .setFontSize(12f)
                    .setFontColor(ColorConstants.RED)
            )
        } finally {
            doc.close()
        }
        return out.toByteArray()
    }

    // -------- Delta (HTML внутри текстового insert поддержан) --------
    private fun processDelta(document: Document, descriptionNode: JsonNode, fonts: Fonts) {
        val ops = descriptionNode.get("ops") ?: return
        for (op in ops) {
            if (!op.has("insert")) continue
            val insert = op.get("insert")

            if (insert.isTextual) {
                val textRaw = insert.asText()
                val htmlCandidate = unescapeHtmlKeepingTags(textRaw).trim()
                if (looksLikeHtml(htmlCandidate)) {
                    processHtml(document, htmlCandidate, fonts)
                    continue
                }
                val p = Paragraph(textRaw.trim())
                    .setFont(fonts.regular).setFontSize(14f).setMarginBottom(12f)

                if (op.has("attributes")) {
                    val a = op.get("attributes")
                    if (a.has("bold") && a.get("bold").asBoolean()) p.setFont(fonts.bold)
                    if (a.has("italic") && a.get("italic").asBoolean()) p.setItalic()
                    if (a.has("header")) {
                        val fs = when (a.get("header").asInt()) { 1 -> 20f; 2 -> 18f; 3 -> 16f; else -> 14f }
                        p.setFont(fonts.bold).setFontSize(fs)
                    }
                }
                document.add(p)
            } else if (insert.isObject && insert.has("image")) {
                addImageSmart(document, insert.get("image").asText(), null, null)
            }
        }
    }

    // -------- HTML (абзацы, изображения, таблицы, figure.table) --------
    private fun processHtml(document: Document, html: String, fonts: Fonts) {
        val doc: HtmlDoc = Jsoup.parse(html)
        for (element in doc.body().children()) {
            processElement(document, element, fonts)
        }
    }

    private fun processElement(pdfDocument: Document, element: Element, fonts: Fonts) {
        val tag = element.tagName().lowercase()

        when {
            // Пролог figure.table: текст + img до таблицы
            tag == "figure" && element.hasClass("table") -> {
                val tableEl = element.selectFirst("table")
                if (tableEl != null) {
                    var leadPara = Paragraph().setFont(fonts.regular).setFontSize(14f).setMarginBottom(12f)
                    var leadAdded = false

                    for (n in element.childNodes()) {
                        if (n is Element && n.tagName().equals("table", true)) break
                        when (n) {
                            is TextNode -> {
                                val t = n.text().replace("\u00a0", " ").trim()
                                if (t.isNotEmpty()) { leadPara.add(styledText(t, fonts)); leadAdded = true }
                            }
                            is Element -> {
                                val nt = n.tagName().lowercase()
                                when (nt) {
                                    "strong", "b" -> {
                                        val t = n.text().replace("\u00a0", " ").trim()
                                        if (t.isNotEmpty()) { leadPara.add(styledText(t, fonts, bold = true)); leadAdded = true }
                                    }
                                    "em", "i" -> {
                                        val t = n.text().replace("\u00a0", " ").trim()
                                        if (t.isNotEmpty()) { leadPara.add(styledText(t, fonts, italic = true)); leadAdded = true }
                                    }
                                    "u" -> {
                                        val t = n.text().replace("\u00a0", " ").trim()
                                        if (t.isNotEmpty()) { leadPara.add(styledText(t, fonts, underline = true)); leadAdded = true }
                                    }
                                    "span" -> {
                                        val t = n.text().replace("\u00a0", " ").trim()
                                        if (t.isNotEmpty()) { leadPara.add(styledText(t, fonts)); leadAdded = true }
                                    }
                                    "br" -> { leadPara.add("\n"); leadAdded = true }
                                    "img" -> {
                                        if (leadAdded && !leadPara.isEmpty) { pdfDocument.add(leadPara); leadPara = Paragraph().setFont(fonts.regular).setFontSize(14f).setMarginBottom(12f); leadAdded = false }
                                        addImageSmart(
                                            pdfDocument,
                                            n.attr("src"),
                                            n.attr("width").toIntOrNull(),
                                            n.attr("height").toIntOrNull()
                                        )
                                    }
                                    else -> {
                                        val t = n.text().replace("\u00a0", " ").trim()
                                        if (t.isNotEmpty()) { leadPara.add(styledText(t, fonts)); leadAdded = true }
                                    }
                                }
                            }
                        }
                    }
                    if (leadAdded && !leadPara.isEmpty) pdfDocument.add(leadPara)

                    addHtmlTable(pdfDocument, tableEl, fonts)
                    return
                }
                val text = element.text().trim()
                if (text.isNotEmpty()) addText(pdfDocument, text, fonts.regular)
                return
            }

            tag == "table" -> {
                addHtmlTable(pdfDocument, element, fonts)
                return
            }

            tag == "p" || tag == "div" || tag == "span" -> {
                val para = Paragraph().setFont(fonts.regular).setFontSize(14f).setMarginBottom(12f)
                val built = processChildrenIntoParagraph(pdfDocument, para, element, fonts)
                if (!built.isEmpty) pdfDocument.add(built)
                return
            }

            tag == "img" -> {
                addImageSmart(
                    pdfDocument,
                    element.attr("src"),
                    element.attr("width").toIntOrNull(),
                    element.attr("height").toIntOrNull()
                )
                return
            }

            else -> {
                val text = element.text().trim()
                if (text.isNotEmpty()) addText(pdfDocument, text, fonts.regular)
            }
        }
    }

    private fun processChildrenIntoParagraph(
        pdfDocument: Document,
        para: Paragraph,
        parent: Element,
        fonts: Fonts
    ): Paragraph {
        var currentPara = para
        for (node in parent.childNodes()) {
            when (node) {
                is TextNode -> {
                    val text = node.text().replace("\u00a0", " ").trim()
                    if (text.isNotEmpty()) currentPara.add(styledText(text, fonts))
                }
                is Element -> {
                    when (node.tagName().lowercase()) {
                        "strong", "b" -> {
                            val t = node.text().replace("\u00a0", " ").trim()
                            if (t.isNotEmpty()) currentPara.add(styledText(t, fonts, bold = true))
                        }
                        "em", "i" -> {
                            val t = node.text().replace("\u00a0", " ").trim()
                            if (t.isNotEmpty()) currentPara.add(styledText(t, fonts, italic = true))
                        }
                        "u" -> {
                            val t = node.text().replace("\u00a0", " ").trim()
                            if (t.isNotEmpty()) currentPara.add(styledText(t, fonts, underline = true))
                        }
                        "br" -> currentPara.add("\n")
                        "img" -> {
                            if (!currentPara.isEmpty) pdfDocument.add(currentPara)
                            addImageSmart(
                                pdfDocument,
                                node.attr("src"),
                                node.attr("width").toIntOrNull(),
                                node.attr("height").toIntOrNull()
                            )
                            currentPara = Paragraph().setFont(fonts.regular).setFontSize(14f).setMarginBottom(12f)
                        }
                        "table" -> {
                            if (!currentPara.isEmpty) pdfDocument.add(currentPara)
                            addHtmlTable(pdfDocument, node, fonts)
                            currentPara = Paragraph().setFont(fonts.regular).setFontSize(14f).setMarginBottom(12f)
                        }
                        else -> {
                            currentPara = processChildrenIntoParagraph(pdfDocument, currentPara, node, fonts)
                        }
                    }
                }
            }
        }
        return currentPara
    }

    private fun addHtmlTable(pdfDocument: Document, tableEl: Element, fonts: Fonts) {
        val firstRow = tableEl.selectFirst("thead tr") ?: tableEl.selectFirst("tbody tr") ?: tableEl.selectFirst("tr")
        val colCount = firstRow?.children()?.count { it.tagName().equals("td", true) || it.tagName().equals("th", true) } ?: 0
        if (colCount <= 0) return

        val table = Table(colCount)
            .setWidth(UnitValue.createPercentValue(100f))
            .setHorizontalAlignment(HorizontalAlignment.CENTER)
            .setBorder(SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f))
            .setMarginTop(5f)
            .setMarginBottom(10f)

        val rows = tableEl.select("tr")
        for (row in rows) {
            val cells = row.children().filter { it.tagName().equals("td", true) || it.tagName().equals("th", true) }
            for (cellEl in cells) {
                val isHeader = cellEl.tagName().equals("th", true)
                val text = cellEl.text().replace("\u00a0", " ").trim()
                val colspan = cellEl.attr("colspan").toIntOrNull() ?: 1
                val rowspan = cellEl.attr("rowspan").toIntOrNull() ?: 1

                val p = Paragraph(text)
                    .setFont(if (isHeader) fonts.bold else fonts.regular)
                    .setFontSize(12f)
                    .setMargin(0f)
                    .setMultipliedLeading(1.1f)

                val cell = Cell(rowspan, colspan)
                    .add(p)
                    .setBorder(SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f))
                    .setPadding(6f)

                if (isHeader) cell.setBackgroundColor(ColorConstants.LIGHT_GRAY)

                table.addCell(cell)
            }
        }
        pdfDocument.add(table)
    }

    private fun looksLikeHtml(s: String): Boolean {
        val t = s.trim()
        return t.contains("<") && t.contains(">") || t.contains("&lt;") || t.contains("&gt;") || t.contains("<table")
    }

    private fun unescapeHtmlKeepingTags(raw: String): String {
        return raw
            .replace("\\\"", "\"")
            .replace("\\n", "\n")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
    }

    // ---------- Изображения ----------
    private fun addImageSmart(
        document: Document,
        rawSrc: String?,
        preferredWidth: Int? = null,
        preferredHeight: Int? = null
    ) {
        if (rawSrc.isNullOrBlank()) return
        val imageBytes = resolveImageBytes(rawSrc)
        if (imageBytes == null || imageBytes.isEmpty()) {
            document.add(
                Paragraph("🖼️ [Изображение не найдено]")
                    .setFontColor(ColorConstants.GRAY).setFontSize(12f).setMarginBottom(10f)
            )
            return
        }

        val image = Image(ImageDataFactory.create(imageBytes))
        val pageWidth = document.pdfDocument.defaultPageSize.width - 72f

        if (preferredWidth != null && preferredWidth > 0) {
            val target = preferredWidth.toFloat()
            if (target > pageWidth) image.scaleToFit(pageWidth, Float.MAX_VALUE)
            else image.scale(target / image.imageWidth, target / image.imageWidth)
        } else if (image.imageWidth > pageWidth) {
            image.scaleToFit(pageWidth, 10000f)
        }

        image.setHorizontalAlignment(com.itextpdf.layout.properties.HorizontalAlignment.CENTER)
        image.setMarginTop(10f)
        image.setMarginBottom(10f)
        document.add(image)
    }

    private fun resolveImageBytes(src: String): ByteArray? = try {
        val cleaned = src.replace("\\", "/").trim()
        when {
            cleaned.startsWith("data:image", ignoreCase = true) -> {
                val base64 = cleaned.substringAfter(",", "")
                if (base64.isNotEmpty()) Base64.getDecoder().decode(base64) else null
            }
            cleaned.startsWith("http://", true) || cleaned.startsWith("https://", true) -> {
                val localTail = imageBaseHttpPrefixes.firstOrNull { cleaned.startsWith(it, true) }?.let {
                    cleaned.substring(it.length)
                }
                if (localTail != null) readLocalImage(URLDecoder.decode(localTail, StandardCharsets.UTF_8))
                else downloadHttp(cleaned)
            }
            cleaned.startsWith("/images/") || cleaned.startsWith("images/") -> {
                val rel = cleaned.removePrefix("/")
                val tail = URLDecoder.decode(rel.substringAfter("images/"), StandardCharsets.UTF_8)
                readLocalImage(tail)
            }
            else -> readLocalImage(URLDecoder.decode(cleaned, StandardCharsets.UTF_8))
        }
    } catch (e: Exception) {
        println("Ошибка получения изображения из '$src': ${e.message}")
        null
    }

    private fun readLocalImage(relativeInsideImages: String): ByteArray? {
        val full = Paths.get(uploadDir, "images", relativeInsideImages)
        return if (Files.exists(full) && Files.isReadable(full)) Files.readAllBytes(full) else null
    }

    private fun downloadHttp(url: String): ByteArray? = try {
        val u = URL(url)
        val c = u.openConnection()
        c.connectTimeout = 8000
        c.readTimeout = 15000
        c.getInputStream().use { it.readAllBytes() }
    } catch (e: Exception) {
        println("HTTP загрузка не удалась '$url': ${e.message}")
        null
    }

    private fun addText(document: Document, text: String, font: PdfFont) {
        if (text.isNotBlank()) {
            document.add(
                Paragraph(text).setFont(font).setFontSize(14f).setMarginBottom(12f)
            )
        }
    }
}
