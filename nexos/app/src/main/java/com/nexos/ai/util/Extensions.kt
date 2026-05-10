package com.nexos.ai.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

fun Long.toRelativeTimeString(now: Long = System.currentTimeMillis()): String {
    val diff = now - this
    if (diff < 0) return toFormattedDate()
    val seconds = TimeUnit.MILLISECONDS.toSeconds(diff)
    val minutes = TimeUnit.MILLISECONDS.toMinutes(diff)
    val hours = TimeUnit.MILLISECONDS.toHours(diff)
    val days = TimeUnit.MILLISECONDS.toDays(diff)
    return when {
        seconds < 60 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days < 7 -> "${days}d ago"
        else -> toFormattedDate()
    }
}

fun Long.toFormattedDate(pattern: String = "MMM dd, yyyy"): String =
    SimpleDateFormat(pattern, Locale.getDefault()).format(Date(this))
