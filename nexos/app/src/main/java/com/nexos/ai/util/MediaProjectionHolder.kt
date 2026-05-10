package com.nexos.ai.util

import android.content.Intent
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-memory holder for the user-granted MediaProjection consent.
 * The data Intent from `createScreenCaptureIntent` is single-use per session,
 * so we store it here so the ScreenshotService can re-create projections
 * for each capture during the same app run.
 */
@Singleton
class MediaProjectionHolder @Inject constructor() {
    @Volatile var resultCode: Int = 0
        private set
    @Volatile var data: Intent? = null
        private set

    val isReady: Boolean get() = data != null && resultCode != 0

    fun store(resultCode: Int, data: Intent) {
        this.resultCode = resultCode
        this.data = data
    }

    fun clear() {
        this.resultCode = 0
        this.data = null
    }
}
