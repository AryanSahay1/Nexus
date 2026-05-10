package com.nexos.ai.util

import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.text.format.DateUtils
import androidx.core.content.ContextCompat

fun Context.hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

fun Context.hasOverlayPermission(): Boolean = Settings.canDrawOverlays(this)

fun Context.isIgnoringBatteryOptimization(): Boolean {
    val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
    return pm.isIgnoringBatteryOptimizations(packageName)
}

fun Long.toRelativeTimeString(): String =
    DateUtils.getRelativeTimeSpanString(
        this,
        System.currentTimeMillis(),
        DateUtils.MINUTE_IN_MILLIS
    ).toString()

fun packageUri(packageName: String): Uri = Uri.parse("package:$packageName")
