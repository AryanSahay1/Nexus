package com.nexos.ai.service

import android.content.Intent
import androidx.annotation.MainThread
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holds the ResultCode + Intent returned by the user from the MediaProjection consent dialog.
 *
 * This is process-scoped state — when the process dies, the user must consent again.
 */
@Singleton
class ScreenshotController @Inject constructor() {
    @Volatile
    var resultCode: Int = 0
        private set

    @Volatile
    var resultData: Intent? = null
        private set

    val isReady: Boolean get() = resultData != null

    @MainThread
    fun saveProjectionGrant(resultCode: Int, data: Intent) {
        this.resultCode = resultCode
        this.resultData = data
    }

    fun clear() {
        resultCode = 0
        resultData = null
    }
}
