package com.nexus.app.ui.theme

import com.nexus.app.ui.theme.leather.LeatherPalette

/**
 * Compatibility shims for the rest of the codebase. The single source of
 * truth for colour is `LeatherPalette` in
 * `com.nexus.app.ui.theme.leather`. These aliases let older call sites
 * keep their imports working without referencing raw hex values.
 */

internal val BrandPrimary = LeatherPalette.ThreadFresh
internal val BrandPrimaryDim = LeatherPalette.ThreadMoss
internal val BrandSecondary = LeatherPalette.ThreadLime
internal val BrandAccent = LeatherPalette.WarningAmber

internal val BackgroundDark = LeatherPalette.Walnut
internal val SurfaceDark = LeatherPalette.Tobacco
internal val SurfaceVariantDark = LeatherPalette.Saddle
internal val OnSurfaceDark = LeatherPalette.PandaCream
internal val OnSurfaceMutedDark = LeatherPalette.Tan
internal val OutlineDark = LeatherPalette.ThreadMoss

internal val SuccessGreen = LeatherPalette.ThreadLime
internal val WarningAmber = LeatherPalette.WarningAmber
internal val ErrorRed = LeatherPalette.ErrorOxblood
