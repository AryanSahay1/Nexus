package com.nexus.app.ui.theme.leather

import androidx.compose.ui.graphics.Color

/**
 * Single source of truth for every named colour in the *Panda Leather*
 * palette. See `docs/UI_DESIGN_PRD.md §2` for the rationale of each token
 * and the WCAG contrast checks. Components NEVER reference raw hex values
 * — they read either from this file or, preferably, from
 * `MaterialTheme.colorScheme` slots that this file maps onto.
 */
object LeatherPalette {

    // ── Leather (browns) ─────────────────────────────────────────────────
    val Deep = Color(0xFF3A1F0F)        // shadows, deep creases
    val Walnut = Color(0xFF5C3A1E)      // dark-mode background
    val Tobacco = Color(0xFF7A4E2D)     // primary leather card surface
    val Saddle = Color(0xFFA26B3F)      // grain highlights
    val Tan = Color(0xFFC58B5A)         // hover / pressed light glints
    val Glint = Color(0xFFE2B07F)       // specular highlights only

    // ── Threading (greens) ──────────────────────────────────────────────
    val ThreadMoss = Color(0xFF2F6B3D)  // default stitching
    val ThreadFresh = Color(0xFF7BC97D) // primary accent / selected state
    val ThreadLime = Color(0xFF9DD174)  // success / saved affordance

    // ── Panda accents (cream + charcoal) ────────────────────────────────
    val PandaCream = Color(0xFFF4ECDF)  // primary on-leather text
    val PandaIvory = Color(0xFFFFF8EC)  // headings / contrast surfaces
    val PandaCharcoal = Color(0xFF1F1A14) // light-mode body text
    val PandaSlate = Color(0xFF3D332A)  // light-mode subtle text

    // ── Semantic ────────────────────────────────────────────────────────
    val WarningAmber = Color(0xFFE0A23B)
    val ErrorOxblood = Color(0xFFA53B33)
}
