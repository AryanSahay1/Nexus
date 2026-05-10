package com.nexos.ai.service

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.core.app.NotificationCompat
import com.nexos.ai.MainActivity
import com.nexos.ai.NexosApp
import com.nexos.ai.R
import com.nexos.ai.data.repository.SettingsRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.abs

/**
 * Foreground service that draws a draggable floating action button over
 * every other app. Tapping triggers a screenshot; long-press triggers voice.
 * The button uses motion: idle pulse, press-shrink, magnetic snap-to-edge.
 */
@AndroidEntryPoint
class FloatingButtonService : Service() {

    @Inject lateinit var settings: SettingsRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var observerJob: Job? = null

    private var windowManager: WindowManager? = null
    private var bubble: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var pulseAnimator: ValueAnimator? = null

    private var startX = 0
    private var startY = 0
    private var touchX = 0f
    private var touchY = 0f
    private var isDragging = false
    private var pressTime = 0L
    private val longPressMs = 480L
    private val tapSlopPx by lazy { resources.displayMetrics.density * 8 }
    private val longPressHandler = Handler(Looper.getMainLooper())
    private var longPressFired = false
    private val longPressRunnable = Runnable {
        if (!isDragging) {
            longPressFired = true
            vibrate(40)
            sendBroadcast(Intent(NexosReceiver.ACTION_START_VOICE).setPackage(packageName))
            playPressAnim(downscale = 0.78f)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundCompat()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        addBubble()
        observerJob = scope.launch {
            settings.settings.distinctUntilChanged { a, b ->
                a.showFloatingButton == b.showFloatingButton && a.floatingSide == b.floatingSide
            }.collectLatest { s ->
                if (!s.showFloatingButton) {
                    removeBubble()
                } else if (bubble == null) {
                    addBubble()
                } else {
                    snapToSide(s.floatingSide.key == "left")
                }
            }
        }
    }

    private fun startForegroundCompat() {
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notif: Notification = NotificationCompat.Builder(this, NexosApp.CHANNEL_SERVICE)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_service_title))
            .setContentText(getString(R.string.notif_service_text))
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notif)
        }
    }

    private fun addBubble() {
        if (bubble != null) return
        val size = (56 * resources.displayMetrics.density).toInt()
        val container = FrameLayout(this)
        val icon = ImageView(this).apply {
            setImageResource(R.drawable.ic_floating_button)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }
        container.addView(icon, FrameLayout.LayoutParams(size, size))

        val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(0xFF00E676.toInt())
            setStroke((2 * resources.displayMetrics.density).toInt(), 0xFF07070F.toInt())
        }
        container.background = bg
        container.elevation = 12f * resources.displayMetrics.density

        val type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        val params = WindowManager.LayoutParams(
            size, size, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = resources.displayMetrics.widthPixels - size - 24
            y = resources.displayMetrics.heightPixels / 3
        }
        layoutParams = params
        runCatching { windowManager?.addView(container, params) }
            .onFailure { Log.e(TAG, "Cannot add overlay view; missing permission?", it); stopSelf(); return }
        bubble = container
        attachGestures(container)
        startPulse(container)
    }

    private fun removeBubble() {
        pulseAnimator?.cancel(); pulseAnimator = null
        bubble?.let { v -> runCatching { windowManager?.removeView(v) } }
        bubble = null
    }

    private fun startPulse(view: View) {
        pulseAnimator?.cancel()
        pulseAnimator = ValueAnimator.ofFloat(1f, 1.06f).apply {
            duration = 1400
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            addUpdateListener { a ->
                val v = a.animatedValue as Float
                view.scaleX = v; view.scaleY = v
            }
            start()
        }
    }

    private fun playPressAnim(downscale: Float) {
        val v = bubble ?: return
        v.animate().scaleX(downscale).scaleY(downscale)
            .setDuration(110).withEndAction {
                v.animate().scaleX(1f).scaleY(1f).setDuration(160)
                    .setInterpolator(OvershootInterpolator(2.5f)).start()
            }.start()
    }

    private fun attachGestures(view: View) {
        view.setOnTouchListener { _, event ->
            val params = layoutParams ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = params.x; startY = params.y
                    touchX = event.rawX; touchY = event.rawY
                    isDragging = false; longPressFired = false
                    pressTime = System.currentTimeMillis()
                    longPressHandler.postDelayed(longPressRunnable, longPressMs)
                    playPressAnim(downscale = 0.88f)
                    pulseAnimator?.cancel()
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - touchX
                    val dy = event.rawY - touchY
                    if (!isDragging && (abs(dx) > tapSlopPx || abs(dy) > tapSlopPx)) {
                        isDragging = true
                        longPressHandler.removeCallbacks(longPressRunnable)
                    }
                    if (isDragging) {
                        params.x = (startX + dx).toInt()
                        params.y = (startY + dy).toInt()
                        runCatching { windowManager?.updateViewLayout(view, params) }
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    longPressHandler.removeCallbacks(longPressRunnable)
                    val duration = System.currentTimeMillis() - pressTime
                    if (!isDragging && !longPressFired && duration < longPressMs) {
                        vibrate(15)
                        playPressAnim(downscale = 0.7f)
                        sendBroadcast(Intent(NexosReceiver.ACTION_CAPTURE_SCREENSHOT).setPackage(packageName))
                    } else if (isDragging) {
                        animateSnapToNearestEdge(params)
                    }
                    // Restart pulse after a short rest.
                    scope.launch { delay(220); bubble?.let { startPulse(it) } }
                    true
                }
                else -> false
            }
        }
    }

    private fun snapToSide(left: Boolean) {
        val params = layoutParams ?: return
        val w = resources.displayMetrics.widthPixels
        val size = bubble?.width ?: (56 * resources.displayMetrics.density).toInt()
        val target = if (left) 24 else w - size - 24
        animateX(params, target)
    }

    private fun animateSnapToNearestEdge(params: WindowManager.LayoutParams) {
        val w = resources.displayMetrics.widthPixels
        val size = bubble?.width ?: (56 * resources.displayMetrics.density).toInt()
        val left = params.x + size / 2 < w / 2
        val target = if (left) 24 else w - size - 24
        scope.launch { settings.setFloatingSide(
            if (left) com.nexos.ai.domain.model.FloatingButtonSide.LEFT
            else com.nexos.ai.domain.model.FloatingButtonSide.RIGHT
        ) }
        animateX(params, target)
    }

    private fun animateX(params: WindowManager.LayoutParams, targetX: Int) {
        val view = bubble ?: return
        val from = params.x
        ValueAnimator.ofInt(from, targetX).apply {
            duration = 260
            interpolator = OvershootInterpolator(1.6f)
            addUpdateListener { a ->
                params.x = a.animatedValue as Int
                runCatching { windowManager?.updateViewLayout(view, params) }
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) { /* no-op */ }
            })
            start()
        }
    }

    private fun vibrate(ms: Long) {
        @Suppress("DEPRECATION")
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        vibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    override fun onDestroy() {
        super.onDestroy()
        pulseAnimator?.cancel()
        removeBubble()
        observerJob?.cancel()
        scope.cancel()
    }

    companion object {
        private const val TAG = "NexOS/FloatingButtonService"
        private const val NOTIFICATION_ID = 1041

        fun start(context: Context) {
            val intent = Intent(context, FloatingButtonService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
        fun stop(context: Context) {
            context.stopService(Intent(context, FloatingButtonService::class.java))
        }
        fun toggle(context: Context) {
            stop(context); start(context)
        }
    }
}
