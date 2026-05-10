package com.nexos.ai.service

import android.app.Notification
import android.app.PendingIntent
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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.nexos.ai.MainActivity
import com.nexos.ai.NexosApp
import com.nexos.ai.R
import com.nexos.ai.util.MediaProjectionHolder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CompletableDeferred
import javax.inject.Inject

/**
 * Foreground service that captures a single screenshot using MediaProjection.
 * Use [capture] from anywhere to get a one-shot bitmap (the service tears
 * itself down after each capture to avoid holding the projection alive).
 */
@AndroidEntryPoint
class ScreenshotService : Service() {

    @Inject lateinit var holder: MediaProjectionHolder

    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundCompat()
        if (!holder.isReady) {
            Log.w(TAG, "Projection not granted; stopping.")
            pending?.complete(null)
            pending = null
            stopSelf()
            return START_NOT_STICKY
        }
        runCatching { takeScreenshotInternal() }
            .onFailure {
                Log.e(TAG, "Capture failed", it)
                pending?.complete(null)
                pending = null
                tearDown()
                stopSelf()
            }
        return START_NOT_STICKY
    }

    private fun startForegroundCompat() {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification: Notification = NotificationCompat.Builder(this, NexosApp.CHANNEL_WORKFLOW)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_capture_title))
            .setContentText(getString(R.string.notif_capture_text))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun takeScreenshotInternal() {
        val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val data = holder.data
        if (data == null) {
            pending?.complete(null); pending = null; stopSelf(); return
        }
        projection = mgr.getMediaProjection(holder.resultCode, data)
        if (projection == null) {
            Log.e(TAG, "Failed to obtain MediaProjection")
            pending?.complete(null); pending = null; stopSelf(); return
        }

        val metrics = DisplayMetrics().also {
            (getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(it)
        }
        val width  = metrics.widthPixels
        val height = metrics.heightPixels
        val density = metrics.densityDpi

        // Register Callback before any other MediaProjection use (required on Android 14+)
        projection?.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() { tearDown() }
        }, mainHandler)

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = projection?.createVirtualDisplay(
            "NexOSCapture",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY or DisplayManager.VIRTUAL_DISPLAY_FLAG_PUBLIC,
            imageReader!!.surface,
            null, mainHandler
        )

        imageReader?.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            val bitmap = try {
                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride   = planes[0].rowStride
                val rowPadding  = rowStride - pixelStride * width
                val bmpWidth    = width + rowPadding / pixelStride
                val padded = Bitmap.createBitmap(bmpWidth, height, Bitmap.Config.ARGB_8888)
                padded.copyPixelsFromBuffer(buffer)
                Bitmap.createBitmap(padded, 0, 0, width, height).also {
                    if (it != padded) padded.recycle()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Bitmap conversion failed", e); null
            } finally {
                image.close()
            }
            pending?.complete(bitmap)
            pending = null
            tearDown()
            stopSelf()
        }, mainHandler)
    }

    private fun tearDown() {
        runCatching { imageReader?.close() };       imageReader = null
        runCatching { virtualDisplay?.release() };  virtualDisplay = null
        runCatching { projection?.stop() };         projection = null
    }

    override fun onDestroy() {
        super.onDestroy()
        tearDown()
    }

    companion object {
        private const val TAG = "NexOS/ScreenshotService"
        private const val NOTIFICATION_ID = 1042

        @Volatile private var pending: CompletableDeferred<Bitmap?>? = null

        /**
         * Trigger a one-shot capture. Suspends until a bitmap (or null on
         * failure) is returned. Only one capture may be in flight at a time.
         */
        suspend fun capture(context: Context): Bitmap? {
            if (pending != null) return null
            val deferred = CompletableDeferred<Bitmap?>()
            pending = deferred
            val intent = Intent(context.applicationContext, ScreenshotService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.applicationContext.startForegroundService(intent)
            } else {
                context.applicationContext.startService(intent)
            }
            return try {
                deferred.await()
            } catch (e: Exception) {
                Log.e(TAG, "capture await error", e); null
            }
        }
    }
}
