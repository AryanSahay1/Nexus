package com.nexos.ai.service

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.nexos.ai.R
import com.nexos.ai.util.NexosOrchestrator
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import kotlin.coroutines.resume

@AndroidEntryPoint
class ScreenshotService : Service() {

    @Inject lateinit var controller: ScreenshotController
    @Inject lateinit var orchestrator: NexosOrchestrator

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        NotificationChannels.ensure(this)
        startInForeground()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!controller.isReady) {
            Log.w(TAG, "MediaProjection grant not present; stopping")
            stopSelf()
            return START_NOT_STICKY
        }
        scope.launch { runOneCapture() }
        return START_NOT_STICKY
    }

    private fun startInForeground() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private suspend fun runOneCapture() {
        try {
            val bitmap = captureBitmap() ?: return
            orchestrator.handleScreenshotBitmap(bitmap)
        } catch (t: Throwable) {
            Log.e(TAG, "Screenshot pipeline failed", t)
        } finally {
            tearDown()
            stopSelf()
        }
    }

    private suspend fun captureBitmap(): Bitmap? = suspendCancellableCoroutine { cont ->
        val data = controller.resultData
        if (data == null) {
            cont.resume(null); return@suspendCancellableCoroutine
        }
        val pm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = pm.getMediaProjection(controller.resultCode, data)
        if (projection == null) {
            cont.resume(null); return@suspendCancellableCoroutine
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            projection.registerCallback(object : MediaProjection.Callback() {}, null)
        }
        mediaProjection = projection

        val metrics = resources.displayMetrics
        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val density = metrics.densityDpi

        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        imageReader = reader

        virtualDisplay = projection.createVirtualDisplay(
            "NexOS-Capture",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null, null,
        )

        reader.setOnImageAvailableListener({ r ->
            val image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val plane = image.planes[0]
                val buffer = plane.buffer
                val pixelStride = plane.pixelStride
                val rowStride = plane.rowStride
                val rowPadding = rowStride - pixelStride * width
                val tmp = Bitmap.createBitmap(
                    width + rowPadding / pixelStride,
                    height,
                    Bitmap.Config.ARGB_8888,
                )
                tmp.copyPixelsFromBuffer(buffer)
                val cropped = Bitmap.createBitmap(tmp, 0, 0, width, height)
                if (cropped !== tmp) tmp.recycle()
                if (cont.isActive) cont.resume(cropped)
            } catch (t: Throwable) {
                Log.e(TAG, "Image read failed", t)
                if (cont.isActive) cont.resume(null)
            } finally {
                image.close()
                reader.setOnImageAvailableListener(null, null)
            }
        }, null)
    }

    private fun tearDown() {
        try { imageReader?.close() } catch (_: Throwable) {}
        try { virtualDisplay?.release() } catch (_: Throwable) {}
        try { mediaProjection?.stop() } catch (_: Throwable) {}
        imageReader = null
        virtualDisplay = null
        mediaProjection = null
    }

    override fun onDestroy() {
        tearDown()
        scope.cancel()
        super.onDestroy()
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, NotificationChannels.CAPTURE)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.screenshot_service_text))
            .setSmallIcon(R.drawable.ic_nexos_notification)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private companion object {
        const val TAG = "NexOS/ScreenshotService"
        const val NOTIFICATION_ID = 4201
    }
}
